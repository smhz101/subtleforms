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
						'required'          => true,
						'sanitize_callback' => 'absint',
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

		$submissions = $this->submissionsRepo->findAll( $args );
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

		$args = array(
			'form_id' => $request->get_param( 'form_id' ),
			'status'  => $request->get_param( 'status' ),
			'search'  => $request->get_param( 'search' ),
			'limit'   => $pagination['per_page'],
			'offset'  => intval( $request->get_param( 'offset' ) ?? 0 ),
			'orderby' => in_array( $request->get_param( 'orderby' ), array( 'id', 'created_at', 'updated_at', 'status' ), true ) ? $request->get_param( 'orderby' ) : 'created_at',
			'order'   => strtoupper( $request->get_param( 'order' ) ?? 'DESC' ) === 'ASC' ? 'ASC' : 'DESC',
		);

		$submissions = $this->submissionsRepo->findAll( $args );
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

		// Auto-mark as read
		if ( $submission['status'] === 'unread' ) {
			$this->submissionsRepo->update( $submission['id'], array( 'status' => 'read' ) );
			$submission['status'] = 'read';
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
				'status' => $validated['status'] ?? null,
				'notes'  => $validated['notes'] ?? null,
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
			$unreadCount = $this->submissionsRepo->count( array( 'status' => 'unread' ) );

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
	 * Export submissions as CSV.
	 */
	public function export_submissions_csv( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$params = $request->get_json_params();

		$args = array(
			'form_id' => isset( $params['form_id'] ) ? intval( $params['form_id'] ) : null,
			'status'  => isset( $params['status'] ) ? Helpers::safe_sanitize_text( $params['status'] ) : null,
			'search'  => isset( $params['search'] ) ? Helpers::safe_sanitize_text( $params['search'] ) : null,
			'orderby' => 'created_at',
			'order'   => 'DESC',
			'limit'   => 10000,
		);

		$args = array_filter( $args, fn( $value ) => $value !== null );

		$submissions = $this->submissionsRepo->findAll( $args );

		if ( empty( $submissions ) ) {
			return ApiResponse::success(
				array(
					'success' => false,
					'message' => __( 'No submissions to export', 'subtleforms' ),
				)
			);
		}

		// Build CSV
		$csv_data         = array();
		$first_submission = $submissions[0];
		$payload          = is_string( $first_submission['payload'] )
			? json_decode( $first_submission['payload'], true )
			: $first_submission['payload'];

		$headers = array(
			__( 'ID', 'subtleforms' ),
			__( 'Form ID', 'subtleforms' ),
			__( 'Status', 'subtleforms' ),
			__( 'Submitted At', 'subtleforms' ),
		);

		if ( is_array( $payload ) ) {
			foreach ( array_keys( $payload ) as $field_key ) {
				if ( in_array( $field_key, array( 'website_url', 'form_rendered_at' ), true ) ) {
					continue;
				}
				$headers[] = ucwords( str_replace( '_', ' ', $field_key ) );
			}
		}

		$csv_data[] = $headers;

		foreach ( $submissions as $submission ) {
			$payload = is_string( $submission['payload'] )
				? json_decode( $submission['payload'], true )
				: $submission['payload'];

			$row = array(
				$submission['id'],
				$submission['form_id'],
				$submission['status'],
				$submission['created_at'],
			);

			if ( is_array( $payload ) ) {
				foreach ( array_keys( $first_submission['payload'] ) as $field_key ) {
					if ( in_array( $field_key, array( 'website_url', 'form_rendered_at' ), true ) ) {
						continue;
					}

					$value = $payload[ $field_key ] ?? '';
					if ( is_array( $value ) ) {
						$value = implode( ', ', $value );
					}
					$row[] = $value;
				}
			}

			$csv_data[] = $row;
		}

		$csv_string = "\xEF\xBB\xBF"; // UTF-8 BOM

		foreach ( $csv_data as $row ) {
			$escaped_row = array_map(
				function ( $value ) {
					$value = str_replace( '"', '""', $value );
					return '"' . $value . '"';
				},
				$row
			);

			$csv_string .= implode( ',', $escaped_row ) . "\r\n";
		}

		$filename = 'subtleforms-submissions-' . gmdate( 'Y-m-d-His' ) . '.csv';

		return ApiResponse::success(
			array(
				'success'  => true,
				'csv'      => base64_encode( $csv_string ),
				'filename' => $filename,
			)
		);
	}
}
