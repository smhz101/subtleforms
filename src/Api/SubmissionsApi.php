<?php

/**
 * SubtleForms Submissions REST API
 *
 * CRUD operations for submissions, logs, unread count, and CSV export.
 *
 * @package SubtleForms\Api
 * @since   1.9.0
 */

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Support\Helpers;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Tools\ReportQueries;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\ValidationException;
use SubtleForms\Validation\Schemas;
use WP_REST_Request;
use WP_REST_Response;

/**
 * REST API controller for submission operations.
 */
final class SubmissionsApi {

	use ApiGuards;

	private const NAMESPACE = 'subtleforms/v1';

	/** @var FormsRepository */
	private $formsRepo;

	/** @var SubmissionsRepository */
	private $submissionsRepo;

	/** @var FeatureGate */
	private $gate;

	public function __construct(
		FormsRepository $formsRepo,
		SubmissionsRepository $submissionsRepo,
		FeatureGate $gate
	) {
		$this->formsRepo       = $formsRepo;
		$this->submissionsRepo = $submissionsRepo;
		$this->gate            = $gate;
	}

	protected function getGate(): FeatureGate {
		return $this->gate;
	}

	/**
	 * Register REST API routes.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/forms/(?P<form_id>\d+)/submissions',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_submissions' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
				'args'                => array(
					'form_id'  => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'page'     => array(
						'type'              => 'integer',
						'default'           => 1,
						'sanitize_callback' => 'absint',
					),
					'per_page' => array(
						'type'              => 'integer',
						'default'           => 20,
						'sanitize_callback' => 'absint',
					),
					'status'   => array(
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'orderby'  => array(
						'type'              => 'string',
						'default'           => 'created_at',
						'sanitize_callback' => 'sanitize_key',
					),
					'order'    => array(
						'type'              => 'string',
						'default'           => 'DESC',
						'enum'              => array( 'ASC', 'DESC' ),
						'sanitize_callback' => static function ( $value ) { return strtoupper( $value ); },
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/submissions',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_all_submissions' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
				'args'                => array(
					'page'     => array(
						'type'              => 'integer',
						'default'           => 1,
						'sanitize_callback' => 'absint',
					),
					'per_page' => array(
						'type'              => 'integer',
						'default'           => 20,
						'sanitize_callback' => 'absint',
					),
					'form_id'  => array(
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
					'status'   => array(
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'search'   => array(
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'orderby'  => array(
						'type'              => 'string',
						'default'           => 'created_at',
						'sanitize_callback' => 'sanitize_key',
					),
					'order'      => array(
						'type'              => 'string',
						'default'           => 'DESC',
						'enum'              => array( 'ASC', 'DESC' ),
						'sanitize_callback' => static function ( $value ) { return strtoupper( $value ); },
					),
					'after'      => array(
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'range'      => array(
						'type'              => 'string',
						'enum'              => array( 'today', '7days', '30days', '3months' ),
						'sanitize_callback' => 'sanitize_text_field',
					),
					'field_key'  => array(
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_key',
					),
					'field_value' => array(
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'processing_status' => array(
						'type'              => 'string',
						'enum'              => array( 'completed', 'failed', 'payment_pending', 'processing', 'preview' ),
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/submissions/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_submission' ),
					'permission_callback' => array( $this, 'check_read_permission' ),
					'args'                => array(
						'id' => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
					),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( $this, 'update_submission' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
					'args'                => array(
						'id'     => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
						'status' => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( $this, 'delete_submission' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
					'args'                => array(
						'id'    => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
						// 2.3.1: entries go to the Trash; force=1 deletes for good.
						'force' => array(
							'type'    => 'boolean',
							'default' => false,
						),
					),
				),
			)
		);

		// Restore an entry from the Trash (2.3.1).
		register_rest_route(
			self::NAMESPACE,
			'/submissions/(?P<id>\d+)/restore',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'restore_submission' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
				'args'                => array(
					'id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/submissions/(?P<id>\d+)/adjacent',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_adjacent_submissions' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
				'args'                => array(
					'id'      => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'form_id' => array(
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/submissions/(?P<id>\d+)/logs',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_submission_logs' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
				'args'                => array(
					'id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/submissions/unread-count',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_unread_count' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		// 2.3.0: bulk actions, notes and resending notifications.
		register_rest_route(
			self::NAMESPACE,
			'/submissions/bulk',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'bulk_submissions' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
				'args'                => array(
					'ids'    => array(
						'type'     => 'array',
						'required' => true,
						'items'    => array( 'type' => 'integer' ),
					),
					'action' => array(
						'type'     => 'string',
						'required' => true,
						'enum'     => array( 'read', 'unread', 'star', 'unstar', 'spam', 'flagged', 'restore', 'trash', 'untrash', 'delete' ),
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/submissions/(?P<id>\d+)/notes',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'add_note' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
				'args'                => array(
					'id'   => array(
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
					'text' => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/submissions/(?P<id>\d+)/notes/(?P<note_id>[a-zA-Z0-9-]+)',
			array(
				'methods'             => 'DELETE',
				'callback'            => array( $this, 'delete_note' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/submissions/(?P<id>\d+)/resend',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'resend_notifications' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
				'args'                => array(
					'id' => array(
						'type'              => 'integer',
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		// A fresh nonce for the CSV download link, fetched just before the
		// download starts so a screen left open for days still exports (2.8.1).
		register_rest_route(
			self::NAMESPACE,
			'/submissions/export-nonce',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'export_nonce' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/submissions/export',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'export_submissions_csv' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
				'args'                => array(
					'form_id' => array(
						'type'              => 'integer',
						'required'          => false,
						'sanitize_callback' => 'absint',
					),
					'after'   => array(
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
					'range'   => array(
						'type'              => 'string',
						'enum'              => array( 'today', '7days', '30days', '3months' ),
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);
	}

	// ────────────────────────────────────────────────────────────────────
	// Handlers
	// ────────────────────────────────────────────────────────────────────

	/**
	 * Get submissions for a form.
	 */
	public function get_submissions( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$args = array(
			'form_id' => $request->get_param( 'form_id' ),
			'limit'   => intval( $request->get_param( 'per_page' ) ?? 20 ),
			'offset'  => intval( $request->get_param( 'offset' ) ?? 0 ),
			'orderby' => in_array( $request->get_param( 'orderby' ), array( 'id', 'created_at', 'updated_at', 'status' ), true ) ? $request->get_param( 'orderby' ) : 'created_at',
			'order'   => strtoupper( $request->get_param( 'order' ) ?? 'DESC' ) === 'ASC' ? 'ASC' : 'DESC',
		);

		$submissions = array_map( array( $this, 'listItem' ), $this->submissionsRepo->findAll( $args ) );
		$total       = $this->submissionsRepo->count( $args );

		return ApiResponse::paginated(
			$submissions,
			$total,
			( $args['offset'] / $args['limit'] ) + 1,
			$args['limit']
		);
	}

	/**
	 * Get all submissions with optional filtering.
	 */
	public function get_all_submissions( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$pagination = Schemas::validatePagination(
				array(
					'page'     => ( intval( $request->get_param( 'offset' ) ?? 0 ) / intval( $request->get_param( 'per_page' ) ?? 20 ) ) + 1,
					'per_page' => $request->get_param( 'per_page' ),
				)
			);
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		// Map tab-based status filter to the correct DB field.
		// 'unread'/'read' resolve to is_read column; 'spam'/'flagged' use status column.
		// A separate 'processing_status' param filters by pipeline status (completed/failed/etc).
		$tab_status  = $request->get_param( 'status' );
		$proc_status = $request->get_param( 'processing_status' );
		$status_arg  = null;
		$is_read_arg = null;

		if ( $tab_status === 'unread' || $tab_status === 'new' ) {
			$is_read_arg = 0;
		} elseif ( $tab_status === 'read' ) {
			$is_read_arg = 1;
		} elseif ( in_array( $tab_status, array( 'spam', 'flagged', 'trash' ), true ) ) {
			$status_arg = $tab_status;
		}
		$starred_arg = $tab_status === 'starred' ? 1 : null;

		// Processing status (filter bar), only applies when tab is 'all'
		if ( $proc_status && $status_arg === null && $is_read_arg === null && $tab_status !== 'starred' ) {
			$status_arg = $proc_status;
		}

		$args = array(
			'form_id'     => $request->get_param( 'form_id' ),
			'status'      => $status_arg,
			'is_read'     => $is_read_arg,
			'starred'     => $starred_arg,
			'search'      => $request->get_param( 'search' ),
			'after'       => ReportQueries::rangeStartUtc( (string) $request->get_param( 'range' ) ) ?? $request->get_param( 'after' ),
			'field_key'   => $request->get_param( 'field_key' ),
			'field_value' => $request->get_param( 'field_value' ),
			'limit'       => $pagination['per_page'],
			'offset'      => intval( $request->get_param( 'offset' ) ?? 0 ),
			'orderby'     => in_array( $request->get_param( 'orderby' ), array( 'id', 'created_at', 'updated_at', 'status' ), true ) ? $request->get_param( 'orderby' ) : 'created_at',
			'order'       => strtoupper( $request->get_param( 'order' ) ?? 'DESC' ) === 'ASC' ? 'ASC' : 'DESC',
		);

		$submissions = array_map( array( $this, 'listItem' ), $this->submissionsRepo->findAll( $args ) );
		$total       = $this->submissionsRepo->count( $args );

		// Bulk fetch form titles to avoid N+1
		$form_ids  = array_unique( array_filter( array_column( $submissions, 'form_id' ) ) );
		$forms_map = $this->formsRepo->findMultiple( $form_ids );

		foreach ( $submissions as &$sub ) {
			$form_id = Helpers::safe_array_get( $sub, 'form_id' );
			if ( $form_id && isset( $forms_map[ $form_id ] ) ) {
				$sub['form_title'] = Helpers::safe_array_get( $forms_map[ $form_id ], 'title', __( 'Unknown Form', 'subtleforms' ) );
			} else {
				$sub['form_title'] = __( 'Unknown Form', 'subtleforms' );
			}
		}

		return ApiResponse::paginated(
			$submissions,
			$total,
			( $args['offset'] / $args['limit'] ) + 1,
			$args['limit']
		);
	}

	/**
	 * Get a single submission (auto-marks as read).
	 */
	public function get_submission( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$submission = $this->submissionsRepo->find( $id );
		if ( ! $submission ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}

		// Auto-mark as read (track via is_read, not status)
		if ( intval( $submission['is_read'] ?? 0 ) === 0 ) {
			$this->submissionsRepo->update( $submission['id'], array( 'is_read' => 1 ) );
			$submission['is_read'] = 1;
		}

		// Enhance with form info
		if ( $submission['form_id'] ) {
			$form                     = $this->formsRepo->find( $submission['form_id'] );
			$submission['form_title'] = $form['title'] ?? __( 'Unknown Form', 'subtleforms' );

			// The schema version the entry was made with; older entries
			// may still carry a copy of it (FF-30).
			$submission['schema'] = \SubtleForms\Support\EntrySchema::forEntry( $submission, $this->formsRepo );

			$adjacent              = $this->submissionsRepo->getAdjacentIds( $submission['id'], $submission['form_id'] );
			$submission['next_id'] = $adjacent['next'];
			$submission['prev_id'] = $adjacent['prev'];
		}

		$submission = $this->redactSecrets( $submission );
		if ( is_array( $submission['meta'] ?? null ) ) {
			$submission['meta'] = \SubtleForms\Support\EntrySchema::stripCopy( $submission['meta'] );
		}
		// Answers as the entry screen shows them, from the same formatter as
		// emails, CSV, PDF and integrations (2.4.0).
		$submission['display'] = \SubtleForms\Support\AnswerFormatter::display(
			is_array( $submission['schema'] ?? null ) ? $submission['schema'] : array(),
			is_array( $submission['payload'] ?? null ) ? $submission['payload'] : array(),
			\SubtleForms\Support\AnswerFormatter::entryContext(
				is_array( $submission['schema'] ?? null ) ? $submission['schema'] : array(),
				$submission,
				array( 'submission_id' => (int) $submission['id'] )
			)
		);
		if ( isset( $submission['meta']['notes'] ) && is_array( $submission['meta']['notes'] ) ) {
			$submission['meta']['notes'] = array_map( array( self::class, 'presentNote' ), $submission['meta']['notes'] );
		}

		$etag     = $this->generateETag( $submission, 'submission' );
		$response = ApiResponse::success( $submission );
		return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
	}

	/**
	 * Update a submission.
	 */
	public function update_submission( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$submission = $this->submissionsRepo->find( $id );
		if ( ! $submission ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}

		$conflictResponse = $this->guardIfMatch( $request, $submission, 'submission' );
		if ( $conflictResponse ) {
			return $conflictResponse;
		}

		$input = $request->get_json_params();
		try {
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $input, Schemas::get( Schemas::SUBMISSION_UPDATE ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$data = array_filter(
			array(
				'status'  => $validated['status'] ?? null,
				'is_read' => isset( $validated['is_read'] ) ? intval( $validated['is_read'] ) : null,
				'starred' => isset( $validated['starred'] ) ? (bool) $validated['starred'] : null,
				'notes'   => $validated['notes'] ?? null,
			),
			fn( $value ) => $value !== null
		);

		if ( empty( $data ) ) {
			return ApiResponse::bad_request( __( 'No valid changes provided', 'subtleforms' ) );
		}
		// An entry in the Trash only leaves it through Restore (2.3.1).
		if ( isset( $data['status'] ) && ( $submission['status'] ?? '' ) === SubmissionsRepository::TRASH ) {
			return ApiResponse::validation_error( __( 'Restore this entry from the Trash first.', 'subtleforms' ) );
		}

		$this->submissionsRepo->update( $id, $data );

		$updatedSubmission = $this->submissionsRepo->find( $id );
		$etag              = $this->generateETag( $updatedSubmission, 'submission' );
		$response          = ApiResponse::success( array( 'success' => true, 'submission' => $updatedSubmission ) );
		return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
	}

	/**
	 * Apply one action to several entries (2.3.0).
	 */
	public function bulk_submissions( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$ids    = array_values( array_unique( array_filter( array_map( 'absint', (array) $request->get_param( 'ids' ) ) ) ) );
		$action = (string) $request->get_param( 'action' );
		if ( ! $ids ) {
			return ApiResponse::bad_request( __( 'Select at least one entry.', 'subtleforms' ) );
		}
		if ( count( $ids ) > 500 ) {
			return ApiResponse::bad_request( __( 'Select 500 entries or fewer at a time.', 'subtleforms' ) );
		}

		$changes = array(
			'read'    => array( 'is_read' => 1 ),
			'unread'  => array( 'is_read' => 0 ),
			'star'    => array( 'starred' => true ),
			'unstar'  => array( 'starred' => false ),
			'spam'    => array( 'status' => 'spam' ),
			'flagged' => array( 'status' => 'flagged' ),
			'restore' => array( 'status' => 'none' ),
		);

		$done = array();
		foreach ( $ids as $id ) {
			$row = $this->submissionsRepo->find( $id );
			if ( ! $row ) {
				continue;
			}
			$inTrash = ( $row['status'] ?? '' ) === SubmissionsRepository::TRASH;
			try {
				if ( $action === 'trash' ) {
					$settings = get_option( 'subtleforms_settings', array() );
					$behavior = is_array( $settings ) ? (string) ( $settings['delete_behavior'] ?? 'soft' ) : 'soft';
					if ( \SubtleForms\Support\Settings::deletionMode( $behavior, false ) === 'delete' ) {
						if ( $this->submissionsRepo->delete( $id ) ) {
							( new \SubtleForms\Repositories\LogsRepository() )->deleteBySubmission( $id );
							$done[] = $id;
						}
					} elseif ( $this->submissionsRepo->trash( $id ) ) {
						$done[] = $id;
					}
				} elseif ( $action === 'untrash' ) {
					if ( $inTrash && false !== $this->submissionsRepo->untrash( $id ) ) {
						$done[] = $id;
					}
				} elseif ( $inTrash && $action !== 'delete' ) {
					// Entries in the Trash are only restored or deleted.
					continue;
				} elseif ( $action === 'delete' ) {
					if ( $this->submissionsRepo->delete( $id ) ) {
						( new \SubtleForms\Repositories\LogsRepository() )->deleteBySubmission( $id );
						$done[] = $id;
					}
				} elseif ( isset( $changes[ $action ] ) ) {
					$this->submissionsRepo->update( $id, $changes[ $action ] );
					$done[] = $id;
				}
			} catch ( \RuntimeException $e ) {
				continue;
			}
		}

		return ApiResponse::success(
			array(
				'action'  => $action,
				'updated' => $done,
				'count'   => count( $done ),
			)
		);
	}

	/**
	 * Add a private note to an entry (2.3.0).
	 */
	public function add_note( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$id   = absint( $request->get_param( 'id' ) );
		$text = sanitize_textarea_field( (string) $request->get_param( 'text' ) );
		if ( trim( $text ) === '' ) {
			return ApiResponse::validation_error( __( 'Write a note first.', 'subtleforms' ), array( 'text' => __( 'Write a note first.', 'subtleforms' ) ) );
		}
		if ( mb_strlen( $text ) > 5000 ) {
			$text = mb_substr( $text, 0, 5000 );
		}

		$note = $this->submissionsRepo->addNote( $id, $text, get_current_user_id() );
		if ( ! $note ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}

		return ApiResponse::success( self::presentNote( $note ), 201 );
	}

	/**
	 * Remove a note from an entry.
	 */
	public function delete_note( WP_REST_Request $request ): WP_REST_Response {
		$id     = absint( $request->get_param( 'id' ) );
		$noteId = preg_replace( '/[^a-zA-Z0-9-]/', '', (string) $request->get_param( 'note_id' ) );
		if ( ! $this->submissionsRepo->deleteNote( $id, (string) $noteId ) ) {
			return ApiResponse::not_found( __( 'Note not found', 'subtleforms' ) );
		}
		return ApiResponse::success( array( 'deleted' => true ) );
	}

	/**
	 * A note with its author's name, for the entry screen.
	 *
	 * @param array $note Stored note.
	 * @return array
	 */
	public static function presentNote( array $note ): array {
		$user                  = ! empty( $note['author'] ) ? get_userdata( (int) $note['author'] ) : null;
		$note['author_name']   = $user ? $user->display_name : __( 'Unknown user', 'subtleforms' );
		$note['author_avatar'] = $user ? get_avatar_url( $user->ID, array( 'size' => 48 ) ) : '';
		return $note;
	}

	/**
	 * Send an entry's email notifications again (2.3.0).
	 *
	 * Runs the form's enabled email actions with the stored answers. "Only
	 * when" conditions still apply. Passwords are not stored, so they are
	 * never in the resent emails either.
	 */
	public function resend_notifications( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$id         = absint( $request->get_param( 'id' ) );
		$submission = $this->submissionsRepo->find( $id );
		if ( ! $submission ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}
		// Entries in the Trash send nothing (2.3.1).
		if ( ( $submission['status'] ?? '' ) === SubmissionsRepository::TRASH ) {
			return ApiResponse::validation_error( __( 'Restore this entry from the Trash before resending its notifications.', 'subtleforms' ) );
		}

		// The entry's own schema version, else the copy an older entry
		// carries, else the active schema (FF-30).
		$schema = \SubtleForms\Support\EntrySchema::forEntry( $submission, $this->formsRepo );
		if ( ! is_array( $schema ) ) {
			return ApiResponse::not_found( __( 'This entry’s form could not be loaded.', 'subtleforms' ) );
		}

		$plugin   = \SubtleForms\Plugin::instance();
		$compiler = $plugin->get( \SubtleForms\Engine\SchemaCompiler::class );
		$pipeline = $plugin->get( \SubtleForms\Engine\Pipeline::class );

		$steps = array_values(
			array_filter(
				$compiler->compile( $schema ),
				static fn( $step ) => $step->action()->id() === 'email'
			)
		);
		if ( ! $steps ) {
			return ApiResponse::bad_request( __( 'This form has no email notifications to send.', 'subtleforms' ) );
		}

		$payload = is_array( $submission['payload'] ?? null ) ? $submission['payload'] : array();
		$context = new \SubtleForms\Engine\SubmissionContext( (int) $submission['form_id'], $payload );
		$context->setMeta( 'submission_id', $id );
		$context->setMeta( 'schema_version', isset( $submission['schema_version'] ) ? (int) $submission['schema_version'] : null );
		$context->setMeta( 'form_schema', $schema );
		$context->setMeta( 'resent', true );

		$result = $pipeline->run( $steps, $context, $schema );
		$failures = $context->getMeta( 'action_failures', array() );
		$summary  = self::resendResult( (bool) $result->ok, count( $steps ), is_array( $failures ) ? $failures : array() );
		if ( ! $summary['sent'] ) {
			return ApiResponse::server_error( __( 'The notifications could not be sent.', 'subtleforms' ) );
		}

		return ApiResponse::success( $summary );
	}

	/**
	 * Permanently delete a submission, its logs and its uploaded files.
	 */
	public function delete_submission( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$id = absint( $request->get_param( 'id' ) );
		if ( ! $id || ! $this->submissionsRepo->find( $id ) ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}

		$row = $this->submissionsRepo->find( $id );
		$alreadyTrashed = is_array( $row ) && ( $row['status'] ?? '' ) === SubmissionsRepository::TRASH;
		$settings = get_option( 'subtleforms_settings', array() );
		$behavior = is_array( $settings ) ? (string) ( $settings['delete_behavior'] ?? 'soft' ) : 'soft';
		// The setting decides. An entry already in the Trash is deleted for good.
		// force still deletes from the Trash tab.
		$forced = rest_sanitize_boolean( $request->get_param( 'force' ) ) && $alreadyTrashed;
		if ( \SubtleForms\Support\Settings::deletionMode( $behavior, $alreadyTrashed || $forced ) === 'trash' ) {
			if ( ! $this->submissionsRepo->trash( $id ) ) {
				return ApiResponse::server_error( __( 'The submission could not be moved to the Trash.', 'subtleforms' ) );
			}
			return ApiResponse::success(
				array(
					'trashed' => true,
					'id'      => $id,
				)
			);
		}

		if ( ! $this->submissionsRepo->delete( $id ) ) {
			return ApiResponse::server_error( __( 'The submission could not be deleted.', 'subtleforms' ) );
		}
		( new \SubtleForms\Repositories\LogsRepository() )->deleteBySubmission( $id );

		return ApiResponse::success(
			array(
				'deleted' => true,
				'id'      => $id,
			)
		);
	}

	/**
	 * Restore an entry from the Trash to its previous status (2.3.1).
	 */
	public function restore_submission( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$id  = absint( $request->get_param( 'id' ) );
		$row = $id ? $this->submissionsRepo->find( $id ) : null;
		if ( ! $row ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}
		if ( ( $row['status'] ?? '' ) !== SubmissionsRepository::TRASH ) {
			return ApiResponse::validation_error( __( 'This entry is not in the Trash.', 'subtleforms' ) );
		}
		$status = $this->submissionsRepo->untrash( $id );
		if ( false === $status ) {
			return ApiResponse::server_error( __( 'The entry could not be restored. Please try again.', 'subtleforms' ) );
		}
		return ApiResponse::success(
			array(
				'restored' => true,
				'id'       => $id,
				'status'   => $status,
			)
		);
	}

	/**
	 * Get adjacent submission IDs.
	 */
	public function get_adjacent_submissions( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$id     = intval( $request->get_param( 'id' ) );
		$formId = $request->get_param( 'form_id' ) ? intval( $request->get_param( 'form_id' ) ) : null;

		$submission = $this->submissionsRepo->find( $id );
		if ( ! $submission ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}

		$adjacent = $this->submissionsRepo->getAdjacentIds( $id, $formId );

		return ApiResponse::success( $adjacent );
	}

	/**
	 * Get execution logs for a submission.
	 */
	public function get_submission_logs( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$submissionId = intval( $request->get_param( 'id' ) );

		$submission = $this->submissionsRepo->find( $submissionId );
		if ( ! $submission ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}

		$logsRepo = new \SubtleForms\Repositories\LogsRepository();
		$logs     = $logsRepo->findBySubmission(
			$submissionId,
			array(
				'limit'   => $request->get_param( 'per_page' ) ?? 100,
				'offset'  => $request->get_param( 'offset' ) ?? 0,
				'orderby' => 'created_at',
				'order'   => 'ASC',
			)
		);

		return ApiResponse::success( $logs );
	}

	/**
	 * Unread count filters. A form filter counts only that form.
	 *
	 * @param mixed $formId Form id, or empty for every form.
	 * @return array
	 */
	public static function unreadCountArgs( $formId ): array {
		$args   = array( 'is_read' => 0 );
		$formId = (int) $formId;
		if ( $formId > 0 ) {
			$args['form_id'] = $formId;
		}
		return $args;
	}

	/**
	 * What Resend should tell the browser. A dispatch that cron refused is not sent.
	 *
	 * @param bool  $ok Pipeline finished.
	 * @param int   $steps Email steps that were run.
	 * @param array $failures action_failures from the context.
	 * @return array{sent: bool, count: int}
	 */
	public static function resendResult( bool $ok, int $steps, array $failures ): array {
		$failed = 0;
		foreach ( $failures as $failure ) {
			if ( is_array( $failure ) && ( $failure['reason'] ?? '' ) === 'async_dispatch_failed' && ( $failure['action'] ?? '' ) === 'email' ) {
				++$failed;
			}
		}
		$queued = max( 0, $steps - $failed );
		return array(
			'sent'  => $ok && $failed < $steps && $queued > 0,
			'count' => $queued,
		);
	}

	/**
	 * Get the unread count and the count of every tab (one request).
	 */
	public function get_unread_count( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$counts = $this->submissionsRepo->tabCounts( $request->get_param( 'form_id' ) );

			return ApiResponse::success(
				array(
					'count'     => $counts['unread'],
					'counts'    => $counts,
					'timestamp' => current_time( 'mysql' ),
				)
			);
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( __( 'Error fetching unread count', 'subtleforms' ) );
		}
	}

	/**
	 * Export submissions as CSV, returned as base64 inside JSON.
	 *
	 * @deprecated 2.8.1 The whole file is built in memory, so a very large
	 *             export can run out of it. The screens download from
	 *             admin-post.php?action=subtleforms_export_csv instead, which
	 *             streams the file (see downloadCsv()), also for the selected
	 *             entries (a POST with the IDs in the body). This route stays for
	 *             one release for add-ons that call it. Remove it in the next
	 *             release.
	 *
	 * Columns are the union of every exported entry's answers, so a form whose
	 * fields changed over time keeps all of its data. When one form is
	 * exported, its field labels and order are used for the headings.
	 */
	public function export_submissions_csv( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$params = $request->get_json_params();
		$params = is_array( $params ) ? $params : array();

		$args = $this->exportQuery( $params );
		if ( null === $args ) {
			return ApiResponse::success(
				array(
					'success' => false,
					'message' => __( 'No submissions to export', 'subtleforms' ),
				)
			);
		}
		// What the file should hold. A shortfall (entries deleted while the
		// export ran) is reported in the response.
		$total = $this->submissionsRepo->count( $args );

		if ( function_exists( 'wp_raise_memory_limit' ) ) {
			wp_raise_memory_limit( 'admin' );
		}

		$handle = fopen( 'php://temp', 'r+' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- An in-memory stream, not a file.
		$count  = $this->writeCsv( $args, $handle );
		rewind( $handle );
		$csv_string = (string) stream_get_contents( $handle );
		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- Closes the in-memory stream.

		$filename = 'subtleforms-submissions-' . gmdate( 'Y-m-d-His' ) . '.csv';
		$encoded  = base64_encode( $csv_string ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Binary-safe transport of the CSV file in JSON.
		// The plain copy is not needed once encoded; free it before the
		// response is built so both are not held through the send.
		unset( $csv_string );

		return ApiResponse::success(
			array(
				'success'  => true,
				'csv'      => $encoded,
				'filename' => $filename,
				'rows'     => $count,
				'total'    => max( $total, $count ),
			)
		);
	}

	/**
	 * The query arguments for an export: filters from a request, minus the
	 * Trash, capped at the newest entry that exists now so rows added while the
	 * file is written are left out.
	 *
	 * @param array $params form_id, status, search, range, after, ids.
	 * @return array|null Query arguments, or null when nothing matches.
	 */
	private function exportQuery( array $params ): ?array {
		$args = array(
			'form_id' => ! empty( $params['form_id'] ) ? intval( $params['form_id'] ) : null,
			'status'  => isset( $params['status'] ) ? Helpers::safe_sanitize_text( $params['status'] ) : null,
			'search'  => isset( $params['search'] ) ? Helpers::safe_sanitize_text( $params['search'] ) : null,
			'after'   => ReportQueries::rangeStartUtc( (string) ( $params['range'] ?? '' ) ) ?? ( isset( $params['after'] ) ? Helpers::safe_sanitize_text( $params['after'] ) : null ),
			// Export selected (2.3.0).
			'ids'     => isset( $params['ids'] ) && is_array( $params['ids'] ) ? array_map( 'absint', $params['ids'] ) : null,
			'orderby' => 'created_at',
			'order'   => 'DESC',
		);

		$args = array_filter( $args, fn( $value ) => $value !== null && $value !== '' );
		// Entries in the Trash are never exported (2.3.1).
		if ( ( $args['status'] ?? '' ) === SubmissionsRepository::TRASH ) {
			unset( $args['status'] );
		}

		// Every matching entry is exported, however many there are (2.8.1: the
		// file used to stop at the newest 10,000 without a word). They are read
		// EXPORT_CHUNK at a time, so no query or payload list grows with the
		// export, and only entries that existed when it started are included.
		$newest = $this->submissionsRepo->findAll( array_merge( $args, array( 'orderby' => 'id', 'order' => 'DESC', 'limit' => 1 ) ) );
		if ( empty( $newest ) ) {
			return null;
		}
		$args['max_id'] = (int) $newest[0]['id'];
		return $args;
	}

	/**
	 * Write the CSV for one form (or all, with 0) to a stream, one chunk of
	 * entries at a time, and return the number of entries written.
	 *
	 * Nothing accumulates: each chunk is written and dropped, so memory stays
	 * flat however many entries there are. $afterChunk runs after each chunk is
	 * written (the download flushes the output there).
	 *
	 * @param int           $formId     Form ID, 0 for every form.
	 * @param array         $filters    status, search, range, after, ids.
	 * @param resource      $handle     Open stream to write to.
	 * @param callable|null $afterChunk Called after each chunk is written.
	 * @return int Entries written (0 when nothing matches; nothing is written then).
	 */
	public function streamCsv( int $formId, array $filters, $handle, ?callable $afterChunk = null ): int {
		$args = $this->exportQuery( array_merge( $filters, array( 'form_id' => $formId ) ) );
		return null === $args ? 0 : $this->writeCsv( $args, $handle, $afterChunk );
	}

	/**
	 * A fresh nonce for the CSV download address.
	 *
	 * @return WP_REST_Response
	 */
	public function export_nonce(): WP_REST_Response {
		return ApiResponse::success( array( 'nonce' => wp_create_nonce( self::EXPORT_NONCE_ACTION ) ) );
	}

	/**
	 * Download the CSV as a file, streamed (admin-post.php?action=subtleforms_export_csv).
	 *
	 * Replaces the JSON export for the Entries screen and Tools (2.8.1). Needs
	 * a signed-in administrator and the nonce the admin screens are given.
	 * A GET carries the filters in the query string: form_id, status, search,
	 * range, after. A POST carries the IDs of the selected entries in the body
	 * (ids[]), so a long selection does not have to fit in an address.
	 *
	 * A refusal (nothing to export, an old nonce, no permission) sends the
	 * browser back to the screen it came from with sf_export=empty|expired|forbidden,
	 * which the screen turns into a notice. Without a screen to go back to it
	 * stops with a plain error page.
	 */
	public function downloadCsv(): void {
		$request = $this->exportRequest();

		$slug = '';
		if ( $request['form_id'] > 0 ) {
			$form = $this->formsRepo->find( $request['form_id'] );
			$slug = sanitize_title( (string) ( $form['title'] ?? '' ) );
		}
		$filename = ( '' !== $slug ? $slug : 'subtleforms' ) . '-entries-' . gmdate( 'Y-m-d' ) . '.csv';

		if ( function_exists( 'wp_raise_memory_limit' ) ) {
			wp_raise_memory_limit( 'admin' );
		}
		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 0 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- A host may forbid it; the file is still written.
		}
		// Output buffers would hold the whole file back until the end.
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . str_replace( '"', '', $filename ) . '"' );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'X-Accel-Buffering: no' ); // Tell nginx not to buffer the stream.

		$out = fopen( 'php://output', 'w' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- The response stream, not a file.
		$this->writeCsv( $request['args'], $out, static function (): void {
			flush();
		} );
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- Closes the response stream.
		exit;
	}

	/**
	 * Check a download request and work out what it asks for.
	 *
	 * Ends the request itself (see refuseExport()) when the user may not
	 * export, the nonce is not good, or nothing matches.
	 *
	 * @internal Public so the tests can read the outcome without serving a file.
	 * @return array{args: array, form_id: int}
	 */
	public function exportRequest(): array {
		$post = isset( $_SERVER['REQUEST_METHOD'] ) && 'POST' === strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) );

		if ( ! is_user_logged_in() || ! current_user_can( 'manage_options' ) ) {
			$this->refuseExport( 'forbidden', __( 'You are not allowed to perform this action.', 'subtleforms' ), 403 );
		}
		// phpcs:disable WordPress.Security.NonceVerification -- The nonce is verified right below.
		$source = $post ? $_POST : $_GET;
		$nonce  = isset( $source['_wpnonce'] ) && is_string( $source['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $source['_wpnonce'] ) ) : '';
		if ( '' === $nonce || ! wp_verify_nonce( $nonce, self::EXPORT_NONCE_ACTION ) ) {
			$this->refuseExport( 'expired', __( 'The export link expired. Reload the page and try again.', 'subtleforms' ), 403 );
		}

		$formId  = 0;
		$filters = array();
		if ( $post ) {
			// The selected entries. An empty selection must not become "everything".
			$ids = isset( $source['ids'] ) && is_array( $source['ids'] ) ? array_values( array_filter( array_map( 'absint', array_filter( wp_unslash( $source['ids'] ), 'is_scalar' ) ) ) ) : array();
			if ( empty( $ids ) ) {
				$this->refuseExport( 'empty', __( 'No submissions to export', 'subtleforms' ), 404 );
			}
			$filters['ids'] = $ids;
		} else {
			$formId = isset( $source['form_id'] ) ? absint( $source['form_id'] ) : 0;
			foreach ( array( 'status', 'search', 'range', 'after' ) as $key ) {
				if ( isset( $source[ $key ] ) && is_string( $source[ $key ] ) ) {
					$filters[ $key ] = sanitize_text_field( wp_unslash( $source[ $key ] ) );
				}
			}
		}
		// phpcs:enable WordPress.Security.NonceVerification

		$args = $this->exportQuery( array_merge( $filters, array( 'form_id' => $formId ) ) );
		if ( null === $args ) {
			$this->refuseExport( 'empty', __( 'No submissions to export', 'subtleforms' ), 404 );
		}
		return array(
			'args'    => $args,
			'form_id' => $formId,
		);
	}

	/**
	 * End a download request that cannot be served.
	 *
	 * Goes back to the screen the request came from with sf_export=<reason>, so
	 * the person sees a notice instead of a failed download. When there is no
	 * screen to go back to (the address was opened by hand), it stops with a
	 * plain error page.
	 *
	 * @param string $reason  empty, expired or forbidden.
	 * @param string $message Text for the error page.
	 * @param int    $status  HTTP status for the error page.
	 */
	private function refuseExport( string $reason, string $message, int $status ): void {
		$back = wp_get_referer();
		if ( $back ) {
			wp_safe_redirect( add_query_arg( 'sf_export', $reason, remove_query_arg( 'sf_export', $back ) ) );
			exit;
		}
		wp_die( esc_html( $message ), '', array( 'response' => absint( $status ) ) );
	}

	/** Nonce action for the CSV download link. */
	public const EXPORT_NONCE_ACTION = 'subtleforms_export_csv';

	/**
	 * Write the header and every entry of an export query to a stream.
	 *
	 * @param array         $args       From exportQuery().
	 * @param resource      $handle     Open stream.
	 * @param callable|null $afterChunk Called after each chunk is read and written.
	 * @return int Entries written.
	 */
	private function writeCsv( array $args, $handle, ?callable $afterChunk = null ): int {
		/**
		 * Call $each( $submission ) for every matching entry, newest first.
		 *
		 * @param callable $each Receives one entry row.
		 */
		$walk = function ( callable $each ) use ( $args, $afterChunk ): void {
			$cursor = null;
			do {
				// Keyset paging on (created_at, id): each query starts after the
				// last entry of the previous one instead of counting rows to skip.
				if ( function_exists( 'set_time_limit' ) ) {
					@set_time_limit( 60 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- A host may forbid it; the export still runs within its own limit.
				}
				$chunk = $this->submissionsRepo->findAll( array_merge( $args, array( 'limit' => self::EXPORT_CHUNK, 'offset' => 0, 'cursor' => $cursor ) ) );
				foreach ( $chunk as $submission ) {
					$each( $submission );
				}
				$last   = end( $chunk );
				$cursor = $last ? array( 'created_at' => $last['created_at'], 'id' => (int) $last['id'] ) : null;
				$size   = count( $chunk );
				unset( $chunk, $last );
				// Query logging (SAVEQUERIES) would keep every chunk's SQL.
				global $wpdb;
				if ( ! empty( $wpdb->queries ) ) {
					$wpdb->queries = array();
				}
				if ( $afterChunk ) {
					$afterChunk();
				}
			} while ( self::EXPORT_CHUNK === $size );
		};

		$skip = array( 'website_url', 'form_rendered_at' );

		// Column order: the form's fields (single-form export), then any other
		// answer keys in the order they were first seen.
		$labels    = array();
		$repeaters = array();
		if ( ! empty( $args['form_id'] ) ) {
			try {
				$active = $this->formsRepo->loadSchemaVersion( (int) $args['form_id'] );
				$schema = is_array( $active ) ? ( $active['schema'] ?? $active ) : array();
				foreach ( \SubtleForms\Support\FieldMapper::fields( is_array( $schema ) ? $schema : array() ) as $field ) {
					$labels[ $field['key'] ] = '' !== $field['label'] ? $field['label'] : $field['key'];
					if ( \SubtleForms\Support\Repeater::TYPE === $field['type'] ) {
						$repeaters[ $field['key'] ] = $field['field'];
					}
				}
			} catch ( \Throwable $e ) {
				$labels = array();
			}
		}

		// The byte order mark does not depend on the columns, so it goes out
		// now (and the response headers with it). Behind a proxy that gives up
		// when the first byte is slow (Cloudflare waits 100 seconds), a very
		// large export would otherwise time out while the columns are read.
		fwrite( $handle, "\xEF\xBB\xBF" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- A stream, not a file.
		if ( $afterChunk ) {
			$afterChunk();
		}

		// First pass: the columns. The answers of an entry are not kept.
		$keys = array();
		$walk(
			function ( array $submission ) use ( &$keys, $skip ): void {
				$payload = $this->exportPayload( $submission );
				foreach ( array_keys( $payload ) as $key ) {
					$key = (string) $key;
					if ( '' === $key || '_' === $key[0] || in_array( $key, $skip, true ) ) {
						continue;
					}
					$keys[ $key ] = true;
				}
			}
		);

		$ordered = array();
		foreach ( array_keys( $labels ) as $key ) {
			if ( isset( $keys[ $key ] ) ) {
				$ordered[] = $key;
			}
		}
		foreach ( array_keys( $keys ) as $key ) {
			if ( ! in_array( $key, $ordered, true ) ) {
				$ordered[] = $key;
			}
		}

		$headers = array(
			__( 'ID', 'subtleforms' ),
			__( 'Form ID', 'subtleforms' ),
			__( 'Status', 'subtleforms' ),
			__( 'Submitted At', 'subtleforms' ),
		);
		// A Repeater gets one column per child; each group is one line of
		// the cell, in the same order in every column (2.3.1).
		foreach ( $ordered as $key ) {
			$label = $labels[ $key ] ?? ucwords( str_replace( array( '_', '-' ), ' ', $key ) );
			if ( isset( $repeaters[ $key ] ) ) {
				foreach ( \SubtleForms\Support\Repeater::childFields( $repeaters[ $key ] ) as $child ) {
					$headers[] = $label . ': ' . ( '' !== $child['label'] ? $child['label'] : $child['key'] );
				}
				continue;
			}
			$headers[] = $label;
		}

		// The heading line, after the columns are known. Lines are written with
		// csv_cell() (every cell quoted and formula-protected), the same bytes
		// as before the export was streamed (the UTF-8 BOM, for Excel, is the
		// start of the file and was written above).
		fwrite( $handle, implode( ',', array_map( array( $this, 'csv_cell' ), $headers ) ) . "\r\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- A stream, not a file.
		$fieldMaps   = array();
		$count       = 0;
		// Second pass: the rows, added to the file as each entry is read.
		$walk(
			function ( array $submission ) use ( $handle, &$fieldMaps, &$count, $ordered, $repeaters ): void {
				$payload = $this->exportPayload( $submission );
				$row = array(
					$submission['id'],
					$submission['form_id'],
					$submission['status'],
					$submission['created_at'],
				);
				// Each entry is read with the schema version it was made with,
				// through the one answer formatter: labels, Yes/No, matrix rows,
				// dates in the field format, file names with links (2.4.0). A
				// drawn signature reads "Signed" (2.3.3).
				$schema  = \SubtleForms\Support\EntrySchema::forEntry( $submission, $this->formsRepo ) ?? array();
				$mapKey  = (int) $submission['form_id'] . ':' . ( $submission['schema_version'] ?? ( 'legacy-entry-' . $submission['id'] ) );
				if ( ! isset( $fieldMaps[ $mapKey ] ) ) {
					$fieldMaps[ $mapKey ] = array();
					foreach ( \SubtleForms\Support\FieldMapper::fields( $schema ) as $field ) {
						$fieldMaps[ $mapKey ][ $field['key'] ] = $field['field'];
					}
				}
				$fields  = $fieldMaps[ $mapKey ];
				$display = \SubtleForms\Support\AnswerFormatter::entryContext(
					$schema,
					$submission,
					array(
						'submission_id' => (int) $submission['id'],
						'links'         => true,
						'signature'     => 'short',
					)
				);
				foreach ( $ordered as $key ) {
					if ( isset( $repeaters[ $key ] ) ) {
						// Format with the entry's own version of the Repeater, then
						// fill the columns of the current version in header order:
						// a child added or removed since leaves its cell empty
						// instead of shifting the others.
						$cells = \SubtleForms\Support\Repeater::csvCells( $payload[ $key ] ?? array(), $fields[ $key ] ?? $repeaters[ $key ], $display );
						foreach ( \SubtleForms\Support\Repeater::childFields( $repeaters[ $key ] ) as $child ) {
							$row[] = $cells[ $child['key'] ] ?? '';
						}
						continue;
					}
					$value = $payload[ $key ] ?? '';
					if ( isset( $fields[ $key ] ) ) {
						$row[] = \SubtleForms\Support\AnswerFormatter::text( $value, $fields[ $key ], $display );
						continue;
					}
					// Not in the schema (exports of several forms, or a field since
					// removed): groups read as numbered lines.
					$row[] = \SubtleForms\Support\Repeater::looksLikeGroups( $value ) && null === \SubtleForms\Support\AnswerFormatter::items( $value, array(), $display )
						? $this->groupsText( $value )
						: \SubtleForms\Support\AnswerFormatter::text( $value, array(), $display );
				}
				fwrite( $handle, implode( ',', array_map( array( $this, 'csv_cell' ), $row ) ) . "\r\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- A stream, not a file.
				++$count;
			}
		);

		return $count;
	}

	/**
	 * Entries read per query by the CSV export.
	 */
	const EXPORT_CHUNK = 2000;

	/**
	 * The answers of one entry as the export reads them: decoded, and without
	 * the answers of password fields (2.2.1).
	 *
	 * @param array $submission Entry row.
	 * @return array
	 */
	private function exportPayload( array $submission ): array {
		$payload = is_string( $submission['payload'] ?? null )
			? json_decode( $submission['payload'], true )
			: ( $submission['payload'] ?? array() );
		$payload = is_array( $payload ) ? $payload : array();
		foreach ( $this->secretKeysForForm( (int) ( $submission['form_id'] ?? 0 ) ) as $secret ) {
			unset( $payload[ $secret ] );
		}
		return $payload;
	}

	/**
	 * One entry in a list response: secrets redacted, and no schema copy
	 * from an entry saved before 2.4.0 (FF-30).
	 *
	 * @param mixed $submission Submission row.
	 * @return mixed
	 */
	public function listItem( $submission ) {
		$submission = $this->redactSecrets( $submission );
		if ( is_array( $submission ) && is_array( $submission['meta'] ?? null ) ) {
			$submission['meta'] = \SubtleForms\Support\EntrySchema::stripCopy( $submission['meta'] );
		}
		return $submission;
	}

	/**
	 * Replace stored password values with a readable label.
	 *
	 * A password is never stored as typed; even its hash (when a field opts
	 * in) is not sent to the browser. The entry shows "Password provided".
	 *
	 * @param mixed $submission Submission row.
	 * @return mixed
	 */
	public function redactSecrets( $submission ) {
		if ( ! is_array( $submission ) ) {
			return $submission;
		}
		$payload = $submission['payload'] ?? null;
		if ( is_string( $payload ) ) {
			$payload = json_decode( $payload, true );
		}
		if ( ! is_array( $payload ) ) {
			return $submission;
		}
		$keys = $this->secretKeysForForm( (int) ( $submission['form_id'] ?? 0 ) );
		if ( isset( $submission['schema'] ) && is_array( $submission['schema'] ) ) {
			$keys = array_merge( $keys, \SubtleForms\Support\EntryValues::secretKeys( $submission['schema'] ) );
		}
		$changed = false;
		foreach ( array_unique( $keys ) as $key ) {
			if ( array_key_exists( $key, $payload ) ) {
				$payload[ $key ] = \SubtleForms\Support\EntryValues::passwordLabel( $payload[ $key ] );
				$changed         = true;
			}
		}
		if ( $changed ) {
			$submission['payload'] = $payload;
		}
		return $submission;
	}

	/**
	 * Keys of a form's secret (password) fields, cached per request.
	 *
	 * Every schema version is checked, so a password field removed since an
	 * entry was made is still left out.
	 *
	 * @param int $formId Form ID.
	 * @return string[]
	 */
	private function secretKeysForForm( int $formId ): array {
		static $cache = array();
		if ( $formId <= 0 ) {
			return array();
		}
		if ( isset( $cache[ $formId ] ) ) {
			return $cache[ $formId ];
		}
		$keys = array();
		try {
			$versions = $this->formsRepo->getSchemaVersions( $formId );
			foreach ( (array) $versions as $version ) {
				$number = is_array( $version ) ? (int) ( $version['version'] ?? 0 ) : (int) $version;
				$loaded = $number > 0 ? $this->formsRepo->loadSchemaVersion( $formId, $number ) : null;
				$schema = is_array( $loaded ) ? ( $loaded['schema'] ?? $loaded ) : array();
				$keys   = array_merge( $keys, \SubtleForms\Support\EntryValues::secretKeys( is_array( $schema ) ? $schema : array() ) );
			}
			if ( ! $keys ) {
				$loaded = $this->formsRepo->loadSchemaVersion( $formId );
				$schema = is_array( $loaded ) ? ( $loaded['schema'] ?? $loaded ) : array();
				$keys   = \SubtleForms\Support\EntryValues::secretKeys( is_array( $schema ) ? $schema : array() );
			}
		} catch ( \Throwable $e ) {
			$keys = array();
		}
		$cache[ $formId ] = array_values( array_unique( $keys ) );
		return $cache[ $formId ];
	}

	/**
	 * Repeater groups as numbered lines when the form's schema is not at
	 * hand (an export across forms): "1. ticker: AAPL; shares: 8".
	 *
	 * @param array $groups Groups.
	 * @return string
	 */
	private function groupsText( array $groups ): string {
		$lines = array();
		foreach ( array_values( $groups ) as $n => $group ) {
			$parts = array();
			foreach ( (array) $group as $k => $v ) {
				$text = \SubtleForms\Support\FieldMapper::toText( $v );
				if ( '' !== $text ) {
					$parts[] = $k . ': ' . $text;
				}
			}
			$lines[] = ( $n + 1 ) . '. ' . implode( '; ', $parts );
		}
		return implode( "\n", $lines );
	}

	/**
	 * Quote one CSV cell.
	 *
	 * Cells that a spreadsheet would run as a formula (starting with =, @, tab,
	 * carriage return, or + / - followed by anything other than a number) are
	 * prefixed with an apostrophe, so an answer cannot inject a formula into
	 * the admin's spreadsheet.
	 *
	 * @param mixed $value Cell value.
	 * @return string
	 */
	public function csv_cell( $value ): string {
		$value = is_scalar( $value ) ? (string) $value : '';
		$risky = '' !== $value && in_array( $value[0], array( '=', '+', '-', '@', "\t", "\r" ), true );
		// Phone numbers and signed amounts ("+44 20 7946 0000", "-12.50") are
		// not formulas and are kept as typed.
		if ( $risky && in_array( $value[0], array( '+', '-' ), true ) && preg_match( '/^[+-][0-9\s().\/-]*$/', $value ) ) {
			$risky = false;
		}
		if ( $risky ) {
			$value = "'" . $value;
		}
		return '"' . str_replace( '"', '""', $value ) . '"';
	}
}
