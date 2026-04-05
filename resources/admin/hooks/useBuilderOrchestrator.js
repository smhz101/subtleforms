/**
 * useBuilderOrchestrator — Save / Publish / Delete API orchestration
 *
 * Extracts all side-effectful form lifecycle operations from FormBuilderInner:
 * - performSave (draft save, autosave, publish)
 * - handleSave, handleSaveDraft, handlePublish, confirmPublish
 * - handleSaveAndClose, handleDelete
 * - handleDiscard, confirmDiscard
 * - Modal visibility states for delete / publish / discard confirmations
 */

import { useState, useRef, useCallback, useEffect } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
  apiPost,
  apiPut,
  apiDelete,
  isValidationError,
  isRateLimitError,
  isConflictError,
  getFieldErrors,
} from '../utils/api';
import { BUILDER_ACTIONS } from '../hooks/useBuilderReducer';
import { enrichSchemaWithProMarkers } from '../utils/schemaEnricher';

/**
 * @param {Object}   opts
 * @param {Object}   opts.builderState       Full FSM state from useBuilderReducer
 * @param {Function} opts.dispatch           useBuilderReducer dispatch
 * @param {number}   opts.formId             Route-level formId
 * @param {number}   opts.currentFormId      Resolved formId (may differ after create)
 * @param {Function} opts.setCurrentFormId   Setter for resolved formId
 * @param {Object}   opts.notices            { createSuccessNotice, createErrorNotice, removeNotice, SUCCESS_NOTICE_ID, ERROR_NOTICE_ID }
 * @param {Function} opts.onSaved            Callback after successful save
 * @param {Function} opts.navigate           react-router navigate
 * @param {Function} opts.forceAutosave      From useDraftAutosave
 * @param {boolean}  opts.hasValidationErrors From useBuilderValidation
 */
export default function useBuilderOrchestrator( {
	builderState,
	dispatch,
	formId,
	currentFormId,
	setCurrentFormId,
	notices,
	onSaved,
	navigate,
	hasValidationErrors,
} ) {
	const {
		draftSchema,
		formTitle: stateFormTitle,
		saving,
		autoSaving,
		formStatus,
		isDirty,
	} = builderState;

	const {
		createSuccessNotice,
		createErrorNotice,
		removeNotice,
		SUCCESS_NOTICE_ID,
		ERROR_NOTICE_ID,
	} = notices;

	// ── Modal visibility ─────────────────────────────────────────────────
	const [ showDeleteConfirm, setShowDeleteConfirm ] = useState( false );
	const [ showPublishConfirm, setShowPublishConfirm ] = useState( false );
	const [ showDiscardConfirm, setShowDiscardConfirm ] = useState( false );

	// ── Refs ─────────────────────────────────────────────────────────────
	const lastManualSaveRef = useRef( { targetStatus: null } );
	const autoSaveTimeoutRef = useRef( null );

	// ── Cleanup ──────────────────────────────────────────────────────────
	useEffect(
		() => () => {
			if ( autoSaveTimeoutRef.current ) {
				clearTimeout( autoSaveTimeoutRef.current );
			}
		},
		[]
	);

	// ── performSave ──────────────────────────────────────────────────────
	const performSave = useCallback(
		async ( { auto = false, targetStatus = null } = {} ) => {
			if ( ! draftSchema ) {
				return;
			}

			if ( saving || autoSaving ) {
				return;
			}

			if ( autoSaveTimeoutRef.current ) {
				clearTimeout( autoSaveTimeoutRef.current );
				autoSaveTimeoutRef.current = null;
			}

			const resolvedFormId = currentFormId ?? formId;
			if ( ! resolvedFormId ) {
				const message = __( 'Form identifier missing', 'subtleforms' );

				dispatch( {
					type: auto
						? BUILDER_ACTIONS.AUTOSAVE_ERROR
						: BUILDER_ACTIONS.PUBLISH_ERROR,
					payload: { error: message },
				} );

				if ( ! auto ) {
					removeNotice( SUCCESS_NOTICE_ID );
					createErrorNotice( message, {
						id: ERROR_NOTICE_ID,
						isDismissible: true,
						type: 'snackbar',
					} );
				}
				return;
			}

			// Dispatch start actions
			if ( auto ) {
				dispatch( { type: BUILDER_ACTIONS.START_AUTOSAVE } );
			} else if ( targetStatus === 'published' ) {
				dispatch( { type: BUILDER_ACTIONS.START_PUBLISH } );
			}

			if ( ! auto ) {
				lastManualSaveRef.current = { targetStatus };
			}

			try {
				// Enrich schema with Pro markers before save
				const enrichedSchema =
					enrichSchemaWithProMarkers( draftSchema );

				// Guarantee metadata.title is always non-empty before persisting.
				// The server requires it when the form is published; setting it here
				// prevents a round-trip 422 caused by a title missing from the schema.
				if ( ! enrichedSchema.metadata ) {
					enrichedSchema.metadata = {};
				}
				if ( ! enrichedSchema.metadata.title ) {
					enrichedSchema.metadata.title = stateFormTitle || '';
				}

				const {
					ok,
					body,
					status: saveStatus,
				} = await apiPost( `/forms/${ resolvedFormId }/schema`, {
					schema: enrichedSchema,
					activate: ! auto,
				} );

				if ( ! ok ) {
					// HTTP 422 — Validation error
					if ( isValidationError( { status: saveStatus } ) ) {
						// Normalise across two API shapes:
						//   new: { error: { meta: { fields: [...] } } }
						//   old: { data: { errors: [...] } }  /  { errors: [...] }
						const rawValidationFields =
							body?.error?.meta?.fields ||
							body?.data?.errors?.fields ||
							body?.data?.errors ||
							body?.errors ||
							[];
						const maybeValidationErrors = Array.isArray(
							rawValidationFields
						)
							? rawValidationFields
							: [];
						const fieldErrs = {}; // kept for compat

						if (
							! auto &&
							maybeValidationErrors.length > 0
						) {
							dispatch( {
								type: BUILDER_ACTIONS.PUBLISH_ERROR,
								payload: {
									error: {
										message: __(
											'Fix validation errors before publishing.',
											'subtleforms'
										),
										fields: fieldErrs,
										isValidationError: true,
									},
									validationErrors: Array.isArray(
										maybeValidationErrors
									)
										? maybeValidationErrors
										: [ maybeValidationErrors ],
								},
							} );

							removeNotice( SUCCESS_NOTICE_ID );
							createErrorNotice(
								__(
									'Validation failed. Please fix the highlighted fields.',
									'subtleforms'
								),
								{
									id: ERROR_NOTICE_ID,
									isDismissible: true,
									type: 'snackbar',
									actions: [],
								}
							);
							return;
						}
					}

					// HTTP 429 — Rate limit
					if ( isRateLimitError( { status: saveStatus } ) ) {
						const retryAfter =
							body?.data?.retry_after ||
							body?.retry_after ||
							60;

						dispatch( {
							type: auto
								? BUILDER_ACTIONS.AUTOSAVE_ERROR
								: BUILDER_ACTIONS.PUBLISH_ERROR,
							payload: {
								error: {
									message: sprintf(
										__(
											'Rate limit exceeded. Please try again in %d seconds.',
											'subtleforms'
										),
										retryAfter
									),
									isRateLimited: true,
									retryAfter,
								},
							},
						} );

						removeNotice( SUCCESS_NOTICE_ID );
						createErrorNotice(
							sprintf(
								__(
									'Too many requests. Please wait %d seconds before trying again.',
									'subtleforms'
								),
								retryAfter
							),
							{
								id: ERROR_NOTICE_ID,
								isDismissible: true,
								type: 'snackbar',
							}
						);
						return;
					}

					// HTTP 409 — Conflict
					if ( isConflictError( { status: saveStatus } ) ) {
						const currentETag = body?.data?.current_etag;
						const providedIfMatch =
							body?.data?.provided_if_match;

						dispatch( {
							type: auto
								? BUILDER_ACTIONS.AUTOSAVE_ERROR
								: BUILDER_ACTIONS.PUBLISH_ERROR,
							payload: {
								error: {
									message: __(
										'This form was modified by another user. Please reload to see the latest version.',
										'subtleforms'
									),
									isConflict: true,
									currentETag,
									providedIfMatch,
								},
							},
						} );

						removeNotice( SUCCESS_NOTICE_ID );
						createErrorNotice(
							__(
								'Conflict detected. The form was modified elsewhere. Please reload.',
								'subtleforms'
							),
							{
								id: ERROR_NOTICE_ID,
								isDismissible: false,
								type: 'snackbar',
								actions: [
									{
										label: __(
											'Reload',
											'subtleforms'
										),
										onClick: () =>
											window.location.reload(),
									},
								],
							}
						);
						return;
					}

					const message =
						body?.error?.message ||
						body?.message ||
						body?.data?.message ||
						__( 'Failed to save form', 'subtleforms' );
					throw new Error( message );
				}

				// Update status if specified
				if ( targetStatus && targetStatus !== formStatus ) {
					const {
						ok: statusOk,
						body: statusBody,
						status: statusCode,
					} = await apiPut( `/forms/${ resolvedFormId }`, {
						status: targetStatus,
					} );

					if ( ! statusOk ) {
						// HTTP 422
						if (
							isValidationError( { status: statusCode } )
						) {
							// Normalise across two API shapes:
							//   new: { error: { meta: { fields: [...] } } }
							//   old: { data: { errors: [...] } }  /  { errors: [...] }
							const rawValidationFields =
								statusBody?.error?.meta?.fields ||
								statusBody?.data?.errors?.fields ||
								statusBody?.data?.errors ||
								statusBody?.errors ||
								[];
							const maybeValidationErrors = Array.isArray(
								rawValidationFields
							)
								? rawValidationFields
								: [];
							const fieldErrs = {}; // kept for compat

							if (
								targetStatus === 'published' &&
								maybeValidationErrors.length > 0
							) {
								dispatch( {
									type: BUILDER_ACTIONS.PUBLISH_ERROR,
									payload: {
										error: {
											message: __(
												'Fix validation errors before publishing.',
												'subtleforms'
											),
											fields: fieldErrs,
											isValidationError: true,
										},
										validationErrors: Array.isArray(
											maybeValidationErrors
										)
											? maybeValidationErrors
											: [ maybeValidationErrors ],
									},
								} );

								removeNotice( SUCCESS_NOTICE_ID );
								createErrorNotice(
									__(
										'Validation failed. Please fix the highlighted fields.',
										'subtleforms'
									),
									{
										id: ERROR_NOTICE_ID,
										isDismissible: true,
										type: 'snackbar',
									}
								);
								return;
							}
						}

						// HTTP 429
						if (
							isRateLimitError( { status: statusCode } )
						) {
							const retryAfter =
								statusBody?.data?.retry_after ||
								statusBody?.retry_after ||
								60;

							dispatch( {
								type: BUILDER_ACTIONS.PUBLISH_ERROR,
								payload: {
									error: {
										message: sprintf(
											__(
												'Rate limit exceeded. Please try again in %d seconds.',
												'subtleforms'
											),
											retryAfter
										),
										isRateLimited: true,
										retryAfter,
									},
								},
							} );

							removeNotice( SUCCESS_NOTICE_ID );
							createErrorNotice(
								sprintf(
									__(
										'Too many requests. Please wait %d seconds.',
										'subtleforms'
									),
									retryAfter
								),
								{
									id: ERROR_NOTICE_ID,
									isDismissible: true,
									type: 'snackbar',
								}
							);
							return;
						}

						// HTTP 409
						if (
							isConflictError( { status: statusCode } )
						) {
							const currentETag =
								statusBody?.data?.current_etag;
							const providedIfMatch =
								statusBody?.data?.provided_if_match;

							dispatch( {
								type: BUILDER_ACTIONS.PUBLISH_ERROR,
								payload: {
									error: {
										message: __(
											'This form was modified by another user. Please reload.',
											'subtleforms'
										),
										isConflict: true,
										currentETag,
										providedIfMatch,
									},
								},
							} );

							removeNotice( SUCCESS_NOTICE_ID );
							createErrorNotice(
								__(
									'Conflict detected. Please reload to see latest changes.',
									'subtleforms'
								),
								{
									id: ERROR_NOTICE_ID,
									isDismissible: false,
									type: 'snackbar',
									actions: [
										{
											label: __(
												'Reload',
												'subtleforms'
											),
											onClick: () =>
												window.location.reload(),
										},
									],
								}
							);
							return;
						}

						const errorMessage =
							statusBody?.error?.message ||
							statusBody?.message ||
							__(
								'Failed to update form status',
								'subtleforms'
							);
						throw new Error( errorMessage );
					}
				}

				setCurrentFormId( resolvedFormId );

				// Dispatch success
				if ( targetStatus === 'published' ) {
					dispatch( {
						type: BUILDER_ACTIONS.PUBLISH_SUCCESS,
					} );
				} else if ( auto ) {
					dispatch( {
						type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
						payload: { stillDirty: false },
					} );
				} else {
					dispatch( {
						type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
						payload: { stillDirty: false },
					} );
				}

				const detail = {
					id: resolvedFormId,
					version: body?.version ?? null,
				};
				window.dispatchEvent(
					new CustomEvent( 'subtleforms:form-saved', { detail } )
				);
				onSaved?.( detail );

				if ( ! auto ) {
					removeNotice( ERROR_NOTICE_ID );
					createSuccessNotice(
						targetStatus === 'published'
							? __( 'Form published', 'subtleforms' )
							: __( 'Form saved', 'subtleforms' ),
						{
							id: SUCCESS_NOTICE_ID,
							isDismissible: true,
							type: 'snackbar',
							actions: [],
						}
					);
				}
			} catch ( err ) {
				const message =
					err?.message ||
					__( 'Failed to save form', 'subtleforms' );

				dispatch( {
					type: auto
						? BUILDER_ACTIONS.AUTOSAVE_ERROR
						: BUILDER_ACTIONS.PUBLISH_ERROR,
					payload: { error: message },
				} );

				if ( ! auto ) {
					removeNotice( SUCCESS_NOTICE_ID );
					createErrorNotice( message, {
						id: ERROR_NOTICE_ID,
						isDismissible: true,
						type: 'snackbar',
						actions: [],
					} );
				}
			}
		},
		[
			draftSchema,
			stateFormTitle,
			saving,
			autoSaving,
			currentFormId,
			formId,
			formStatus,
			dispatch,
			removeNotice,
			createSuccessNotice,
			createErrorNotice,
			onSaved,
			SUCCESS_NOTICE_ID,
			ERROR_NOTICE_ID,
			setCurrentFormId,
		]
	);

	// ── Convenience handlers ─────────────────────────────────────────────

	const handleSave = useCallback( () => {
		performSave( { auto: false } );
	}, [ performSave ] );

	const handleSaveDraft = useCallback( () => {
		performSave( { auto: false, targetStatus: 'draft' } );
	}, [ performSave ] );

	/**
	 * Bug 3 fix: walk the field tree and return true when at least one
	 * non-container field exists (regular, multistep, and sectioned forms).
	 */
	function hasLeafFields( fields ) {
		if ( ! Array.isArray( fields ) || fields.length === 0 ) {
			return false;
		}
		const containerTypes = new Set( [ 'step', 'section', 'column', 'row', 'fieldset' ] );
		for ( const field of fields ) {
			if ( containerTypes.has( field.type ) ) {
					if ( hasLeafFields( field.children || field.fields ) ) {
					return true;
				}
			} else {
				return true;
			}
		}
		return false;
	}

	const handlePublish = useCallback( () => {
		// ── Bug 3: client-side pre-publish validation ──────────────────
		const prePublishErrors = [];

		// Check both the schema metadata title and the UI form title.
		// They can diverge if the title was changed but not yet committed to the schema.
		const title = (
			( draftSchema?.metadata?.title || '' ) ||
			( stateFormTitle || '' )
		).trim();
		if ( ! title ) {
			prePublishErrors.push( {
				path: 'metadata.title',
				message: __( 'Form title is required.', 'subtleforms' ),
			} );
		}

		if ( ! hasLeafFields( draftSchema?.fields ) ) {
			prePublishErrors.push( {
				path: 'fields',
				message: __(
					'Form must contain at least one field before publishing.',
					'subtleforms'
				),
			} );
		}

		if ( prePublishErrors.length > 0 ) {
			dispatch( {
				type: BUILDER_ACTIONS.PUBLISH_ERROR,
				payload: {
					error: {
						message: __(
							'Cannot publish: Fix validation errors.',
							'subtleforms'
						),
						isValidationError: true,
					},
					validationErrors: prePublishErrors,
				},
			} );
			removeNotice( SUCCESS_NOTICE_ID );
			createErrorNotice(
				__( 'Cannot publish: Fix validation errors.', 'subtleforms' ),
				{
					id: ERROR_NOTICE_ID,
					isDismissible: true,
					type: 'snackbar',
					actions: [],
				}
			);
			return;
		}
		// ── end pre-publish validation ──────────────────────────────────

		if ( hasValidationErrors ) {
			removeNotice( SUCCESS_NOTICE_ID );
			createErrorNotice(
				__(
					'Fix validation errors before publishing.',
					'subtleforms'
				),
				{
					id: ERROR_NOTICE_ID,
					isDismissible: true,
					type: 'snackbar',
					actions: [],
				}
			);
			return;
		}

		if ( formStatus === 'draft' ) {
			setShowPublishConfirm( true );
		} else {
			performSave( { auto: false, targetStatus: 'published' } );
		}
	}, [
		createErrorNotice,
		dispatch,
		draftSchema,
		stateFormTitle,
		formStatus,
		hasValidationErrors,
		performSave,
		removeNotice,
		SUCCESS_NOTICE_ID,
		ERROR_NOTICE_ID,
	] );

	const confirmPublish = useCallback( () => {
		setShowPublishConfirm( false );
		performSave( { auto: false, targetStatus: 'published' } );
	}, [ performSave ] );

	const handleSaveAndClose = useCallback( async () => {
		if ( ! isDirty ) {
			navigate( '/forms' );
			return;
		}

		try {
			await performSave( { auto: false } );
			setTimeout( () => {
				navigate( '/forms' );
			}, 300 );
		} catch ( err ) {
			// Error already handled in performSave
		}
	}, [ isDirty, performSave, navigate ] );

	const handleDelete = useCallback( async () => {
		if ( ! currentFormId ) {
			return;
		}

		setShowDeleteConfirm( false );

		try {
			const { ok } = await apiDelete( `/forms/${ currentFormId }` );

			if ( ! ok ) {
				throw new Error(
					__( 'Failed to delete form', 'subtleforms' )
				);
			}

			// Clear autosave timer
			if ( autoSaveTimeoutRef.current ) {
				clearTimeout( autoSaveTimeoutRef.current );
				autoSaveTimeoutRef.current = null;
			}

			createSuccessNotice(
				__( 'Form deleted', 'subtleforms' ),
				{
					id: SUCCESS_NOTICE_ID,
					isDismissible: true,
					type: 'snackbar',
				}
			);

			navigate( '/forms' );
		} catch ( err ) {
			createErrorNotice(
				err?.message ||
					__( 'Failed to delete form', 'subtleforms' ),
				{
					id: ERROR_NOTICE_ID,
					isDismissible: true,
					type: 'snackbar',
				}
			);
		}
	}, [
		currentFormId,
		createSuccessNotice,
		createErrorNotice,
		SUCCESS_NOTICE_ID,
		ERROR_NOTICE_ID,
		navigate,
	] );

	const handleDiscard = useCallback( async () => {
		if ( ! isDirty && currentFormId ) {
			try {
				await apiDelete( `/forms/${ currentFormId }` );
			} catch ( err ) {
				console.error( 'Failed to delete draft form:', err );
			}
			navigate( '/forms' );
			return;
		}

		if ( isDirty ) {
			setShowDiscardConfirm( true );
		} else {
			navigate( '/forms' );
		}
	}, [ isDirty, currentFormId, navigate ] );

	const confirmDiscard = useCallback( async () => {
		setShowDiscardConfirm( false );

		if ( autoSaveTimeoutRef.current ) {
			clearTimeout( autoSaveTimeoutRef.current );
			autoSaveTimeoutRef.current = null;
		}

		if ( currentFormId && ! isDirty ) {
			try {
				await apiDelete( `/forms/${ currentFormId }` );
			} catch ( err ) {
				console.error( 'Failed to delete draft form:', err );
			}
		}

		navigate( '/forms' );
	}, [ currentFormId, isDirty, navigate ] );

	// ── Public API ───────────────────────────────────────────────────────
	return {
		performSave,
		handleSave,
		handleSaveDraft,
		handlePublish,
		confirmPublish,
		handleSaveAndClose,
		handleDelete,
		handleDiscard,
		confirmDiscard,
		showDeleteConfirm,
		setShowDeleteConfirm,
		showPublishConfirm,
		setShowPublishConfirm,
		showDiscardConfirm,
		setShowDiscardConfirm,
		lastManualSaveRef,
		autoSaveTimeoutRef,
	};
}
