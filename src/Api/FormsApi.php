<?php
/**
 * SubtleForms Forms REST API
 *
 * CRUD operations for forms and form schemas.
 *
 * @package SubtleForms\Api
 * @since   1.9.0
 */

namespace SubtleForms\Api;

use SubtleForms\Support\Helpers;
use SubtleForms\Support\Logger;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\Settings;
use SubtleForms\Support\Captcha\CaptchaManager;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\ValidationException;
use SubtleForms\Validation\Schemas;
use WP_REST_Request;
use WP_REST_Response;

/**
 * REST API controller for form CRUD and schema operations.
 */
final class FormsApi {

	use ApiGuards;

	private const NAMESPACE = 'subtleforms/v1';

	/** @var FormsRepository */
	private $formsRepo;

	/** @var SubmissionsRepository */
	private $submissionsRepo;

	/** @var FeatureGate */
	private $gate;

	/** @var Settings|null */
	private $settings;

	/** @var CaptchaManager|null */
	private $captchaManager;

	public function __construct(
		FormsRepository $formsRepo,
		SubmissionsRepository $submissionsRepo,
		FeatureGate $gate,
		?Settings $settings = null,
		?CaptchaManager $captchaManager = null
	) {
		$this->formsRepo       = $formsRepo;
		$this->submissionsRepo = $submissionsRepo;
		$this->gate            = $gate;
		$this->settings        = $settings;
		$this->captchaManager  = $captchaManager;
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
			'/forms',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_forms' ),
					'permission_callback' => array( $this, 'check_read_permission' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'create_form' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/forms/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_form' ),
					'permission_callback' => array( $this, 'check_read_permission' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( $this, 'update_form' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( $this, 'delete_form' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/forms/(?P<id>\d+)/schema',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_form_schema' ),
					'permission_callback' => array( $this, 'check_public_schema_permission' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'save_form_schema' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				),
			)
		);
	}

	// ────────────────────────────────────────────────────────────────────
	// Permission callbacks
	// ────────────────────────────────────────────────────────────────────

	/**
	 * Permission check for the public schema GET endpoint.
	 *
	 * Authenticated admins are always allowed. Unauthenticated users may
	 * only access schemas for published forms — we reject early with a
	 * 404 so the handler code is never executed for invalid requests.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return bool|\WP_Error True if allowed, WP_Error to deny.
	 */
	public function check_public_schema_permission( WP_REST_Request $request ) {
		// Admins always pass
		if ( is_user_logged_in() && current_user_can( 'manage_options' ) ) {
			return true;
		}

		$formId = intval( $request->get_param( 'id' ) );
		$form   = $this->formsRepo->find( $formId );

		if ( ! $form ) {
			return new \WP_Error(
				'rest_not_found',
				__( 'Form not available', 'subtleforms' ),
				array( 'status' => 404 )
			);
		}

		if ( ( $form['status'] ?? '' ) !== 'published' ) {
			return new \WP_Error(
				'rest_not_found',
				__( 'Form not available', 'subtleforms' ),
				array( 'status' => 404 )
			);
		}

		return true;
	}

	// ────────────────────────────────────────────────────────────────────
	// Handlers
	// ────────────────────────────────────────────────────────────────────

	/**
	 * Get all forms.
	 */
	public function get_forms( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		// Validate pagination parameters
		try {
			$pagination = Schemas::validatePagination(
				array(
					'page'     => $request->get_param( 'page' ),
					'per_page' => $request->get_param( 'per_page' ),
				)
			);
			$page     = $pagination['page'];
			$per_page = $pagination['per_page'];
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$offset = ( $page - 1 ) * $per_page;

		// Validate orderby and order params
		$allowed_orderby = array( 'id', 'title', 'status', 'created_at', 'updated_at' );
		$orderby         = in_array( $request->get_param( 'orderby' ), $allowed_orderby )
			? $request->get_param( 'orderby' )
			: 'created_at';
		$order_param     = $request->get_param( 'order' );
		$order           = ( ! empty( $order_param ) && strtoupper( $order_param ) === 'ASC' ) ? 'ASC' : 'DESC';

		$search = Helpers::safe_sanitize_text( $request->get_param( 'search' ) ?: '' );
		$status = Helpers::safe_sanitize_text( $request->get_param( 'status' ) ?: '' );

		$args = array(
			'limit'   => $per_page,
			'offset'  => $offset,
			'orderby' => $orderby,
			'order'   => $order,
		);

		if ( $search ) {
			$args['search'] = $search;
		}
		if ( $status ) {
			$args['status'] = $status;
		}

		$forms = $this->formsRepo->all( $args );
		$total = $this->formsRepo->count( $args );

		// Enhance forms with submission counts (bulk to avoid N+1)
		if ( ! empty( $forms ) ) {
			$form_ids      = array_column( $forms, 'id' );
			$total_counts  = $this->submissionsRepo->get_counts_by_forms( $form_ids );
			$unread_counts = $this->submissionsRepo->get_counts_by_forms( $form_ids, 'unread' );

			foreach ( $forms as &$form ) {
				$form['submission_count'] = $total_counts[ $form['id'] ] ?? 0;
				$form['unread_count']     = $unread_counts[ $form['id'] ] ?? 0;
			}
		}

		return ApiResponse::paginated( $forms, $total, $page, $per_page );
	}

	/**
	 * Get a single form.
	 */
	public function get_form( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$form = $this->formsRepo->find( $id );

		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		$etag     = $this->generateETag( $form, 'form' );
		$response = ApiResponse::success( $form );
		return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
	}

	/**
	 * Get form schema.
	 *
	 * SECURITY POLICY:
	 * - Public (unauthenticated): Only active schemas for published forms
	 * - Authenticated (admin): Draft schema when context=builder, active otherwise
	 */
	public function get_form_schema( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$formId  = intval( $request->get_param( 'id' ) );
		$version = $request->get_param( 'version' );
		$version = $version !== null ? intval( $version ) : null;
		$context = $request->get_param( 'context' );

		Logger::debug( 'get_form_schema called for form %d with context: %s', $formId, $context );

		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not available', 'subtleforms' ) );
		}

		$isAuthenticated = is_user_logged_in() && current_user_can( 'edit_posts' );
		$isPublished     = isset( $form['status'] ) && $form['status'] === 'published';
		$requestsDraft   = $context === 'builder';

		// PUBLIC ACCESS: Only active schema for published forms
		if ( ! $isAuthenticated ) {
			if ( ! $isPublished ) {
				return ApiResponse::not_found( __( 'Form not available', 'subtleforms' ) );
			}

			try {
				$schema = $this->formsRepo->loadSchemaVersion( $formId, $version );
			} catch ( \RuntimeException $e ) {
				Logger::error( 'API Error: %s', $e->getMessage() );
				return ApiResponse::not_found( __( 'Schema not available', 'subtleforms' ) );
			}

			if ( ! $schema ) {
				return ApiResponse::not_found( __( 'Schema not available', 'subtleforms' ) );
			}

			$schemaData = $schema['schema'] ?? $schema;
			$schemaData = $this->injectCaptchaHtml( $schemaData );

			return ApiResponse::success(
				array(
					'form'    => $form,
					'schema'  => $schemaData,
					'version' => $schema['version'] ?? null,
				)
			);
		}

		// AUTHENTICATED: Allow draft schema with context=builder
		if ( $requestsDraft && ! $version ) {
			$draftSchema = $this->formsRepo->getDraftSchema( $formId );

			if ( $draftSchema ) {
				$draftSchema = $this->injectCaptchaProvider( $draftSchema );

				return ApiResponse::success(
					array(
						'form'    => $form,
						'schema'  => $draftSchema,
						'version' => null,
						'draft'   => true,
					)
				);
			}
		}

		// Fall back to versioned schema
		try {
			$schema = $this->formsRepo->loadSchemaVersion( $formId, $version );
		} catch ( \RuntimeException $e ) {
			Logger::error( 'API Error: %s', $e->getMessage() );
			return ApiResponse::server_error( __( 'Failed to load form schema', 'subtleforms' ) );
		}

		if ( ! $schema ) {
			return ApiResponse::success(
				array(
					'form'    => $form,
					'schema'  => array(
						'metadata' => array(
							'title'       => $form['title'] ?? '',
							'name'        => 'form_schema',
							'description' => '',
						),
						'fields'   => array(),
						'actions'  => array(),
					),
					'version' => null,
				)
			);
		}

		$schemaData = $schema['schema'] ?? $schema;
		$schemaData = $this->injectCaptchaHtml( $schemaData );

		return ApiResponse::success(
			array(
				'form'    => $form,
				'schema'  => $schemaData,
				'version' => $schema['version'] ?? null,
			)
		);
	}

	/**
	 * Save form schema (draft or versioned).
	 */
	public function save_form_schema( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$formId = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		$conflictResponse = $this->guardIfMatch( $request, $form, 'form' );
		if ( $conflictResponse ) {
			return $conflictResponse;
		}

		$input = $request->get_json_params();
		try {
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $input, Schemas::get( Schemas::FORM_SCHEMA_SAVE ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$schema   = $validated['schema'];
		$activate = $validated['activate'] ?? false;

		// Ensure schema_version exists
		if ( ! isset( $schema['schema_version'] ) ) {
			$schema['schema_version'] = 1;
			Logger::debug( 'Injected default schema_version=1 for form %d', $formId );
		}

		// Ensure metadata and metadata.name exist
		if ( ! isset( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
			$schema['metadata'] = array();
		}
		if ( empty( $schema['metadata']['name'] ) || ! is_string( $schema['metadata']['name'] ) ) {
			$schema['metadata']['name'] = Helpers::safe_string_get( $form, 'title', 'form_schema' );
		}

		// Ensure fields array exists
		if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			$schema['fields'] = array();
		}

		// Structured validation for activation
		if ( $activate ) {
			$schemaValidator  = new \SubtleForms\Support\SchemaValidator();
			$validationErrors = ( $form['status'] ?? '' ) === 'published'
				? $schemaValidator->validateForPublishingWithErrors( $schema )
				: $schemaValidator->validateWithErrors( $schema );

			if ( ! empty( $validationErrors ) ) {
				return ApiResponse::validation_error(
					__( 'Schema validation failed', 'subtleforms' ),
					$validationErrors
				);
			}
		}

		try {
			if ( $activate ) {
				$version     = $this->formsRepo->saveSchemaVersion( $formId, $schema, true );
				$savedSchema = $this->formsRepo->loadSchemaVersion( $formId, $version );
				if ( ! $savedSchema ) {
					Logger::error( 'Failed to load just-saved schema version %d for form %d', $version, $formId );
					return ApiResponse::server_error( __( 'Schema was saved but could not be loaded back', 'subtleforms' ) );
				}

				return ApiResponse::success( array( 'version' => $version, 'active' => true ), 201 );
			} else {
				$success = $this->formsRepo->saveDraftSchema( $formId, $schema );
				if ( ! $success ) {
					return ApiResponse::server_error( __( 'Failed to save draft schema', 'subtleforms' ) );
				}

				return ApiResponse::success( array( 'draft' => true, 'active' => false ) );
			}
		} catch ( \InvalidArgumentException $e ) {
			Logger::error( 'Schema validation error for form %d: %s', $formId, $e->getMessage() );
			return ApiResponse::bad_request( $e->getMessage() );
		} catch ( \RuntimeException $e ) {
			Logger::error( 'Save failed for form %d: %s', $formId, $e->getMessage() );
			return ApiResponse::server_error( $e->getMessage() );
		}
	}

	/**
	 * Create a new form.
	 */
	public function create_form( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$input = $request->get_json_params();

		// Coerce stringified JSON fields
		foreach ( array( 'config', 'schema' ) as $maybeJsonField ) {
			if ( isset( $input[ $maybeJsonField ] ) && is_string( $input[ $maybeJsonField ] ) ) {
				$trimmed = trim( $input[ $maybeJsonField ] );
				if ( $trimmed === '' ) {
					unset( $input[ $maybeJsonField ] );
				} else {
					$decoded = json_decode( $input[ $maybeJsonField ], true );
					if ( json_last_error() === JSON_ERROR_NONE && is_array( $decoded ) ) {
						$input[ $maybeJsonField ] = $decoded;
					}
				}
			}
		}

		try {
			Logger::debug( 'create_form - raw input: %s', print_r( $input, true ) );
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $input, Schemas::get( Schemas::FORM_CREATE ) );
		} catch ( ValidationException $e ) {
			Logger::error( 'create_form - validation failed: %s Fields: %s', $e->getMessage(), print_r( $e->getFields(), true ) );
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$defaultStatus = $this->settings ? $this->settings->get( 'default_form_status', 'draft' ) : 'draft';

		$data = array(
			'title'  => $validated['title'],
			'config' => $validated['config'] ?? array(),
			'status' => $defaultStatus,
		);

		$id = $this->formsRepo->create( $data );

		// If schema provided, save as initial version and activate
		$schema = $validated['schema'] ?? null;
		if ( is_array( $schema ) && ! empty( $schema ) ) {
			if ( ! isset( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
				$schema['metadata'] = array();
			}
			if ( empty( $schema['metadata']['name'] ) || ! is_string( $schema['metadata']['name'] ) ) {
				$schema['metadata']['name'] = Helpers::safe_string_get( $validated, 'title', 'form_schema' );
			}
			if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
				$schema['fields'] = array();
			}

			try {
				$this->formsRepo->saveSchemaVersion( $id, $schema, true );
			} catch ( \InvalidArgumentException $e ) {
				Logger::error( 'Failed to save initial schema for form %d: %s', $id, $e->getMessage() );
			}
		}

		return ApiResponse::success( array( 'id' => $id ), 201 );
	}

	/**
	 * Update a form.
	 */
	public function update_form( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$form = $this->formsRepo->find( $id );
		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		$conflictResponse = $this->guardIfMatch( $request, $form, 'form' );
		if ( $conflictResponse ) {
			return $conflictResponse;
		}

		$input = $request->get_json_params();
		try {
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $input, Schemas::get( Schemas::FORM_UPDATE ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$data = array_filter(
			array(
				'title'  => $validated['title'] ?? null,
				'config' => $validated['config'] ?? null,
				'status' => $validated['status'] ?? null,
			),
			fn( $value ) => $value !== null
		);

		// Block publishing if no active schema exists
		if ( isset( $data['status'] ) && $data['status'] === 'published' ) {
			try {
				$draftSchema = $this->formsRepo->getDraftSchema( $id );

				if ( $draftSchema ) {
					try {
						$this->formsRepo->promoteDraftToActive( $id );
					} catch ( \Exception $e ) {
						Logger::error( 'Failed to promote draft: %s', $e->getMessage() );
						return ApiResponse::server_error( __( 'Cannot publish form: Failed to activate schema.', 'subtleforms' ) . ' ' . $e->getMessage() );
					}
				}

				$activeSchema = $this->formsRepo->loadSchemaVersion( $id, null );

				if ( ! $activeSchema ) {
					return ApiResponse::bad_request( __( 'Cannot publish form: No schema exists. Please save your form first.', 'subtleforms' ) );
				}

				if ( ! isset( $activeSchema['active'] ) || $activeSchema['active'] != 1 ) {
					return ApiResponse::bad_request( __( 'Cannot publish form: No active schema version. Please save and activate a schema first.', 'subtleforms' ) );
				}

				$schemaData = $activeSchema['schema'] ?? null;
				if ( ! $schemaData || ! is_array( $schemaData ) ) {
					Logger::error( 'Schema missing or invalid for form %d. Available keys: %s', $id, implode( ', ', array_keys( $activeSchema ) ) );
					return ApiResponse::bad_request( __( 'Cannot publish form: Schema data is corrupt or invalid.', 'subtleforms' ) );
				}

				$schemaValidator  = new \SubtleForms\Support\SchemaValidator();
				$validationErrors = $schemaValidator->validateForPublishingWithErrors( $schemaData );

				if ( ! empty( $validationErrors ) ) {
					return ApiResponse::validation_error(
						__( 'Cannot publish form: Fix validation errors.', 'subtleforms' ),
						$validationErrors
					);
				}
			} catch ( \RuntimeException $e ) {
				return ApiResponse::server_error( __( 'Cannot publish form:', 'subtleforms' ) . ' ' . $e->getMessage() );
			}
		}

		$this->formsRepo->update( $id, $data );

		$updatedForm = $this->formsRepo->find( $id );
		$etag        = $this->generateETag( $updatedForm, 'form' );
		$response    = ApiResponse::success( array( 'success' => true, 'form' => $updatedForm ) );
		return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
	}

	/**
	 * Delete a form.
	 */
	public function delete_form( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$form = $this->formsRepo->find( $id );
		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		$conflictResponse = $this->guardIfMatch( $request, $form, 'form' );
		if ( $conflictResponse ) {
			return $conflictResponse;
		}

		$this->formsRepo->delete( $id );

		return ApiResponse::success( array( 'success' => true ) );
	}

	// ────────────────────────────────────────────────────────────────────
	// CAPTCHA helpers
	// ────────────────────────────────────────────────────────────────────

	/**
	 * Inject CAPTCHA HTML into schema fields for frontend rendering.
	 */
	private function injectCaptchaHtml( $schema ) {
		if ( ! $this->captchaManager || ! $this->captchaManager->isEnabled() || ! $this->captchaManager->isConfigured() ) {
			return $schema;
		}

		$captcha_html = $this->captchaManager->render();
		if ( empty( $captcha_html ) ) {
			return $schema;
		}

		$schema['fields'] = $this->processCaptchaFields( $schema['fields'] ?? array(), $captcha_html );

		return $schema;
	}

	/**
	 * Recursively process fields to inject CAPTCHA HTML.
	 */
	private function processCaptchaFields( $fields, $captcha_html ) {
		$provider_name = $this->captchaManager ? $this->captchaManager->getActiveProviderName() : '';

		foreach ( $fields as &$field ) {
			if ( in_array( $field['type'], array( 'captcha', 'recaptcha', 'hcaptcha', 'turnstile' ), true ) ) {
				$field['config']['captchaHtml']  = $captcha_html;
				$field['config']['providerName'] = $provider_name;
			}

			if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
				$field['children'] = $this->processCaptchaFields( $field['children'], $captcha_html );
			}

			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as &$column ) {
					if ( is_array( $column ) ) {
						$column = $this->processCaptchaFields( $column, $captcha_html );
					}
				}
			}
		}

		return $fields;
	}

	/**
	 * Inject CAPTCHA provider name only (for builder preview).
	 */
	private function injectCaptchaProvider( $schema ) {
		if ( ! $this->captchaManager || ! $this->captchaManager->isEnabled() || ! $this->captchaManager->isConfigured() ) {
			return $schema;
		}

		$provider_name = $this->captchaManager->getActiveProviderName();
		if ( empty( $provider_name ) ) {
			return $schema;
		}

		$schema['fields'] = $this->processCaptchaProvider( $schema['fields'] ?? array(), $provider_name );

		return $schema;
	}

	/**
	 * Recursively process fields to inject CAPTCHA provider name.
	 */
	private function processCaptchaProvider( $fields, $provider_name ) {
		foreach ( $fields as &$field ) {
			if ( in_array( $field['type'], array( 'captcha', 'recaptcha', 'hcaptcha', 'turnstile' ), true ) ) {
				$field['config']['providerName'] = $provider_name;
			}

			if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
				$field['children'] = $this->processCaptchaProvider( $field['children'], $provider_name );
			}

			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as &$column ) {
					if ( is_array( $column ) ) {
						$column = $this->processCaptchaProvider( $column, $provider_name );
					}
				}
			}
		}

		return $fields;
	}
}
