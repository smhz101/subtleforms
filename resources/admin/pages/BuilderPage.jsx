import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from '@wordpress/element';
import {
  Spinner,
  Notice,
  TabPanel,
  Modal,
} from '@wordpress/components';
import { Button } from '../components/navigation';
import { useNavigate, useParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../components/ui/Icon';
import AdminShell from '../components/AdminShell';
import FormEditor from '../components/builder/FormEditor';
import FormSettings from '../components/builder/FormSettings';
import SubmissionsTable from '../components/SubmissionsTable';
import BuilderTour from '../components/BuilderTour';
import { FormPreviewModal } from '../components/form-preview';
import HelpMenu from '../components/HelpMenu';
import CreateFormWizard from '../components/CreateFormWizard';
import EmptyFormWelcome from '../components/builder/EmptyFormWelcome';
import { ConfirmModal } from '../modals';
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  isValidationError,
  isRateLimitError,
  isConflictError,
  getFieldErrors,
} from '../utils/api';
import { createInitialSchema } from '../utils/initialSchema';
import useBuilderReducer, {
  BUILDER_ACTIONS,
  BUILDER_STATES,
  HISTORY_BATCH_WINDOW_MS,
} from '../hooks/useBuilderReducer';
import useDraftAutosave from '../hooks/useDraftAutosave';
import useBuilderBoot from '../hooks/builder/useBuilderBoot';
import useBuilderKeyboardShortcuts from '../hooks/builder/useBuilderKeyboardShortcuts';
import useBuilderValidation from '../hooks/builder/useBuilderValidation';
import useBuilderNotices from '../hooks/builder/useBuilderNotices';
import {
  BuilderTitle,
  BuilderActions,
} from '../components/builder/layout/BuilderHeaderBar';
import BuilderCanvasArea from '../components/builder/layout/BuilderCanvasArea';
import BuilderModalsController from '../components/builder/layout/BuilderModalsController';
import { enrichSchemaWithProMarkers } from '../utils/schemaEnricher';

function FormBuilderInner({
  formId,
  onClose,
  onSaved,
  bootstrap = null,
  onOpenWizard,
  showWizard = false,
  autoShowTour = false,
}) {
  const navigate = useNavigate();
  // Builder FSM State (replaces individual useState calls)
  const [builderState, dispatch] = useBuilderReducer(formId);

  // Extract commonly used state for convenience
  const {
    state: fsmState,
    loading,
    draftSchema,
    isDirty,
    saving,
    autoSaving,
    formStatus,
    error,
    saveError,
    autoSaveError,
    validationErrors,
    fieldErrors,
    isRateLimited,
    rateLimitRetryAfter,
    hasConflict,
    conflictData,
    formTitle: stateFormTitle,
    formId: stateFormId,
    lastSaveTime,
    lastAutoSaveTime,
    schemaHistoryPast,
    schemaHistoryFuture,
  } = builderState;

  const canUndo =
    Array.isArray(schemaHistoryPast) && schemaHistoryPast.length > 0;
  const canRedo =
    Array.isArray(schemaHistoryFuture) && schemaHistoryFuture.length > 0;

  // Hook integrations
  const {
    fieldGroups,
    fieldDefinitions,
    loadingFields,
    isHydrating,
    showTour,
    setShowTour,
    tourCompleted,
    setTourCompleted,
    settings,
  } = useBuilderBoot({
    formId,
    bootstrap,
    dispatch,
    autoShowTour,
  });

  const {
    createSuccessNotice,
    createErrorNotice,
    removeNotice,
    SUCCESS_NOTICE_ID,
    ERROR_NOTICE_ID,
  } = useBuilderNotices();

  // Autosave hook - handles automatic draft saving
  const { forceAutosave } = useDraftAutosave({
    builderState,
    dispatch,
    formId: stateFormId || formId,
    enabled: !isHydrating, // Don't autosave during hydration
  });

  const lastManualSaveRef = useRef({ targetStatus: null });

  // Remaining UI-specific state
  const [formTitle, setFormTitle] = useState(stateFormTitle || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [currentFormId, setCurrentFormId] = useState(
    stateFormId || formId || null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const titleInputRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);

  // Legacy status mapping for UI components
  const status = useMemo(() => {
    switch (fsmState) {
      case BUILDER_STATES.AUTOSAVING:
      case BUILDER_STATES.PUBLISHING:
        return 'saving';
      case BUILDER_STATES.SAVED:
      case BUILDER_STATES.PUBLISHED:
        return 'saved';
      case BUILDER_STATES.DIRTY:
        return 'dirty';
      case BUILDER_STATES.ERROR:
        return 'error';
      default:
        return 'saved';
    }
  }, [fsmState]);

  const effectiveStatus = useMemo(() => {
    // Task 5.6: Keep FSM stable, but still surface recoverable errors.
    if (autoSaveError || saveError) {
      return 'error';
    }
    return status;
  }, [autoSaveError, saveError, status]);

  // Validation hook integration (move performSave definition before this)
  const performSave = useCallback(
    async ({ auto = false, targetStatus = null } = {}) => {
      if (!draftSchema) {
        return;
      }

      if (saving || autoSaving) {
        return;
      }

      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      // Save to existing form (no ephemeral mode)
      const resolvedFormId = currentFormId ?? formId;
      if (!resolvedFormId) {
        const message = __('Form identifier missing', 'subtleforms');

        dispatch({
          type: auto
            ? BUILDER_ACTIONS.AUTOSAVE_ERROR
            : BUILDER_ACTIONS.PUBLISH_ERROR,
          payload: { error: message },
        });

        if (!auto) {
          removeNotice(SUCCESS_NOTICE_ID);
          createErrorNotice(message, {
            id: ERROR_NOTICE_ID,
            isDismissible: true,
            type: 'snackbar',
          });
        }
        return;
      }

      // Dispatch start actions
      if (auto) {
        dispatch({ type: BUILDER_ACTIONS.START_AUTOSAVE });
      } else if (targetStatus === 'published') {
        dispatch({ type: BUILDER_ACTIONS.START_PUBLISH });
      }

      if (!auto) {
        lastManualSaveRef.current = { targetStatus };
      }

      try {
        // Enrich schema with Pro markers before save
        const enrichedSchema = enrichSchemaWithProMarkers(draftSchema);

        // Save schema (activate only on manual save or publish, not autosave)
        const {
          ok,
          body,
          status: saveStatus,
        } = await apiPost(`/forms/${resolvedFormId}/schema`, {
          schema: enrichedSchema,
          activate: auto ? false : true, // Autosave: draft only, Manual save: activate
        });

        if (!ok) {
          // Check for validation error (HTTP 422)
          if (isValidationError({ status: saveStatus })) {
            const fieldErrs = getFieldErrors({ status: saveStatus, fields: body?.data?.errors?.fields });
            const maybeValidationErrors = body?.data?.errors || body?.errors || [];

            if (!auto && maybeValidationErrors.length > 0) {
              dispatch({
                type: BUILDER_ACTIONS.PUBLISH_ERROR,
                payload: {
                  error: {
                    message: __('Fix validation errors before publishing.', 'subtleforms'),
                    fields: fieldErrs,
                    isValidationError: true,
                  },
                  validationErrors: Array.isArray(maybeValidationErrors) ? maybeValidationErrors : [maybeValidationErrors],
                },
              });

              removeNotice(SUCCESS_NOTICE_ID);
              createErrorNotice(
                __('Validation failed. Please fix the highlighted fields.', 'subtleforms'),
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

          // Check for rate limit (HTTP 429)
          if (isRateLimitError({ status: saveStatus })) {
            const retryAfter = body?.data?.retry_after || body?.retry_after || 60;
            
            dispatch({
              type: auto ? BUILDER_ACTIONS.AUTOSAVE_ERROR : BUILDER_ACTIONS.PUBLISH_ERROR,
              payload: {
                error: {
                  message: sprintf(
                    __('Rate limit exceeded. Please try again in %d seconds.', 'subtleforms'),
                    retryAfter
                  ),
                  isRateLimited: true,
                  retryAfter,
                },
              },
            });

            removeNotice(SUCCESS_NOTICE_ID);
            createErrorNotice(
              sprintf(
                __('Too many requests. Please wait %d seconds before trying again.', 'subtleforms'),
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

          // Check for conflict (HTTP 409)
          if (isConflictError({ status: saveStatus })) {
            const currentETag = body?.data?.current_etag;
            const providedIfMatch = body?.data?.provided_if_match;
            
            dispatch({
              type: auto ? BUILDER_ACTIONS.AUTOSAVE_ERROR : BUILDER_ACTIONS.PUBLISH_ERROR,
              payload: {
                error: {
                  message: __('This form was modified by another user. Please reload to see the latest version.', 'subtleforms'),
                  isConflict: true,
                  currentETag,
                  providedIfMatch,
                },
              },
            });

            removeNotice(SUCCESS_NOTICE_ID);
            createErrorNotice(
              __('Conflict detected. The form was modified elsewhere. Please reload.', 'subtleforms'),
              {
                id: ERROR_NOTICE_ID,
                isDismissible: false,
                type: 'snackbar',
                actions: [
                  {
                    label: __('Reload', 'subtleforms'),
                    onClick: () => window.location.reload(),
                  },
                ],
              }
            );
            return;
          }

          const message =
            body?.message ||
            body?.data?.message ||
            __('Failed to save form', 'subtleforms');
          throw new Error(message);
        }

        // Update status if specified
        if (targetStatus && targetStatus !== formStatus) {
          const {
            ok: statusOk,
            body: statusBody,
            status: statusCode,
          } = await apiPut(`/forms/${resolvedFormId}`, {
            status: targetStatus,
          });

          if (!statusOk) {
            // Check for validation error (HTTP 422)
            if (isValidationError({ status: statusCode })) {
              const fieldErrs = getFieldErrors({ status: statusCode, fields: statusBody?.data?.errors?.fields });
              const maybeValidationErrors = statusBody?.data?.errors || statusBody?.errors || [];

              if (
                targetStatus === 'published' &&
                maybeValidationErrors.length > 0
              ) {
                dispatch({
                  type: BUILDER_ACTIONS.PUBLISH_ERROR,
                  payload: {
                    error: {
                      message: __('Fix validation errors before publishing.', 'subtleforms'),
                      fields: fieldErrs,
                      isValidationError: true,
                    },
                    validationErrors: Array.isArray(maybeValidationErrors) ? maybeValidationErrors : [maybeValidationErrors],
                  },
                });

                removeNotice(SUCCESS_NOTICE_ID);
                createErrorNotice(
                  __('Validation failed. Please fix the highlighted fields.', 'subtleforms'),
                  {
                    id: ERROR_NOTICE_ID,
                    isDismissible: true,
                    type: 'snackbar',
                  }
                );
                return;
              }
            }

            // Check for rate limit (HTTP 429)
            if (isRateLimitError({ status: statusCode })) {
              const retryAfter = statusBody?.data?.retry_after || statusBody?.retry_after || 60;
              
              dispatch({
                type: BUILDER_ACTIONS.PUBLISH_ERROR,
                payload: {
                  error: {
                    message: sprintf(
                      __('Rate limit exceeded. Please try again in %d seconds.', 'subtleforms'),
                      retryAfter
                    ),
                    isRateLimited: true,
                    retryAfter,
                  },
                },
              });

              removeNotice(SUCCESS_NOTICE_ID);
              createErrorNotice(
                sprintf(
                  __('Too many requests. Please wait %d seconds.', 'subtleforms'),
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

            // Check for conflict (HTTP 409)
            if (isConflictError({ status: statusCode })) {
              const currentETag = statusBody?.data?.current_etag;
              const providedIfMatch = statusBody?.data?.provided_if_match;
              
              dispatch({
                type: BUILDER_ACTIONS.PUBLISH_ERROR,
                payload: {
                  error: {
                    message: __('This form was modified by another user. Please reload.', 'subtleforms'),
                    isConflict: true,
                    currentETag,
                    providedIfMatch,
                  },
                },
              });

              removeNotice(SUCCESS_NOTICE_ID);
              createErrorNotice(
                __('Conflict detected. Please reload to see latest changes.', 'subtleforms'),
                {
                  id: ERROR_NOTICE_ID,
                  isDismissible: false,
                  type: 'snackbar',
                  actions: [
                    {
                      label: __('Reload', 'subtleforms'),
                      onClick: () => window.location.reload(),
                    },
                  ],
                }
              );
              return;
            }

            // Handle other publish errors
            const errorMessage =
              statusBody?.message ||
              __('Failed to update form status', 'subtleforms');
            throw new Error(errorMessage);
          }
        }

        setCurrentFormId(resolvedFormId);

        // Dispatch success actions
        if (targetStatus === 'published') {
          dispatch({ type: BUILDER_ACTIONS.PUBLISH_SUCCESS });
        } else if (auto) {
          // Check if still dirty (user edited during autosave)
          dispatch({
            type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
            payload: { stillDirty: false }, // TODO: track concurrent edits
          });
        } else {
          dispatch({
            type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
            payload: { stillDirty: false },
          });
        }

        const detail = {
          id: resolvedFormId,
          version: body?.version ?? null,
        };
        window.dispatchEvent(
          new CustomEvent('subtleforms:form-saved', { detail })
        );
        onSaved?.(detail);

        if (!auto) {
          removeNotice(ERROR_NOTICE_ID);
          createSuccessNotice(
            targetStatus === 'published'
              ? __('Form published', 'subtleforms')
              : __('Form saved', 'subtleforms'),
            {
              id: SUCCESS_NOTICE_ID,
              isDismissible: true,
              type: 'snackbar',
              actions: [],
            }
          );
        }
      } catch (err) {
        const message =
          err?.message || __('Failed to save form', 'subtleforms');

        dispatch({
          type: auto
            ? BUILDER_ACTIONS.AUTOSAVE_ERROR
            : BUILDER_ACTIONS.PUBLISH_ERROR,
          payload: { error: message },
        });

        if (!auto) {
          removeNotice(SUCCESS_NOTICE_ID);
          createErrorNotice(message, {
            id: ERROR_NOTICE_ID,
            isDismissible: true,
            type: 'snackbar',
            actions: [],
          });
        }
      }
    },
    [
      draftSchema,
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
    ]
  );

  const {
    hasValidationErrors,
    dismissRecoverableErrors,
    retryAutosave,
    retryLastManualSave,
  } = useBuilderValidation({
    builderState,
    dispatch,
    forceAutosave,
    lastManualSaveRef,
    performSave,
  });

  // Keyboard shortcuts hook
  useBuilderKeyboardShortcuts({
    dispatch,
    isHydrating,
    saving,
    autoSaving,
    canUndo,
    canRedo,
  });

  // Cleanup and navigation protection effects
  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    },
    []
  );

  // Navigation protection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    setCurrentFormId(formId ?? null);
  }, [formId]);

  function generateDefaultTitle() {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(
      /* translators: %1$d: numeric suffix used to create a unique title */
      __('Untitled Form %1$d', 'subtleforms'),
      suffix
    );
  }

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (!draftSchema) {
      return;
    }
    const currentTitle = draftSchema.metadata?.title || '';
    if (!isEditingTitle && currentTitle && currentTitle !== formTitle) {
      setFormTitle(currentTitle);
    }
  }, [draftSchema, formTitle, isEditingTitle]);

  const markDirty = useCallback(() => {
    if (isHydrating) {
      return;
    }
    dispatch({
      type: BUILDER_ACTIONS.EDIT_SCHEMA,
      payload: { schema: draftSchema },
    });
  }, [isHydrating, draftSchema, dispatch]);

  const handleSchemaChange = useCallback(
    (nextSchema) => {
      if (isHydrating) {
        return;
      }
      dispatch({
        type: BUILDER_ACTIONS.EDIT_SCHEMA,
        payload: { schema: nextSchema },
      });
    },
    [dispatch, isHydrating]
  );

  /**
   * HISTORY BATCHING TIMER MANAGEMENT
   *
   * Manages the batch timer for high-frequency operations (drag/reorder).
   * After HISTORY_BATCH_WINDOW_MS of no edits, commits the batch to history.
   *
   * This prevents history spam during drag operations while preserving
   * the ability to undo the entire drag sequence in one step.
   */
  const batchTimerRef = useRef(null);

  useEffect(() => {
    // Access the batch state from builderState
    const { historyBatchPendingSchema } = builderState;

    // Clear any existing timer
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }

    // If there's a pending batch, start the commit timer
    if (historyBatchPendingSchema) {
      batchTimerRef.current = setTimeout(() => {
        dispatch({ type: BUILDER_ACTIONS.COMMIT_HISTORY_BATCH });
        batchTimerRef.current = null;
      }, HISTORY_BATCH_WINDOW_MS);
    }

    // Cleanup on unmount
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, [builderState.historyBatchPendingSchema, dispatch]);

  function persistTitle(nextTitle) {
    if (!draftSchema) {
      setIsEditingTitle(false);
      return;
    }

    const trimmed = nextTitle.trim() || generateDefaultTitle();
    setFormTitle(trimmed);

    const metadata = {
      ...(draftSchema.metadata || {}),
      title: trimmed,
    };

    if (!metadata.name) {
      metadata.name = 'form_schema';
    }

    const updatedSchema = {
      ...draftSchema,
      metadata,
    };

    dispatch({
      type: BUILDER_ACTIONS.EDIT_SCHEMA,
      payload: { schema: updatedSchema },
    });

    setIsEditingTitle(false);

    // Update both the schema (via autosave) and the form title (via direct API call)
    const updateTitleAsync = async () => {
      try {
        // Update form title at the top level
        if (currentFormId) {
          await apiPut(`/forms/${currentFormId}`, {
            title: trimmed,
          });
        }

        // Force autosave to persist the schema title change
        if (typeof forceAutosave === 'function') {
          forceAutosave();
        }
      } catch (error) {
        console.error('Failed to update form title:', error);
        // Still attempt autosave even if form title update fails
        if (typeof forceAutosave === 'function') {
          forceAutosave();
        }
      }
    };

    // Small delay to ensure the schema update is processed first
    setTimeout(updateTitleAsync, 100);
  }

  function handleCopyShortcode(shortcode) {
    if (!shortcode) {
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shortcode).then(() => {
        setCopyState('copied');
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => setCopyState('idle'), 2000);
      });
    }
  }

  const handleSave = useCallback(() => {
    performSave({ auto: false });
  }, [performSave]);

  const handleSaveDraft = useCallback(() => {
    performSave({ auto: false, targetStatus: 'draft' });
  }, [performSave]);

  const handlePublish = useCallback(() => {
    if (hasValidationErrors) {
      removeNotice(SUCCESS_NOTICE_ID);
      createErrorNotice(
        __('Fix validation errors before publishing.', 'subtleforms'),
        {
          id: ERROR_NOTICE_ID,
          isDismissible: true,
          type: 'snackbar',
          actions: [],
        }
      );
      return;
    }

    if (formStatus === 'draft') {
      setShowPublishConfirm(true);
    } else {
      performSave({ auto: false, targetStatus: 'published' });
    }
  }, [
    createErrorNotice,
    formStatus,
    hasValidationErrors,
    performSave,
    removeNotice,
  ]);

  const confirmPublish = useCallback(() => {
    setShowPublishConfirm(false);
    performSave({ auto: false, targetStatus: 'published' });
  }, [performSave]);

  const handleSaveAndClose = useCallback(async () => {
    if (!isDirty) {
      // No changes, just close
      navigate('/forms');
      return;
    }

    // Save first, then redirect on success
    try {
      await performSave({ auto: false });
      // Navigate after successful save
      setTimeout(() => {
        navigate('/forms');
      }, 300);
    } catch (err) {
      // Error already handled in performSave
    }
  }, [isDirty, performSave, navigate]);

  const handleDelete = useCallback(async () => {
    if (!currentFormId) return;

    setShowDeleteConfirm(false);

    try {
      const { ok } = await apiDelete(`/forms/${currentFormId}`);

      if (!ok) {
        throw new Error(__('Failed to delete form', 'subtleforms'));
      }

      // Clear autosave timer
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      createSuccessNotice(__('Form deleted', 'subtleforms'), {
        id: SUCCESS_NOTICE_ID,
        isDismissible: true,
        type: 'snackbar',
      });

      // Navigate to forms list
      navigate('/forms');
    } catch (err) {
      createErrorNotice(
        err?.message || __('Failed to delete form', 'subtleforms'),
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
  ]);

  const handleDiscard = useCallback(async () => {
    // If no changes made, delete the draft form and navigate away
    if (!isDirty && currentFormId) {
      try {
        await apiDelete(`/forms/${currentFormId}`);
      } catch (err) {
        console.error('Failed to delete draft form:', err);
      }
      navigate('/forms');
      return;
    }

    // If changes were made, show confirmation
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      navigate('/forms');
    }
  }, [isDirty, currentFormId, navigate]);

  const confirmDiscard = useCallback(async () => {
    setShowDiscardConfirm(false);

    // Clear autosave timer
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    // Delete the draft form if it was never saved with edits
    if (currentFormId && !isDirty) {
      try {
        await apiDelete(`/forms/${currentFormId}`);
      } catch (err) {
        console.error('Failed to delete draft form:', err);
      }
    }

    // Navigate without saving
    navigate('/forms');
  }, [currentFormId, isDirty, navigate]);

  const handleClose = useCallback(() => {
    // For forms with changes, show confirmation
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleTourComplete = useCallback(() => {
    setShowTour(false);
    setTourCompleted(true);
  }, []);

  const handleTourSkip = useCallback(() => {
    setShowTour(false);
  }, []);

  const shortcode = currentFormId ? `[subtleforms id="${currentFormId}"]` : '';
  const statusLabel = useMemo(() => {
    if (autoSaving) return __('Saving...', 'subtleforms');
    if (effectiveStatus === 'saving') return __('Saving…', 'subtleforms');
    if (effectiveStatus === 'saved') return __('Saved', 'subtleforms');
    return __('Unsaved changes', 'subtleforms');
  }, [effectiveStatus, autoSaving]);

  const statusDescription = useMemo(() => {
    if (effectiveStatus === 'error') {
      return autoSaveError || saveError || null;
    }

    const lastTime = lastSaveTime || lastAutoSaveTime;
    if (!lastTime) {
      return null;
    }

    const time = new Date(lastTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (autoSaving || effectiveStatus === 'saving') {
      return (() => {
        /* translators: %1$s: localized time string (e.g. 12:34 PM) */ return sprintf(
          __('Saving… (last saved at %1$s)', 'subtleforms'),
          time
        );
      })();
    }

    if (effectiveStatus === 'saved') {
      return (() => {
        /* translators: %1$s: localized time string (e.g. 12:34 PM) */ return sprintf(
          __('Last saved at %1$s', 'subtleforms'),
          time
        );
      })();
    }

    return null;
  }, [
    autoSaveError,
    autoSaving,
    effectiveStatus,
    lastAutoSaveTime,
    lastSaveTime,
    saveError,
  ]);

  if (loadingFields) return <Spinner />;
  if (loading) return <Spinner />;
  if (error) return <Notice status='error'>{error}</Notice>;

  // Get form type badge config
  const formType = draftSchema?.metadata?.type || 'regular';
  const formTypeBadgeConfig = {
    regular: {
      icon: Icon.FileText,
      label: __('Regular', 'subtleforms'),
      color: 'gray',
    },
    multistep: {
      icon: Icon.Layers,
      label: __('Multi-step', 'subtleforms'),
      color: 'purple',
    },
    sectioned: {
      icon: Icon.List,
      label: __('Sectioned', 'subtleforms'),
      color: 'indigo',
    },
    conversational: {
      icon: Icon.MessageCircle,
      label: __('Conversational', 'subtleforms'),
      color: 'blue',
    },
    payment: {
      icon: Icon.CreditCard,
      label: __('Payment', 'subtleforms'),
      color: 'green',
    },
  };
  const formTypeBadge =
    formTypeBadgeConfig[formType] || formTypeBadgeConfig.regular;
  const FormTypeIcon = formTypeBadge.icon;

  // Fallback UI if schema has no fields
  const hasFields = Array.isArray(draftSchema?.fields) && draftSchema.fields.length > 0;

  return (
    <>
      <AdminShell
        title={
          <BuilderTitle
            formTitle={formTitle}
            isEditingTitle={isEditingTitle}
            setIsEditingTitle={setIsEditingTitle}
            setFormTitle={setFormTitle}
            onPersistTitle={persistTitle}
            formTypeBadge={formTypeBadge}
            FormTypeIcon={FormTypeIcon}
            draftSchema={draftSchema}
          />
        }
        actions={
          <BuilderActions
            formStatus={formStatus}
            shortcode={shortcode}
            copyState={copyState}
            onCopyShortcode={handleCopyShortcode}
            statusLabel={statusLabel}
            statusDescription={statusDescription}
            effectiveStatus={effectiveStatus}
            autoSaving={autoSaving}
            autoSaveError={autoSaveError}
            saveError={saveError}
            onRetryAutosave={retryAutosave}
            onRetryLastManualSave={retryLastManualSave}
            onDismissErrors={dismissRecoverableErrors}
            canUndo={canUndo}
            canRedo={canRedo}
            saving={saving}
            dispatch={dispatch}
            isDirty={isDirty}
            hasValidationErrors={hasValidationErrors}
            draftSchema={draftSchema}
            onSaveDraft={handleSaveDraft}
            onPublish={handlePublish}
            onSaveAndClose={handleSaveAndClose}
            onDelete={() => setShowDeleteConfirm(true)}
            onPreview={() => {
              dispatch({ type: BUILDER_ACTIONS.OPEN_PREVIEW });
              setShowPreview(true);
            }}
            onStartTour={() => setShowTour(true)}
            onOpenWizard={onOpenWizard}
            showWizard={showWizard}
          />
        }
        noScroll={true}>
        <BuilderCanvasArea
          saveError={saveError}
          validationErrors={validationErrors}
          fieldErrors={fieldErrors}
          hasValidationErrors={hasValidationErrors}
          draftSchema={draftSchema}
          fieldGroups={fieldGroups}
          fieldDefinitions={fieldDefinitions}
          onSchemaChange={handleSchemaChange}
          currentFormId={currentFormId}
          showWelcome={!hasFields}
        />
      </AdminShell>

      <BuilderModalsController
        showDeleteConfirm={showDeleteConfirm}
        showPublishConfirm={showPublishConfirm}
        showDiscardConfirm={showDiscardConfirm}
        showTour={showTour}
        showPreview={showPreview}
        onCloseDeleteConfirm={() => setShowDeleteConfirm(false)}
        onConfirmDelete={handleDelete}
        onClosePublishConfirm={() => setShowPublishConfirm(false)}
        onConfirmPublish={confirmPublish}
        onCloseDiscardConfirm={() => setShowDiscardConfirm(false)}
        onConfirmSaveDraft={handleSaveDraft}
        onConfirmDiscard={confirmDiscard}
        onCloseTour={handleTourComplete}
        onSkipTour={handleTourSkip}
        onClosePreview={() => {
          dispatch({ type: BUILDER_ACTIONS.CLOSE_PREVIEW });
          setShowPreview(false);
        }}
        draftSchema={draftSchema}
        isDirty={isDirty}
      />
    </>
  );
}

export default function FormBuilderPage(props) {
  const { formId: paramFormId } = useParams();
  const formId = paramFormId ? parseInt(paramFormId, 10) : null;
  // Router (navigate/back) used by wizard callbacks
  const navigate = useNavigate();

  const [wizardStatusLoaded, setWizardStatusLoaded] = useState(!!formId);
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [createdFormId, setCreatedFormId] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);

  const [showQuickWizard, setShowQuickWizard] = useState(false);
  const [quickWizardInitialTitle, setQuickWizardInitialTitle] = useState('');

  const isNewForm = !formId;

  const effectiveFormId = createdFormId || formId;

  const handleCancelWizard = useCallback(() => {
    navigate('/forms');
  }, [navigate]);

  const generateDefaultTitleForWizard = useCallback(() => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(
      /* translators: %1$d: numeric suffix used to create a unique title */
      __('Untitled Form %1$d', 'subtleforms'),
      suffix
    );
  }, []);

  const openQuickWizard = useCallback(() => {
    setQuickWizardInitialTitle(generateDefaultTitleForWizard());
    setShowQuickWizard(true);
  }, [generateDefaultTitleForWizard]);

  useEffect(() => {
    if (!isNewForm) {
      return;
    }

    let cancelled = false;
    apiGet('/create-wizard/status').then(({ ok, body }) => {
      if (cancelled) {
        return;
      }

      // Fail-open: if endpoint fails, show wizard.
      const dismissed = ok ? !!body?.dismissed : false;
      setWizardDismissed(dismissed);
      setWizardStatusLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isNewForm]);

  const createDraftFormWithSchema = useCallback(
    async ({ title, description, formType, startingPoint, dontShowAgain }) => {
      setCreateError(null);
      setCreating(true);

      try {
        const resolvedTitle =
          (title || '').trim() || generateDefaultTitleForWizard();
        const resolvedDescription = (description || '').trim();

        const schema = createInitialSchema({
          title: resolvedTitle,
          description: resolvedDescription,
          formType,
          startingPoint,
        });

        // Enrich schema with Pro markers before creating form
        const enrichedSchema = enrichSchemaWithProMarkers(schema);

        const formRes = await apiPost('/forms', {
          title: resolvedTitle,
          status: 'draft',
          config: {
            description: resolvedDescription,
            type: formType,
          },
        });

        if (!formRes.ok) {
          throw new Error(
            formRes.body?.message ||
              __('Failed to create draft form', 'subtleforms')
          );
        }

        const newId = formRes.body?.id;
        if (!newId) {
          throw new Error(__('Failed to create draft form', 'subtleforms'));
        }

        const schemaRes = await apiPost(`/forms/${newId}/schema`, {
          schema: enrichedSchema,
          activate: false,
        });

        if (!schemaRes.ok) {
          throw new Error(
            schemaRes.body?.message ||
              __('Failed to initialize draft schema', 'subtleforms')
          );
        }

        if (dontShowAgain) {
          // Best-effort (do not block creation).
          apiPost('/create-wizard/dismiss', {});
        }

        setCreatedFormId(newId);
        setBootstrap({
          form: { id: newId, title: resolvedTitle, status: 'draft' },
          schema: enrichedSchema,
        });
      } catch (e) {
        setCreateError(
          e?.message || __('Failed to create form', 'subtleforms')
        );
        throw e;
      } finally {
        setCreating(false);
      }
    },
    [generateDefaultTitleForWizard]
  );

  // If user opted out of the wizard, still create a sensible starter form before mounting the builder.
  useEffect(() => {
    if (!isNewForm) {
      return;
    }
    if (!wizardStatusLoaded) {
      return;
    }
    if (!wizardDismissed) {
      return;
    }
    if (effectiveFormId || creating) {
      return;
    }

    createDraftFormWithSchema({
      title: generateDefaultTitleForWizard(),
      description: '',
      formType: 'regular',
      startingPoint: 'minimal',
      dontShowAgain: false,
    }).catch((e) => {
      setCreateError(e?.message || __('Failed to create form', 'subtleforms'));
      setCreating(false);
    });
  }, [
    creating,
    createDraftFormWithSchema,
    effectiveFormId,
    generateDefaultTitleForWizard,
    isNewForm,
    wizardDismissed,
    wizardStatusLoaded,
  ]);

  if (showQuickWizard) {
    return (
      <AdminShell>
        <CreateFormWizard
          initialTitle={
            quickWizardInitialTitle || generateDefaultTitleForWizard()
          }
          onCancel={() => setShowQuickWizard(false)}
          onComplete={async (data) => {
            await createDraftFormWithSchema(data);
            setShowQuickWizard(false);
          }}
        />
      </AdminShell>
    );
  }

  if (!isNewForm) {
    return (
      <FormBuilderInner
        {...props}
        formId={effectiveFormId}
        bootstrap={bootstrap?.form?.id === effectiveFormId ? bootstrap : null}
        onOpenWizard={openQuickWizard}
        showWizard={true}
        autoShowTour={false}
      />
    );
  }

  if (!wizardStatusLoaded) {
    return <Spinner />;
  }

  if (!effectiveFormId && !wizardDismissed) {
    return (
      <AdminShell>
        <CreateFormWizard
          initialTitle={generateDefaultTitleForWizard()}
          onCancel={handleCancelWizard}
          onComplete={createDraftFormWithSchema}
        />
      </AdminShell>
    );
  }

  if (!effectiveFormId) {
    return (
      <AdminShell>
        {createError ? (
          <Notice status='error' isDismissible={false}>
            {createError}
          </Notice>
        ) : (
          <Spinner />
        )}
      </AdminShell>
    );
  }

  return (
    <FormBuilderInner
      {...props}
      formId={effectiveFormId}
      bootstrap={bootstrap?.form?.id === effectiveFormId ? bootstrap : null}
      onOpenWizard={openQuickWizard}
      showWizard={true}
      autoShowTour={true}
    />
  );
}
