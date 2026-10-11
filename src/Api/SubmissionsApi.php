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
						'id' => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
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
		} elseif ( in_array( $tab_status, array( 'spam', 'flagged' ), true ) ) {
			$status_arg = $tab_status;
		}

		// Processing status (filter bar) — only applies when tab is 'all'
		if ( $proc_status && $status_arg === null && $is_read_arg === null ) {
			$status_arg = $proc_status;
		}

		$args = array(
			'form_id'     => $request->get_param( 'form_id' ),
			'status'      => $status_arg,
			'is_read'     => $is_read_arg,
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
				'notes'   => $validated['notes'] ?? null,
			),
			fn( $value ) => $value !== null
		);

		if ( empty( $data ) ) {
			return ApiResponse::bad_request( __( 'No valid changes provided', 'subtleforms' ) );
		}

		$this->submissionsRepo->update( $id, $data );

		$updatedSubmission = $this->submissionsRepo->find( $id );
		$etag              = $this->generateETag( $updatedSubmission, 'submission' );
		$response          = ApiResponse::success( array( 'success' => true, 'submission' => $updatedSubmission ) );
		return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
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
			'orderby' => 'created_at',
			'order'   => 'DESC',
			'limit'   => 10000,
		);

		$args = array_filter( $args, fn( $value ) => $value !== null && $value !== '' );

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
		$labels = array();
		if ( ! empty( $args['form_id'] ) ) {
			try {
				$active = $this->formsRepo->loadSchemaVersion( (int) $args['form_id'] );
				$schema = is_array( $active ) ? ( $active['schema'] ?? $active ) : array();
				foreach ( \SubtleForms\Support\FieldMapper::fields( is_array( $schema ) ? $schema : array() ) as $field ) {
					$labels[ $field['key'] ] = '' !== $field['label'] ? $field['label'] : $field['key'];
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
		foreach ( $ordered as $key ) {
			$headers[] = $labels[ $key ] ?? ucwords( str_replace( array( '_', '-' ), ' ', $key ) );
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
				$row[] = \SubtleForms\Support\FieldMapper::toText( $payload[ $key ] ?? '' );
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
