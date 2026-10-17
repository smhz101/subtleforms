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

use SubtleForms\Support\Helpers;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
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
						'enum'              => array( 'completed', 'failed', 'payment_pending', 'processing' ),
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

		$submissions = array_map( array( $this, 'redactSecrets' ), $this->submissionsRepo->findAll( $args ) );
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

		// Processing status (filter bar) — only applies when tab is 'all'
		if ( $proc_status && $status_arg === null && $is_read_arg === null && $tab_status !== 'starred' ) {
			$status_arg = $proc_status;
		}

		$args = array(
			'form_id'     => $request->get_param( 'form_id' ),
			'status'      => $status_arg,
			'is_read'     => $is_read_arg,
			'starred'     => $starred_arg,
			'search'      => $request->get_param( 'search' ),
			'after'       => $request->get_param( 'after' ),
			'field_key'   => $request->get_param( 'field_key' ),
			'field_value' => $request->get_param( 'field_value' ),
			'limit'       => $pagination['per_page'],
			'offset'      => intval( $request->get_param( 'offset' ) ?? 0 ),
			'orderby'     => in_array( $request->get_param( 'orderby' ), array( 'id', 'created_at', 'updated_at', 'status' ), true ) ? $request->get_param( 'orderby' ) : 'created_at',
			'order'       => strtoupper( $request->get_param( 'order' ) ?? 'DESC' ) === 'ASC' ? 'ASC' : 'DESC',
		);

		$submissions = array_map( array( $this, 'redactSecrets' ), $this->submissionsRepo->findAll( $args ) );
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

			try {
				$schemaVersion        = $submission['schema_version'] ?? null;
				$schema               = $this->formsRepo->loadSchemaVersion( $submission['form_id'], $schemaVersion );
				$submission['schema'] = $schema['schema'] ?? null;
			} catch ( \RuntimeException $e ) {
				$submission['schema'] = null;
			}

			$adjacent              = $this->submissionsRepo->getAdjacentIds( $submission['id'], $submission['form_id'] );
			$submission['next_id'] = $adjacent['next'];
			$submission['prev_id'] = $adjacent['prev'];
		}

		$submission = $this->redactSecrets( $submission );
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
					if ( $this->submissionsRepo->trash( $id ) ) {
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

		try {
			$loaded = $this->formsRepo->loadSchemaVersion( (int) $submission['form_id'], isset( $submission['schema_version'] ) ? (int) $submission['schema_version'] : null );
		} catch ( \RuntimeException $e ) {
			$loaded = null;
		}
		if ( ! $loaded ) {
			try {
				$loaded = $this->formsRepo->loadSchemaVersion( (int) $submission['form_id'] );
			} catch ( \RuntimeException $e ) {
				$loaded = null;
			}
		}
		$schema = is_array( $loaded ) ? ( $loaded['schema'] ?? $loaded ) : null;
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
		if ( ! $result->ok ) {
			return ApiResponse::server_error( __( 'The notifications could not be sent.', 'subtleforms' ) );
		}

		return ApiResponse::success(
			array(
				'sent'  => true,
				'count' => count( $steps ),
			)
		);
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

		// Without force the entry goes to the Trash, where it can be restored
		// for the retention period (2.3.1).
		if ( ! rest_sanitize_boolean( $request->get_param( 'force' ) ) ) {
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
	 * Get unread submissions count.
	 */
	public function get_unread_count( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$unreadCount = $this->submissionsRepo->count( array( 'is_read' => 0 ) );

			return ApiResponse::success(
				array(
					'count'     => $unreadCount,
					'timestamp' => current_time( 'mysql' ),
				)
			);
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( __( 'Error fetching unread count', 'subtleforms' ) );
		}
	}

	/**
	 * Export submissions as CSV (Pro capability `submissions.export`).
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

		if ( ! $this->gate->allows( 'submissions.export' ) ) {
			return ApiResponse::forbidden( __( 'CSV export is part of SubtleForms Pro.', 'subtleforms' ) );
		}

		$params = $request->get_json_params();
		$params = is_array( $params ) ? $params : array();

		$args = array(
			'form_id' => ! empty( $params['form_id'] ) ? intval( $params['form_id'] ) : null,
			'status'  => isset( $params['status'] ) ? Helpers::safe_sanitize_text( $params['status'] ) : null,
			'search'  => isset( $params['search'] ) ? Helpers::safe_sanitize_text( $params['search'] ) : null,
			'after'   => isset( $params['after'] ) ? Helpers::safe_sanitize_text( $params['after'] ) : null,
			// Export selected (2.3.0).
			'ids'     => isset( $params['ids'] ) && is_array( $params['ids'] ) ? array_map( 'absint', $params['ids'] ) : null,
			'orderby' => 'created_at',
			'order'   => 'DESC',
			'limit'   => 10000,
		);

		$args = array_filter( $args, fn( $value ) => $value !== null && $value !== '' );
		// Entries in the Trash are never exported (2.3.1).
		if ( ( $args['status'] ?? '' ) === SubmissionsRepository::TRASH ) {
			unset( $args['status'] );
		}

		$submissions = $this->submissionsRepo->findAll( $args );

		if ( empty( $submissions ) ) {
			return ApiResponse::success(
				array(
					'success' => false,
					'message' => __( 'No submissions to export', 'subtleforms' ),
				)
			);
		}

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

		$rows = array();
		$keys = array();
		foreach ( $submissions as $submission ) {
			$payload = is_string( $submission['payload'] ?? null )
				? json_decode( $submission['payload'], true )
				: ( $submission['payload'] ?? array() );
			$payload = is_array( $payload ) ? $payload : array();

			// Passwords are never exported (2.2.1).
			foreach ( $this->secretKeysForForm( (int) ( $submission['form_id'] ?? 0 ) ) as $secret ) {
				unset( $payload[ $secret ] );
			}

			foreach ( array_keys( $payload ) as $key ) {
				$key = (string) $key;
				if ( '' === $key || '_' === $key[0] || in_array( $key, $skip, true ) ) {
					continue;
				}
				$keys[ $key ] = true;
			}
			$rows[] = array( $submission, $payload );
		}

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

		$csv_data = array( $headers );
		foreach ( $rows as list( $submission, $payload ) ) {
			$row = array(
				$submission['id'],
				$submission['form_id'],
				$submission['status'],
				$submission['created_at'],
			);
			foreach ( $ordered as $key ) {
				if ( isset( $repeaters[ $key ] ) ) {
					foreach ( \SubtleForms\Support\Repeater::csvCells( $payload[ $key ] ?? array(), $repeaters[ $key ] ) as $cell ) {
						$row[] = $cell;
					}
					continue;
				}
				$value = $payload[ $key ] ?? '';
				// Exports of several forms: groups read as numbered lines.
				// A drawn signature is an image; the cell says it was signed (2.3.3).
				if ( \SubtleForms\Support\EntryValues::isSignatureImage( $value ) ) {
					$row[] = __( 'Signed', 'subtleforms' );
					continue;
				}
				$row[] = \SubtleForms\Support\Repeater::looksLikeGroups( $value )
					? $this->groupsText( $value )
					: \SubtleForms\Support\FieldMapper::toText( $value );
			}
			$csv_data[] = $row;
		}

		$csv_string = "\xEF\xBB\xBF"; // UTF-8 BOM so Excel reads accents correctly.

		foreach ( $csv_data as $row ) {
			$escaped_row = array_map( array( $this, 'csv_cell' ), $row );
			$csv_string .= implode( ',', $escaped_row ) . "\r\n";
		}

		$filename = 'subtleforms-submissions-' . gmdate( 'Y-m-d-His' ) . '.csv';

		return ApiResponse::success(
			array(
				'success'  => true,
				'csv'      => base64_encode( $csv_string ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Binary-safe transport of the CSV file in JSON.
				'filename' => $filename,
				'rows'     => count( $rows ),
			)
		);
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
