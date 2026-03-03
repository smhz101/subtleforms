<?php
/**
 * SubtleForms REST API Controller
 *
 * @package   SubtleForms\Api
 * @version   0.1.0
 */

namespace SubtleForms\Api;

use SubtleForms\Support\Helpers;
use SubtleForms\Support\Logger;
use SubtleForms\Api\SettingsApi;
use SubtleForms\Api\DashboardApi;
use SubtleForms\Api\ApiResponse;

use SubtleForms\Engine\Pipeline;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\Settings;
use SubtleForms\Support\Captcha\CaptchaManager;
use SubtleForms\Engine\SchemaCompiler;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\ValidationException;
use SubtleForms\Validation\Schemas;
use SubtleForms\Validation\Sanitizer;
use SubtleForms\Security\RateLimiter;
use SubtleForms\Security\ETag;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * REST API controller for SubtleForms.
 */
final class RestController {

	private const NAMESPACE = 'subtleforms/v1';

	/**
	 * @var SchemaCompiler
	 */
	private $compiler;

	/**
	 * @var Pipeline
	 */
	private $pipeline;

	/**
	 * @var FormsRepository
	 */
	private $formsRepo;

	/**
	 * @var SubmissionsRepository
	 */
	private $submissionsRepo;

	/**
	 * @var FeatureGate
	 */
	private $gate;

	/**
	 * @var FieldRegistry
	 */
	private $fieldRegistry;

	/**
	 * @var Settings
	 */
	private $settings;

	/**
	 * @var CaptchaManager
	 */
	private $captchaManager;

	public function __construct(
		$pipeline,
		$formsRepo,
		$submissionsRepo,
		$gate,
		$fieldRegistry,
		$compiler,
		$settings = null,
		$captchaManager = null
	) {
		$this->pipeline        = $pipeline;
		$this->formsRepo       = $formsRepo;
		$this->submissionsRepo = $submissionsRepo;
		$this->gate            = $gate;
		$this->fieldRegistry   = $fieldRegistry;
		$this->compiler        = $compiler;
		$this->settings        = $settings;
		$this->captchaManager  = $captchaManager;

		// Debug: Log constructor initialization
		Logger::debug( 'RestController initialized' );
		Logger::debug( 'CaptchaManager injected: ' . ( $captchaManager ? 'YES' : 'NO' ) );
		Logger::debug( 'Settings injected: ' . ( $settings ? 'YES' : 'NO' ) );
		
		if ( $captchaManager ) {
			Logger::debug( 'CaptchaManager class: ' . get_class( $captchaManager ) );
		}
	}

	/**
	 * Register REST API routes.
	 */
	public function register_routes(): void {
		// Forms endpoints
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

		// Form schema endpoints (versioned)
		register_rest_route(
			self::NAMESPACE,
			'/forms/(?P<id>\d+)/schema',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_form_schema' ),
					'permission_callback' => '__return_true', // Public access for frontend rendering
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'save_form_schema' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				),
			)
		);

		// Submissions endpoints
		register_rest_route(
			self::NAMESPACE,
			'/forms/(?P<form_id>\d+)/submissions',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_submissions' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		// Global submissions endpoint (v0.9.0+: Added for admin submissions page)
		register_rest_route(
			self::NAMESPACE,
			'/submissions',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_all_submissions' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
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
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( $this, 'update_submission' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				),
			)
		);

		// Submission navigation (v0.9.4)
		register_rest_route(
			self::NAMESPACE,
			'/submissions/(?P<id>\d+)/adjacent',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_adjacent_submissions' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		// Submission logs
		register_rest_route(
			self::NAMESPACE,
			'/submissions/(?P<id>\d+)/logs',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_submission_logs' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		// Unread submissions count (for real-time badge updates)
		register_rest_route(
			self::NAMESPACE,
			'/submissions/unread-count',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_unread_count' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		// Public submission endpoint
		register_rest_route(
			self::NAMESPACE,
			'/submit',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'submit_form' ),
				'permission_callback' => '__return_true',
			)
		);

		// Field definitions endpoint
		register_rest_route(
			self::NAMESPACE,
			'/fields',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_fields' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		// Settings endpoints (if Settings is available)
		if ( $this->settings ) {
			$settingsApi = new SettingsApi( $this->settings );
			$settingsApi->registerRoutes();
		}

		// Dashboard endpoint
		$dashboardApi = new DashboardApi(
			$this->formsRepo,
			$this->submissionsRepo,
			$this->settings
		);
		$dashboardApi->registerRoutes();

		// Onboarding, wizard, and tour endpoints (delegated to OnboardingApi)
		$onboardingApi = new OnboardingApi();
		$onboardingApi->registerRoutes();

		// Form templates endpoint
		register_rest_route(
			self::NAMESPACE,
			'/templates',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_templates' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		// CSV export endpoint
		register_rest_route(
			self::NAMESPACE,
			'/submissions/export',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'export_submissions_csv' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);
	}

	/**
	 * Guard rate limit for request (Phase A3-P1)
	 *
	 * Checks rate limit and returns error response if exceeded.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|null Error response if rate limited, null if allowed.
	 */
	private function guardRateLimit( WP_REST_Request $request ): ?WP_REST_Response {
		$userId = get_current_user_id() ?: null;
		$ip     = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
		$route  = $request->get_route();
		$method = $request->get_method();

		// Get policy for this endpoint
		$policy = RateLimiter::policy( $route, $method );
		
		// Build rate limit key
		$key = RateLimiter::buildKey( $route, $method, $userId, $ip );
		
		// Check limit
		$result = RateLimiter::check( $key, $policy['limit'], $policy['window'] );
		
		// If blocked, return 429 response
		if ( ! $result['allowed'] ) {
			$headers = RateLimiter::headers( $result, $policy['limit'] );
			return ApiResponse::rate_limited(
				'Too many requests. Please try again later.',
				$result['retry_after'],
				array(),
				$headers
			);
		}
		
		// Allowed - could optionally attach rate limit headers to success responses
		// For now, we only send headers on 429 responses
		return null;
	}

	/**
	 * Guard If-Match for optimistic locking (Phase A3-P2)
	 *
	 * Checks If-Match header against current resource ETag.
	 * Returns 409 Conflict if mismatch, null if match or no If-Match.
	 *
	 * @param WP_REST_Request $request         Request object.
	 * @param array           $currentResource Current resource data.
	 * @param string          $resourceName    Resource type (e.g., "form", "submission").
	 * @return WP_REST_Response|null 409 response if conflict, null if allowed.
	 */
	private function guardIfMatch( WP_REST_Request $request, array $currentResource, string $resourceName ): ?WP_REST_Response {
		$ifMatch = $request->get_header( 'If-Match' );

		// No If-Match header = optimistic locking not requested
		if ( empty( $ifMatch ) ) {
			return null;
		}

		// Generate current ETag
		$currentETag = $this->generateETag( $currentResource, $resourceName );

		// Check if ETags match
		if ( ETag::match( $ifMatch, $currentETag ) ) {
			return null; // Match - allow operation
		}

		// Conflict - return 409 with current ETag
		return ApiResponse::conflict(
			sprintf( 'The %s has been modified by another user. Please refresh and try again.', $resourceName ),
			array(
				'resource'          => $resourceName,
				'provided_if_match' => $ifMatch,
				'current_etag'      => $currentETag,
			),
			array( 'ETag' => $currentETag )
		);
	}

	/**
	 * Generate ETag for a resource (Phase A3-P2)
	 *
	 * @param array  $resource     Resource data.
	 * @param string $resourceName Resource type.
	 * @return string ETag value.
	 */
	private function generateETag( array $resource, string $resourceName ): string {
		switch ( $resourceName ) {
			case 'form':
				return ETag::fromForm( $resource );
			case 'submission':
				return ETag::fromSubmission( $resource );
			default:
				return ETag::fromResource( $resource );
		}
	}

	/**
	 * Get all forms.
	 */
	public function get_forms( WP_REST_Request $request ): WP_REST_Response {
		// Rate limiting (Phase A3-P1)
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

		// v0.9.0+: Enhance forms with submission counts for admin UI (v0.9.1: add unread count)
		// v1.7.0: Optimized to eliminate N+1 queries by fetching counts in bulk
		if ( ! empty( $forms ) ) {
			$form_ids        = array_column( $forms, 'id' );
			$total_counts    = $this->submissionsRepo->get_counts_by_forms( $form_ids );
			$unread_counts   = $this->submissionsRepo->get_counts_by_forms( $form_ids, 'unread' );

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
	public function get_form( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		// Validate ID
		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$form = $this->formsRepo->find( $id );

		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		// Phase A3-P2: Add ETag header for optimistic locking
		$etag     = $this->generateETag( $form, 'form' );
		$response = ApiResponse::success( $form );
		return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
	}

	/**
	 * Get form schema.
	 *
	 * SECURITY POLICY (Phase 6.2):
	 *
	 * Public (unauthenticated):
	 *   - Only ACTIVE schemas
	 *   - Only for PUBLISHED forms
	 *   - Never draft schema
	 *
	 * Authenticated (admin/editor):
	 *   - Draft schema when context=builder
	 *   - Active schema otherwise
	 *   - Works for all form statuses
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_form_schema( WP_REST_Request $request ) {
		$formId  = intval( $request->get_param( 'id' ) );
		$version = $request->get_param( 'version' );
		$version = $version !== null ? intval( $version ) : null;
		$context = $request->get_param( 'context' );

		Logger::debug( 'get_form_schema called for form ' . $formId . ' with context: ' . $context );

		// Verify form exists first
		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not available', 'subtleforms' ) );
		}

		$isAuthenticated = is_user_logged_in() && current_user_can( 'edit_posts' );
		$isPublished     = isset( $form['status'] ) && $form['status'] === 'published';
		$requestsDraft   = $context === 'builder';

		Logger::debug( 'isAuthenticated: ' . ( $isAuthenticated ? 'YES' : 'NO' ) );
		Logger::debug( 'isPublished: ' . ( $isPublished ? 'YES' : 'NO' ) );
		Logger::debug( 'requestsDraft: ' . ( $requestsDraft ? 'YES' : 'NO' ) );

		// PUBLIC ACCESS (unauthenticated): Only active schema for published forms
		if ( ! $isAuthenticated ) {
			Logger::debug( 'BRANCH: Public access (unauthenticated)' );
			if ( ! $isPublished ) {
				return ApiResponse::not_found( __( 'Form not available', 'subtleforms' ) );
			}

			// Load active schema only
			try {
				$schema = $this->formsRepo->loadSchemaVersion( $formId, $version );
			} catch ( \RuntimeException $e ) {
				Logger::error( 'API Error: ' . $e->getMessage() );
				return ApiResponse::not_found( __( 'Schema not available', 'subtleforms' ) );
			}

			if ( ! $schema ) {
				return ApiResponse::not_found( __( 'Schema not available', 'subtleforms' ) );
			}

			// Inject CAPTCHA HTML for frontend rendering
			Logger::debug( 'Injecting CAPTCHA HTML for frontend' );
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

		// AUTHENTICATED ACCESS: Allow draft schema with explicit context=builder
		if ( $requestsDraft && ! $version ) {
			Logger::debug( 'BRANCH: Authenticated access - loading draft schema' );
			$draftSchema = $this->formsRepo->getDraftSchema( $formId );

			if ( $draftSchema ) {
				Logger::debug( 'Draft schema found, injecting provider name' );
				// Inject provider name for builder preview (not full CAPTCHA HTML)
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
			Logger::debug( 'No draft schema found, falling back to versioned schema' );
		}

		// Fall back to versioned schema (authenticated users)
		Logger::debug( 'BRANCH: Loading versioned schema' );
		try {
			$schema = $this->formsRepo->loadSchemaVersion( $formId, $version );
		} catch ( \RuntimeException $e ) {
			Logger::error( 'API Error: ' . $e->getMessage() );
			return ApiResponse::server_error( __( 'Failed to load form schema', 'subtleforms' ) );
		}

		if ( ! $schema ) {
			// Return empty schema for authenticated users creating new forms
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

		// Inject CAPTCHA HTML for authenticated users viewing frontend too
		Logger::debug( 'Injecting CAPTCHA HTML for authenticated user' );
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
	 * Inject CAPTCHA HTML into schema fields for frontend rendering
	 *
	 * @param array $schema Form schema
	 * @return array Modified schema with CAPTCHA HTML
	 */
	private function injectCaptchaHtml( $schema ) {
		if ( ! $this->captchaManager ) {
			Logger::warning( 'CAPTCHA: CaptchaManager not initialized' );
			return $schema;
		}

		if ( ! $this->captchaManager->isEnabled() ) {
			Logger::warning( 'CAPTCHA: CAPTCHA is disabled in settings' );
			return $schema;
		}

		if ( ! $this->captchaManager->isConfigured() ) {
			Logger::warning( 'CAPTCHA: CAPTCHA is not configured (missing site key or secret key)' );
			return $schema;
		}

		$captcha_html = $this->captchaManager->render();

		if ( empty( $captcha_html ) ) {
			Logger::warning( 'CAPTCHA: render() returned empty HTML' );
			return $schema;
		}

		Logger::debug( 'CAPTCHA: Successfully generated HTML (' . strlen( $captcha_html ) . ' bytes)' );

		// Recursively inject CAPTCHA HTML into fields
		$schema['fields'] = $this->processCaptchaFields( $schema['fields'] ?? array(), $captcha_html );

		return $schema;
	}

	/**
	 * Recursively process fields to inject CAPTCHA HTML
	 *
	 * @param array $fields Array of field definitions
	 * @param string $captcha_html CAPTCHA widget HTML
	 * @return array Modified fields
	 */
	private function processCaptchaFields( $fields, $captcha_html ) {
		$provider_name = $this->captchaManager ? $this->captchaManager->getActiveProviderName() : '';

		foreach ( $fields as &$field ) {
			if ( in_array( $field['type'], array( 'captcha', 'recaptcha', 'hcaptcha', 'turnstile' ), true ) ) {
				$field['config']['captchaHtml']   = $captcha_html;
				$field['config']['providerName']  = $provider_name;
			}

			// Process nested fields (containers, columns)
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
	 * Inject CAPTCHA provider name only (for builder preview)
	 *
	 * @param array $schema Schema data
	 * @return array Modified schema
	 */
	private function injectCaptchaProvider( $schema ) {
		Logger::debug( 'injectCaptchaProvider() called' );
		Logger::debug( 'CaptchaManager exists: ' . ( $this->captchaManager ? 'YES' : 'NO' ) );
		
		if ( ! $this->captchaManager ) {
			Logger::warning( 'ABORT: CaptchaManager is NULL' );
			return $schema;
		}
		
		Logger::debug( 'CaptchaManager->isEnabled(): ' . ( $this->captchaManager->isEnabled() ? 'YES' : 'NO' ) );
		Logger::debug( 'CaptchaManager->isConfigured(): ' . ( $this->captchaManager->isConfigured() ? 'YES' : 'NO' ) );
		
		if ( ! $this->captchaManager->isEnabled() || ! $this->captchaManager->isConfigured() ) {
			Logger::warning( 'ABORT: CAPTCHA not enabled or not configured' );
			return $schema;
		}

		$provider_name = $this->captchaManager->getActiveProviderName();
		Logger::debug( 'Active provider name: ' . $provider_name );

		if ( empty( $provider_name ) ) {
			Logger::warning( 'ABORT: Provider name is empty' );
			return $schema;
		}

		// Recursively inject provider name into fields
		Logger::debug( 'Processing fields to inject provider name' );
		$schema['fields'] = $this->processCaptchaProvider( $schema['fields'] ?? array(), $provider_name );
		Logger::debug( 'Provider name injection complete' );

		return $schema;
	}

	/**
	 * Recursively process fields to inject CAPTCHA provider name
	 *
	 * @param array $fields Array of field definitions
	 * @param string $provider_name Provider name
	 * @return array Modified fields
	 */
	private function processCaptchaProvider( $fields, $provider_name ) {
		foreach ( $fields as &$field ) {
			if ( in_array( $field['type'], array( 'captcha', 'recaptcha', 'hcaptcha', 'turnstile' ), true ) ) {
				$field['config']['providerName'] = $provider_name;
			}

			// Process nested fields (containers, columns)
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

	/**
	 * Save form schema (draft or versioned).
	 *
	 * If activate=false (default for autosave):
	 *   - Saves to draft_schema column (no versioning)
	 *   - Fast, lightweight saves
	 *
	 * If activate=true (manual save or publish):
	 *   - Creates new schema version
	 *   - Activates the version
	 *   - Immutable and public
	 */
	public function save_form_schema( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		// Validate ID
		try {
			$formId = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		// Phase A3-P2: Check If-Match for optimistic locking (schema changes)
		$conflictResponse = $this->guardIfMatch( $request, $form, 'form' );
		if ( $conflictResponse ) {
			return $conflictResponse;
		}

		// Validate input
		$input = $request->get_json_params();
		try {
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $input, Schemas::get( Schemas::FORM_SCHEMA_SAVE ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$schema = $validated['schema'];
		$activate = $validated['activate'] ?? false;

		// Ensure a schema_version exists so server-side validation and versioning
		// can proceed even when clients omit it (clients may rely on server-assigned versions).
		if ( ! isset( $schema['schema_version'] ) ) {
			$schema['schema_version'] = 1;
			// Debug: Log that we injected a default schema_version
			Logger::debug( 'Injected default schema_version=1 for form %d during schema save', $formId );
		}

		// Ensure metadata and metadata.name exist (fallback to form title)
		if ( ! isset( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
			$schema['metadata'] = array();
		}
		if ( empty( $schema['metadata']['name'] ) || ! is_string( $schema['metadata']['name'] ) ) {
			$schema['metadata']['name'] = Helpers::safe_string_get( $form, 'title', 'form_schema' );
			Logger::debug( 'Injected default metadata.name="%s" for form %d during schema save', $schema['metadata']['name'], $formId );
		}

		// Ensure fields array exists (allow empty drafts)
		if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			$schema['fields'] = array();
			Logger::debug( 'Injected default empty fields array for form %d during schema save', $formId );
		}

		// Task 5.5: Structured validation errors for builder UI
		// - Manual save creates an active version (validate basic schema)
		// - If the form is already published, activating a new schema must pass publish validation
		if ( $activate ) {
			$validator        = new \SubtleForms\Support\SchemaValidator();
			$validationErrors = ( $form['status'] ?? '' ) === 'published'
				? $validator->validateForPublishingWithErrors( $schema )
				: $validator->validateWithErrors( $schema );

			if ( ! empty( $validationErrors ) ) {
				return ApiResponse::validation_error(
					__( 'Schema validation failed', 'subtleforms' ),
					$validationErrors
				);
			}
		}

		// Route based on activate flag
		try {
			if ( $activate ) {
				// Manual save or publish: create versioned schema
				$version = $this->formsRepo->saveSchemaVersion( $formId, $schema, true );

				// Verify the schema was saved correctly
				$savedSchema = $this->formsRepo->loadSchemaVersion( $formId, $version );
				if ( ! $savedSchema ) {
					Logger::error( 'Failed to load just-saved schema version %d for form %d', $version, $formId );
					return ApiResponse::server_error( __( 'Schema was saved but could not be loaded back', 'subtleforms' ) );
				}

				return ApiResponse::success(
					array(
						'version' => $version,
						'active'  => true,
					),
					201
				);
			} else {
				// Autosave: save to draft (no versioning)
				$success = $this->formsRepo->saveDraftSchema( $formId, $schema );

				if ( ! $success ) {
					return ApiResponse::server_error( __( 'Failed to save draft schema', 'subtleforms' ) );
				}

				return ApiResponse::success(
					array(
						'draft'  => true,
						'active' => false,
					)
				);
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
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$input = $request->get_json_params();

		// Coerce stringified JSON fields (some clients stringify nested objects accidentally)
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

		// Validate input
		try {
			// Debug log incoming input for troubleshooting
			Logger::debug( 'create_form - raw input: ' . print_r( $input, true ) );
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $input, Schemas::get( Schemas::FORM_CREATE ) );
			// Debug log validated data
			Logger::debug( 'create_form - validated: ' . print_r( $validated, true ) );
		} catch ( ValidationException $e ) {
			Logger::error( 'create_form - validation failed: ' . $e->getMessage() . ' Fields: ' . print_r( $e->getFields(), true ) );
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		// Get default status from settings
		$defaultStatus = $this->settings ? $this->settings->get( 'default_form_status', 'draft' ) : 'draft';

		$data = array(
			'title'  => $validated['title'],
			'config' => $validated['config'] ?? array(),
			'status' => $defaultStatus,
		);

		$id = $this->formsRepo->create( $data );

		// If schema provided, save as initial schema version and activate
		// Use validated schema if present
		$schema = $validated['schema'] ?? null;
		if ( is_array( $schema ) && ! empty( $schema ) ) {
			// Ensure metadata.name exists (prefer form title)
			if ( ! isset( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
				$schema['metadata'] = array();
			}
			if ( empty( $schema['metadata']['name'] ) || ! is_string( $schema['metadata']['name'] ) ) {
				$schema['metadata']['name'] = Helpers::safe_string_get( $validated, 'title', 'form_schema' );
				Logger::debug( 'Injected default metadata.name="%s" for new form %d during create', $schema['metadata']['name'], $id );
			}

			// Ensure fields array exists (allow empty initial schemas)
			if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
				$schema['fields'] = array();
				Logger::debug( 'Injected default empty fields array for new form %d during create', $id );
			}

			try {
				$this->formsRepo->saveSchemaVersion( $id, $schema, true );
			} catch ( \InvalidArgumentException $e ) {
				// If schema is invalid, still return the form but log the error
				Logger::error( 'Failed to save initial schema for form ' . $id . ': ' . $e->getMessage() );
			}
		}

		return ApiResponse::success( array( 'id' => $id ), 201 );
	}

	/**
	 * Update a form.
	 */
	public function update_form( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		// Validate ID
		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$form = $this->formsRepo->find( $id );

		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		// Phase A3-P2: Check If-Match for optimistic locking
		$conflictResponse = $this->guardIfMatch( $request, $form, 'form' );
		if ( $conflictResponse ) {
			return $conflictResponse;
		}

		// Validate input
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

		// CRITICAL: Block publishing if no active schema exists
		if ( isset( $data['status'] ) && $data['status'] === 'published' ) {
			try {
				// First, check if there's a draft schema to promote
				$draftSchema = $this->formsRepo->getDraftSchema( $id );

				if ( $draftSchema ) {
					// Promote draft to active version before publishing
					// Development: Uncomment to debug publish flow
					// error_log(sprintf('SubtleForms: Promoting draft schema to active for form %d before publishing', $id));
					try {
						$this->formsRepo->promoteDraftToActive( $id );
					} catch ( \Exception $e ) {
						Logger::error( 'Failed to promote draft: %s', $e->getMessage() );
						return ApiResponse::server_error( __( 'Cannot publish form: Failed to activate schema.', 'subtleforms' ) . ' ' . $e->getMessage() );
					}
				}

				// Now validate that an active schema exists
				$activeSchema = $this->formsRepo->loadSchemaVersion( $id, null );

				if ( ! $activeSchema ) {
					Logger::error( 'No active schema found for form %d after promotion attempt', $id );
					return ApiResponse::bad_request( __( 'Cannot publish form: No schema exists. Please save your form first.', 'subtleforms' ) );
				}

				// Check if the loaded schema is actually active
				if ( ! isset( $activeSchema['active'] ) || $activeSchema['active'] != 1 ) {
					return ApiResponse::bad_request( __( 'Cannot publish form: No active schema version. Please save and activate a schema first.', 'subtleforms' ) );
				}

				// loadSchemaVersion returns decoded schema in 'schema' key, not 'schema_data'
				$schemaData = $activeSchema['schema'] ?? null;
				if ( ! $schemaData || ! is_array( $schemaData ) ) {
					Logger::error(
						sprintf(
							'SubtleForms: Schema missing or invalid for form %d. Available keys: %s',
							$id,
							implode( ', ', array_keys( $activeSchema ) )
						)
					);
					return ApiResponse::bad_request( __( 'Cannot publish form: Schema data is corrupt or invalid. Check error logs for details.', 'subtleforms' ) );
				}

				// Run comprehensive publish validation
				$validator        = new \SubtleForms\Support\SchemaValidator();
				$validationErrors = $validator->validateForPublishingWithErrors( $schemaData );

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

		// Phase A3-P2: Return updated form with new ETag
		$updatedForm = $this->formsRepo->find( $id );
		$etag        = $this->generateETag( $updatedForm, 'form' );
		$response    = ApiResponse::success( array( 'success' => true, 'form' => $updatedForm ) );
		return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
	}

	/**
	 * Delete a form.
	 */
	public function delete_form( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		// Validate ID
		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$form = $this->formsRepo->find( $id );

		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		// Phase A3-P2: Check If-Match for optimistic locking (optional for DELETE)
		$conflictResponse = $this->guardIfMatch( $request, $form, 'form' );
		if ( $conflictResponse ) {
			return $conflictResponse;
		}

		$this->formsRepo->delete( $id );

		return ApiResponse::success( array( 'success' => true ) );
	}

	/**
	 * Get submissions for a form.
	 */
	public function get_submissions( WP_REST_Request $request ): WP_REST_Response {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$args = array(
			'form_id' => $request->get_param( 'form_id' ),
			'limit'   => intval( $request->get_param( 'per_page' ) ?? 20 ),
			'offset'  => intval( $request->get_param( 'offset' ) ?? 0 ),
			'orderby' => 'created_at',
			'order'   => 'DESC',
		);

		$submissions = $this->submissionsRepo->findAll( $args );
		$total       = $this->submissionsRepo->count( $args );

		return ApiResponse::paginated(
			$submissions,
			$total,
			($args['offset'] / $args['limit']) + 1,
			$args['limit']
		);
	}

	/**
	 * Get all submissions with optional filtering (v0.9.0+ enhanced v0.9.1 for search).
	 */
	public function get_all_submissions( WP_REST_Request $request ): WP_REST_Response {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		// Validate pagination parameters
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
			'orderby' => 'created_at',
			'order'   => 'DESC',
		);

		$submissions = $this->submissionsRepo->findAll( $args );
		$total       = $this->submissionsRepo->count( $args );

		// Bulk fetch form titles to avoid N+1 queries (v1.8.2 - Phase B3)
		$form_ids = array_unique( array_filter( array_column( $submissions, 'form_id' ) ) );
		$forms_map = $this->formsRepo->findMultiple( $form_ids );

		// Enhance with form titles
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
			($args['offset'] / $args['limit']) + 1,
			$args['limit']
		);
	}

	/**
	 * Get a single submission (v0.9.1: auto-marks as read).
	 */
	public function get_submission( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		// Validate ID
		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$submission = $this->submissionsRepo->find( $id );

		if ( ! $submission ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}

		// Auto-mark as read when viewed
		if ( $submission['status'] === 'unread' ) {
			$this->submissionsRepo->update( $submission['id'], array( 'status' => 'read' ) );
			$submission['status'] = 'read';
		}

		// Enhance with form info
		if ( $submission['form_id'] ) {
			$form                     = $this->formsRepo->find( $submission['form_id'] );
			$submission['form_title'] = $form['title'] ?? __( 'Unknown Form', 'subtleforms' );

			// Load schema to get field labels
			try {
				$schemaVersion        = $submission['schema_version'] ?? null;
				$schema               = $this->formsRepo->loadSchemaVersion( $submission['form_id'], $schemaVersion );
				$submission['schema'] = $schema['schema'] ?? null;
			} catch ( \RuntimeException $e ) {
				$submission['schema'] = null;
			}

			// Enhance with adjacent IDs for navigation
			$adjacent              = $this->submissionsRepo->getAdjacentIds( $submission['id'], $submission['form_id'] );
			$submission['next_id'] = $adjacent['next'];
			$submission['prev_id'] = $adjacent['prev'];
		}

		// Phase A3-P2: Add ETag header for optimistic locking
		$etag     = $this->generateETag( $submission, 'submission' );
		$response = ApiResponse::success( $submission );
		return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
	}

	/**
	 * Update a submission (v0.9.1: for status changes).
	 */
	public function update_submission( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		// Validate ID
		try {
			$id = Schemas::validateId( $request->get_param( 'id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		$submission = $this->submissionsRepo->find( $id );

		if ( ! $submission ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}

		// Phase A3-P2: Check If-Match for optimistic locking
		$conflictResponse = $this->guardIfMatch( $request, $submission, 'submission' );
		if ( $conflictResponse ) {
			return $conflictResponse;
		}

		// Validate input
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

		// Phase A3-P2: Return updated submission with new ETag
		$updatedSubmission = $this->submissionsRepo->find( $id );
		$etag              = $this->generateETag( $updatedSubmission, 'submission' );
		$response          = ApiResponse::success( array( 'success' => true, 'submission' => $updatedSubmission ) );
		return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
	}

	/**
	 * Get adjacent submission IDs (v0.9.4).
	 */
	public function get_adjacent_submissions( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
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
	public function get_submission_logs( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$submissionId = intval( $request->get_param( 'id' ) );

		$submission = $this->submissionsRepo->find( $submissionId );
		if ( ! $submission ) {
			return ApiResponse::not_found( __( 'Submission not found', 'subtleforms' ) );
		}

		// Use LogsRepository to fetch logs
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
	public function get_unread_count( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
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
	 * Submit a form (public endpoint).
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function submit_form( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		// Resolve client IP for submission tracking and rate limiting
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';

		// Validate form ID
		try {
			$formId = Schemas::validateId( $request->get_param( 'form_id' ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		// Validate and sanitize submission payload
		$rawInput = $request->get_json_params();
		if ( ! is_array( $rawInput ) ) {
			$rawInput = array();
		}

		try {
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $rawInput, Schemas::get( Schemas::PUBLIC_SUBMIT ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		}

		// Extract validated and sanitized payload
		$payload = $validated['data'] ?? array();
		// Phase A2-P3: Deeply sanitize payload to strip ALL HTML (XSS prevention)
		$payload = Sanitizer::sanitizeSubmissionValue( $payload );

		// Check spam protection (honeypot + time trap)
		if ( \SubtleForms\Engine\SpamProtection::is_enabled() ) {
			$tempContext = new SubmissionContext( $formId, $payload );
			if ( \SubtleForms\Engine\SpamProtection::is_spam( $tempContext ) ) {
				$reason = $tempContext->getMeta( 'spam_reason', 'spam_detected' );
				Logger::info( 'Spam blocked (form %d): %s', $formId, $reason );
				return ApiResponse::success(
					array(
						'success' => true,
						'message' => __( 'Thank you.', 'subtleforms' ),
					)
				);
			}
		}

		// Verify CAPTCHA if enabled
		if ( $this->captchaManager && $this->captchaManager->isEnabled() && $this->captchaManager->isConfigured() ) {
			$verification = $this->captchaManager->verify( $payload );
			if ( ! $verification['success'] ) {
				return ApiResponse::bad_request(
					$verification['error'] ?? __( 'CAPTCHA verification failed.', 'subtleforms' )
				);
			}
		}

		// Verify form exists
		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		// Check submission limit if enabled
		$settings = get_option( 'subtleforms_settings', array() );
		if ( ! empty( $settings['submission_limit_enabled'] ) ) {
			$limit    = isset( $settings['submission_limit'] ) ? (int) $settings['submission_limit'] : 1;
			$user_key = get_current_user_id();

			// If not logged in, use IP address as identifier
			if ( ! $user_key && $ip ) {
				$user_key = 'ip_' . md5( $ip );
			}

			if ( $user_key ) {
				// Count existing submissions from this user/IP for this form
				global $wpdb;
				$table_name = $wpdb->prefix . 'subtleforms_submissions';
				$count      = $wpdb->get_var(
					$wpdb->prepare(
						"SELECT COUNT(*) FROM {$table_name} WHERE form_id = %d AND (user_id = %d OR ip_address = %s) AND status != 'spam'",
						$formId,
						is_numeric( $user_key ) ? $user_key : 0,
						$ip ? $ip : ''
					)
				);

				if ( $count >= $limit ) {
					return ApiResponse::forbidden(
						__( 'You have reached the maximum number of submissions for this form.', 'subtleforms' )
					);
				}
			}
		}

		// Resolve active schema version for this form and attach to submission
		try {
			$activeSchema = $this->formsRepo->loadSchemaVersion( $formId );
		} catch ( \RuntimeException $e ) {
			Logger::error( 'Submission Error: ' . $e->getMessage() );
			return ApiResponse::server_error(
				'Failed to load form schema: ' . $e->getMessage()
			);
		}
		$formVersion = $activeSchema['version'] ?? null;

		// Create submission record (store schema_version)
		try {
			$submissionId = $this->submissionsRepo->create(
				array(
					'form_id'        => $formId,
					'schema_version' => $formVersion,
					'payload'        => $payload,
					'status'         => 'processing',
					'ip_address'     => $ip ?: null,
					'user_agent'     => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : null,
				)
			);
		} catch ( \RuntimeException $e ) {
			Logger::error( 'Failed to create submission record: ' . $e->getMessage() );
			return ApiResponse::server_error( 'Failed to create submission record' );
		}

		// Create submission context
		$context = new SubmissionContext( $formId, $payload );
		$context->setMeta( 'submission_id', $submissionId );
		// Attach schema version used for this submission for logging
		$context->setMeta( 'schema_version', is_int( $formVersion ) ? $formVersion : null );

		// Detect payment form and prepare payment metadata
		$isPaymentForm   = false;
		$paymentMetadata = null;
		if ( ! empty( $activeSchema['schema']['metadata']['type'] ) &&
			$activeSchema['schema']['metadata']['type'] === 'payment' ) {
			$isPaymentForm = true;

			// Extract payment settings
			$paymentSettings = $activeSchema['schema']['metadata']['payment'] ?? array();

			// Calculate payment amount
			$amount = 0;
			if ( ! empty( $paymentSettings['enabled'] ) ) {
				if ( ( $paymentSettings['amountType'] ?? 'fixed' ) === 'fixed' ) {
					$amount = floatval( $paymentSettings['fixedAmount'] ?? 0 );
				} elseif ( ( $paymentSettings['amountType'] ?? '' ) === 'field' ) {
					$amountField = $paymentSettings['amountField'] ?? '';
					if ( ! empty( $amountField ) && isset( $payload[ $amountField ] ) ) {
						$amount = floatval( $payload[ $amountField ] );
					}
				}
			}

			// Prepare payment intent metadata
			$paymentMetadata = array(
				'status'         => 'pending',
				'amount'         => $amount,
				'currency'       => $paymentSettings['currency'] ?? 'USD',
				'mode'           => $paymentSettings['mode'] ?? 'test',
				'gateway'        => null, // Will be set by payment gateway extension
				'transaction_id' => null,
				'created_at'     => current_time( 'mysql' ),
			);

			// Store payment metadata in context for extensions
			$context->setMeta( 'payment_intent', $paymentMetadata );
			$context->setMeta( 'is_payment_form', true );
		}

		// If there's an active schema, compile it to deterministic pipeline steps and run.
		if ( ! empty( $activeSchema['schema'] ) && is_array( $activeSchema['schema'] ) ) {
			// Attach schema to context for conditional logic and validation
			$context->setMeta( 'form_schema', $activeSchema['schema'] );

			try {
				$steps = $this->compiler->compile( $activeSchema['schema'] );
			} catch ( \InvalidArgumentException $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				Logger::error( 'Schema compilation failed for form ' . $formId . ': ' . $e->getMessage() );
				return ApiResponse::bad_request( $e->getMessage() );
			}

			try {
				$result = $this->pipeline->run( $steps, $context, $activeSchema['schema'] );
			} catch ( \RuntimeException $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				Logger::error( 'Pipeline execution failed for submission ' . $submissionId . ': ' . $e->getMessage() );

				// Check if this is a validation error with field details
				$validationErrors = $context->getMeta( 'validation_errors' );
				if ( is_array( $validationErrors ) && ! empty( $validationErrors ) ) {
					return ApiResponse::validation_error(
						'Form validation failed',
						$validationErrors
					);
				}

				// Generic pipeline failure
				return ApiResponse::server_error( $e->getMessage() );
			} catch ( \Throwable $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				Logger::error( 'Unexpected error in submission ' . $submissionId . ': ' . $e->getMessage() );
				return ApiResponse::server_error( __( 'An unexpected error occurred', 'subtleforms' ) );
			}

			if ( ! $result->ok ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				Logger::error( 'Pipeline execution failed for submission ' . $submissionId . ': ' . $result->error );
				return ApiResponse::server_error( $result->error );
			}

			// Check final submission status - if SaveAction set it to 'saved', update to 'completed'
			$finalSubmission = $this->submissionsRepo->find( $submissionId );
			if ( $finalSubmission && $finalSubmission['status'] === 'saved' ) {
				// For payment forms, keep status as 'saved' until payment is processed
				if ( ! $isPaymentForm ) {
					$this->submissionsRepo->update( $submissionId, array( 'status' => 'completed' ) );
				} else {
					// Store payment metadata in submission
					if ( $paymentMetadata ) {
						$currentMeta = $finalSubmission['meta'] ?? array();
						if ( ! is_array( $currentMeta ) ) {
							$currentMeta = array();
						}

						$currentMeta['payment'] = $paymentMetadata;

						$this->submissionsRepo->update(
							$submissionId,
							array(
								'status' => 'payment_pending',
								'meta'   => $currentMeta,
							)
						);
					}

					/**
					 * Hook: subtleforms_payment_required
					 *
					 * Allows payment gateway extensions to process payment before completing submission.
					 * Extensions should update submission status and payment metadata.
					 *
					 * @param int $submissionId The submission ID
					 * @param array $paymentMetadata Payment intent data
					 * @param SubmissionContext $context Full submission context
					 *
					 * @since 1.2.0
					 */
					do_action( 'subtleforms_payment_required', $submissionId, $paymentMetadata, $context );
				}
			} elseif ( ! $finalSubmission || $finalSubmission['status'] === 'processing' ) {
				// SaveAction didn't run or failed - mark as failed
				Logger::error( 'Submission ' . $submissionId . ' did not reach saved status' );
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				return ApiResponse::server_error( 'Failed to save submission data' );
			}

			$payloadResult = null;
			if ( is_object( $result ) ) {
				$payloadResult = method_exists( $result, 'toArray' ) ? $result->toArray() : null;
			} else {
				$payloadResult = $result;
			}

			return ApiResponse::success(
				array(
					'success'       => true,
					'submission_id' => $submissionId,
				)
			);
		}

		// No schema configured; mark completed
		$this->submissionsRepo->update( $submissionId, array( 'status' => 'completed' ) );

		return ApiResponse::success(
			array(
				'success'       => true,
				'submission_id' => $submissionId,
			),
			200
		);
	}

	/**
	 * Check if user can read forms.
	 */
	public function check_read_permission(): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}

		// All admin API endpoints require a WordPress capability.
		if ( ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		return (bool) $this->gate->allows( 'api.read' );
	}

	/**
	 * Check if user can write forms.
	 */
	public function check_write_permission(): bool {
		if ( ! is_user_logged_in() ) {
			return false;
		}

		// All admin API endpoints require a WordPress capability.
		if ( ! current_user_can( 'manage_options' ) ) {
			return false;
		}

		return (bool) $this->gate->allows( 'api.write' );
	}

	/**
	 * Get all registered field definitions.
	 */
	public function get_fields( WP_REST_Request $request ): WP_REST_Response {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$grouped = $request->get_param( 'grouped' );
		// Debug: log invocation and grouped param
		Logger::debug( 'get_fields called with grouped=%s by user=%d', var_export( $grouped, true ), get_current_user_id() );

		// Get CAPTCHA enabled states from settings
		$captchaEnabled = $this->settings ? (bool) $this->settings->get( 'captcha_enabled', false ) : false;
		$recaptchaEnabled = $this->settings ? (bool) $this->settings->get( 'captcha_recaptcha_enabled', false ) : false;
		$hcaptchaEnabled = $this->settings ? (bool) $this->settings->get( 'captcha_hcaptcha_enabled', false ) : false;
		$turnstileEnabled = $this->settings ? (bool) $this->settings->get( 'captcha_turnstile_enabled', false ) : false;

		if ( $grouped === 'true' || $grouped === '1' ) {
			$fields = $this->fieldRegistry->byCategory();
			// Convert FieldDefinition objects to arrays and add enabled status
			$fields = array_map(
				function ( $categoryFields ) use ( $captchaEnabled, $recaptchaEnabled, $hcaptchaEnabled, $turnstileEnabled ) {
					return array_map(
						function ( $field ) use ( $captchaEnabled, $recaptchaEnabled, $hcaptchaEnabled, $turnstileEnabled ) {
							$fieldArray = $field->toArray();
							
							// Add enabled status for System CAPTCHA fields
							if ( $field->type === 'recaptcha' ) {
								$fieldArray['enabled'] = $captchaEnabled && $recaptchaEnabled;
							} elseif ( $field->type === 'hcaptcha' ) {
								$fieldArray['enabled'] = $captchaEnabled && $hcaptchaEnabled;
							} elseif ( $field->type === 'turnstile' ) {
								$fieldArray['enabled'] = $captchaEnabled && $turnstileEnabled;
							} else {
								$fieldArray['enabled'] = true; // All non-CAPTCHA fields are always enabled
							}
							
							return $fieldArray;
						},
						$categoryFields
					);
				},
				$fields
			);
		} else {
			$fields = $this->fieldRegistry->toArray();
			// Add enabled status for non-grouped response
			$fields = array_map(
				function ( $fieldArray ) use ( $captchaEnabled, $recaptchaEnabled, $hcaptchaEnabled, $turnstileEnabled ) {
					if ( isset( $fieldArray['type'] ) ) {
						if ( $fieldArray['type'] === 'recaptcha' ) {
							$fieldArray['enabled'] = $captchaEnabled && $recaptchaEnabled;
						} elseif ( $fieldArray['type'] === 'hcaptcha' ) {
							$fieldArray['enabled'] = $captchaEnabled && $hcaptchaEnabled;
						} elseif ( $fieldArray['type'] === 'turnstile' ) {
							$fieldArray['enabled'] = $captchaEnabled && $turnstileEnabled;
						} else {
							$fieldArray['enabled'] = true;
						}
					}
					return $fieldArray;
				},
				$fields
			);
		}

		// Debug: Log the fields response shape for troubleshooting
		Logger::debug( 'get_fields response: %s', print_r( $fields, true ) );

		return ApiResponse::success( $fields );
	}

	/**
	 * Get form templates.
	 */
	public function get_templates( WP_REST_Request $request ): WP_REST_Response {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$templates = \SubtleForms\Templates\FormTemplates::get_all();

		return ApiResponse::success(
			array(
				'success'   => true,
				'templates' => $templates,
			)
		);
	}

	/**
	 * Export submissions as CSV.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response Response with CSV data.
	 */
	public function export_submissions_csv( WP_REST_Request $request ): WP_REST_Response {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$params = $request->get_json_params();

		// Build query args from request
		$args = array(
			'form_id' => isset( $params['form_id'] ) ? intval( $params['form_id'] ) : null,
			'status'  => isset( $params['status'] ) ? Helpers::safe_sanitize_text( $params['status'] ) : null,
			'search'  => isset( $params['search'] ) ? Helpers::safe_sanitize_text( $params['search'] ) : null,
			'orderby' => 'created_at',
			'order'   => 'DESC',
			'limit'   => 10000, // Max export limit
		);

		// Remove null values
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

		// Build CSV data
		$csv_data = array();

		// Determine all field keys from first submission
		$first_submission = $submissions[0];
		$payload          = is_string( $first_submission['payload'] )
			? json_decode( $first_submission['payload'], true )
			: $first_submission['payload'];

		// CSV Headers
		$headers = array(
			__( 'ID', 'subtleforms' ),
			__( 'Form ID', 'subtleforms' ),
			__( 'Status', 'subtleforms' ),
			__( 'Submitted At', 'subtleforms' ),
		);

		// Add field headers from payload
		if ( is_array( $payload ) ) {
			foreach ( array_keys( $payload ) as $field_key ) {
				// Skip honeypot fields
				if ( in_array( $field_key, array( 'website_url', 'form_rendered_at' ), true ) ) {
					continue;
				}
				$headers[] = ucwords( str_replace( '_', ' ', $field_key ) );
			}
		}

		$csv_data[] = $headers;

		// Add submission rows
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

			// Add field values
			if ( is_array( $payload ) ) {
				foreach ( array_keys( $first_submission['payload'] ) as $field_key ) {
					// Skip honeypot fields
					if ( in_array( $field_key, array( 'website_url', 'form_rendered_at' ), true ) ) {
						continue;
					}

					$value = $payload[ $field_key ] ?? '';

					// Handle arrays (checkboxes, multi-select)
					if ( is_array( $value ) ) {
						$value = implode( ', ', $value );
					}

					$row[] = $value;
				}
			}

			$csv_data[] = $row;
		}

		// Convert to CSV string with UTF-8 BOM for Excel compatibility
		$csv_string = "\xEF\xBB\xBF"; // UTF-8 BOM

		foreach ( $csv_data as $row ) {
			// Escape values and wrap in quotes
			$escaped_row = array_map(
				function ( $value ) {
					$value = str_replace( '"', '""', $value ); // Escape quotes
					return '"' . $value . '"';
				},
				$row
			);

			$csv_string .= implode( ',', $escaped_row ) . "\r\n";
		}

		// Generate filename
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
