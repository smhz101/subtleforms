<?php
/**
 * SubtleForms REST API Controller
 *
 * @package   SubtleForms\Api
 * @version   0.1.0
 */

namespace SubtleForms\Api;

use SubtleForms\Support\Helpers;
use SubtleForms\Api\SettingsApi;
use SubtleForms\Api\DashboardApi;

use SubtleForms\Engine\Pipeline;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\Settings;
use SubtleForms\Support\Captcha\CaptchaManager;
use SubtleForms\Engine\SchemaCompiler;
use SubtleForms\Fields\FieldRegistry;
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

		// Onboarding endpoints
		register_rest_route(
			self::NAMESPACE,
			'/onboarding/send-test-email',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'send_onboarding_test_email' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
			),
		);
		register_rest_route(
			self::NAMESPACE,
			'/onboarding/dismiss',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'dismiss_onboarding' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/onboarding/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_onboarding_status' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		// Create form wizard endpoints (per-user)
		register_rest_route(
			self::NAMESPACE,
			'/create-wizard/dismiss',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'dismiss_create_wizard' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/create-wizard/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_create_wizard_status' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		// Builder tour endpoints
		register_rest_route(
			self::NAMESPACE,
			'/tour/complete',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'complete_tour' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/tour/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_tour_status' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

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
	 * Get all forms.
	 */
	public function get_forms( WP_REST_Request $request ): WP_REST_Response {
		$page     = max( 1, intval( $request->get_param( 'page' ) ) ?: 1 );
		$per_page = min( 100, max( 1, intval( $request->get_param( 'per_page' ) ) ?: 20 ) );
		$offset   = ( $page - 1 ) * $per_page;

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
		foreach ( $forms as &$form ) {
			$form['submission_count'] = $this->submissionsRepo->count( array( 'form_id' => $form['id'] ) );
			$form['unread_count']     = $this->submissionsRepo->count(
				array(
					'form_id' => $form['id'],
					'status'  => 'unread',
				)
			);
		}

		$response = new WP_REST_Response( $forms, 200 );
		$response->header( 'X-WP-Total', $total );
		$response->header( 'X-WP-TotalPages', ceil( $total / $per_page ) );

		return $response;
	}

	/**
	 * Get a single form.
	 */
	public function get_form( WP_REST_Request $request ) {
		$form = $this->formsRepo->find( $request->get_param( 'id' ) );

		if ( ! $form ) {
			return new WP_Error( 'form_not_found', __( 'Form not found', 'subtleforms' ), array( 'status' => 404 ) );
		}

		return new WP_REST_Response( $form, 200 );
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

		// Verify form exists first
		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return new WP_Error( 'form_not_found', __( 'Form not available', 'subtleforms' ), array( 'status' => 404 ) );
		}

		$isAuthenticated = is_user_logged_in() && current_user_can( 'edit_posts' );
		$isPublished     = isset( $form['status'] ) && $form['status'] === 'published';
		$requestsDraft   = $context === 'builder';

		// PUBLIC ACCESS (unauthenticated): Only active schema for published forms
		if ( ! $isAuthenticated ) {
			if ( ! $isPublished ) {
				return new WP_Error( 'form_not_available', __( 'Form not available', 'subtleforms' ), array( 'status' => 404 ) );
			}

			// Load active schema only
			try {
				$schema = $this->formsRepo->loadSchemaVersion( $formId, $version );
			} catch ( \RuntimeException $e ) {
				error_log( 'SubtleForms API Error: ' . $e->getMessage() );
				return new WP_Error( 'schema_not_available', __( 'Schema not available', 'subtleforms' ), array( 'status' => 404 ) );
			}

			if ( ! $schema ) {
				return new WP_Error( 'schema_not_available', __( 'Schema not available', 'subtleforms' ), array( 'status' => 404 ) );
			}

			// Inject CAPTCHA HTML for frontend rendering
			$schemaData = $schema['schema'] ?? $schema;
			$schemaData = $this->injectCaptchaHtml( $schemaData );

			return new WP_REST_Response(
				array(
					'form'    => $form,
					'schema'  => $schemaData,
					'version' => $schema['version'] ?? null,
				),
				200
			);
		}

		// AUTHENTICATED ACCESS: Allow draft schema with explicit context=builder
		if ( $requestsDraft && ! $version ) {
			$draftSchema = $this->formsRepo->getDraftSchema( $formId );

			if ( $draftSchema ) {
				return new WP_REST_Response(
					array(
						'form'    => $form,
						'schema'  => $draftSchema,
						'version' => null,
						'draft'   => true,
					),
					200
				);
			}
		}

		// Fall back to versioned schema (authenticated users)
		try {
			$schema = $this->formsRepo->loadSchemaVersion( $formId, $version );
		} catch ( \RuntimeException $e ) {
			error_log( 'SubtleForms API Error: ' . $e->getMessage() );
			return new WP_Error(
				'schema_load_failed',
				'Failed to load form schema',
				array( 'status' => 500 )
			);
		}

		if ( ! $schema ) {
			// Return empty schema for authenticated users creating new forms
			return new WP_REST_Response(
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
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'form'    => $form,
				'schema'  => $schema['schema'] ?? $schema,
				'version' => $schema['version'] ?? null,
			),
			200
		);
	}

	/**
	 * Inject CAPTCHA HTML into schema fields for frontend rendering
	 *
	 * @param array $schema Form schema
	 * @return array Modified schema with CAPTCHA HTML
	 */
	private function injectCaptchaHtml( $schema ) {
		if ( ! $this->captchaManager || ! $this->captchaManager->isEnabled() || ! $this->captchaManager->isConfigured() ) {
			return $schema;
		}

		$captcha_html = $this->captchaManager->render();

		if ( empty( $captcha_html ) ) {
			return $schema;
		}

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
		foreach ( $fields as &$field ) {
			if ( in_array( $field['type'], array( 'captcha', 'recaptcha', 'hcaptcha', 'turnstile' ), true ) ) {
				$field['config']['captchaHtml'] = $captcha_html;
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
		$formId = intval( $request->get_param( 'id' ) );

		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return new WP_Error( 'form_not_found', __( 'Form not found', 'subtleforms' ), array( 'status' => 404 ) );
		}

		$params = $request->get_json_params();
		$schema = $params['schema'] ?? null;
		// Safe default: do NOT activate unless explicitly requested
		// This prevents autosave from creating active versions
		$activate = isset( $params['activate'] ) && $params['activate'] === true;

		if ( ! is_array( $schema ) ) {
			return new WP_Error( 'invalid_schema', __( 'Schema must be a JSON object', 'subtleforms' ), array( 'status' => 400 ) );
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
				return new WP_Error(
					'schema_validation_failed',
					'Schema validation failed',
					array(
						'status' => 422,
						'errors' => $validationErrors,
					)
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
					error_log( sprintf( 'SubtleForms: Failed to load just-saved schema version %d for form %d', $version, $formId ) );
					return new WP_Error( 'save_verification_failed', __( 'Schema was saved but could not be loaded back', 'subtleforms' ), array( 'status' => 500 ) );
				}

				return new WP_REST_Response(
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
					return new WP_Error( 'save_failed', __( 'Failed to save draft schema', 'subtleforms' ), array( 'status' => 500 ) );
				}

				return new WP_REST_Response(
					array(
						'draft'  => true,
						'active' => false,
					),
					200
				);
			}
		} catch ( \InvalidArgumentException $e ) {
			error_log( sprintf( 'SubtleForms: Schema validation error for form %d: %s', $formId, $e->getMessage() ) );
			return new WP_Error( 'invalid_schema', $e->getMessage(), array( 'status' => 400 ) );
		} catch ( \RuntimeException $e ) {
			error_log( sprintf( 'SubtleForms: Save failed for form %d: %s', $formId, $e->getMessage() ) );
			return new WP_Error( 'save_failed', $e->getMessage(), array( 'status' => 500 ) );
		}
	}

	/**
	 * Create a new form.
	 */
	public function create_form( WP_REST_Request $request ): WP_REST_Response {
		$params = $request->get_json_params();

		// Get default status from settings
		$defaultStatus = $this->settings ? $this->settings->get( 'default_form_status', 'draft' ) : 'draft';

		$data = array(
			'title'  => $params['title'] ?? 'Untitled Form',
			'config' => $params['config'] ?? array(),
			'status' => $params['status'] ?? $defaultStatus,
		);

		$id = $this->formsRepo->create( $data );

		// If schema provided, save as initial schema version and activate
		$schema = $params['schema'] ?? null;
		if ( is_array( $schema ) && ! empty( $schema ) ) {
			try {
				$this->formsRepo->saveSchemaVersion( $id, $schema, true );
			} catch ( \InvalidArgumentException $e ) {
				// If schema is invalid, still return the form but log the error
				error_log( 'Failed to save initial schema for form ' . $id . ': ' . $e->getMessage() );
			}
		}

		return new WP_REST_Response( array( 'id' => $id ), 201 );
	}

	/**
	 * Update a form.
	 */
	public function update_form( WP_REST_Request $request ) {
		$id   = $request->get_param( 'id' );
		$form = $this->formsRepo->find( $id );

		if ( ! $form ) {
			return new WP_Error( 'form_not_found', __( 'Form not found', 'subtleforms' ), array( 'status' => 404 ) );
		}

		$data = array_filter(
			array(
				'title'  => $request->get_param( 'title' ),
				'config' => $request->get_param( 'config' ),
				'status' => $request->get_param( 'status' ),
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
						error_log( sprintf( 'SubtleForms: Failed to promote draft: %s', $e->getMessage() ) );
						return new WP_Error(
							'publish_blocked',
							'Cannot publish form: Failed to activate schema. ' . $e->getMessage(),
							array( 'status' => 500 )
						);
					}
				}

				// Now validate that an active schema exists
				$activeSchema = $this->formsRepo->loadSchemaVersion( $id, null );

				if ( ! $activeSchema ) {
					error_log( sprintf( 'SubtleForms: No active schema found for form %d after promotion attempt', $id ) );
					return new WP_Error(
						'publish_blocked',
						'Cannot publish form: No schema exists. Please save your form first.',
						array( 'status' => 400 )
					);
				}

				// Check if the loaded schema is actually active
				if ( ! isset( $activeSchema['active'] ) || $activeSchema['active'] != 1 ) {
					return new WP_Error(
						'publish_blocked',
						'Cannot publish form: No active schema version. Please save and activate a schema first.',
						array( 'status' => 400 )
					);
				}

				// loadSchemaVersion returns decoded schema in 'schema' key, not 'schema_data'
				$schemaData = $activeSchema['schema'] ?? null;
				if ( ! $schemaData || ! is_array( $schemaData ) ) {
					error_log(
						sprintf(
							'SubtleForms: Schema missing or invalid for form %d. Available keys: %s',
							$id,
							implode( ', ', array_keys( $activeSchema ) )
						)
					);
					return new WP_Error(
						'publish_blocked',
						'Cannot publish form: Schema data is corrupt or invalid. Check error logs for details.',
						array( 'status' => 400 )
					);
				}

				// Run comprehensive publish validation
				$validator        = new \SubtleForms\Support\SchemaValidator();
				$validationErrors = $validator->validateForPublishingWithErrors( $schemaData );

				if ( ! empty( $validationErrors ) ) {
					return new WP_Error(
						'publish_blocked',
						'Cannot publish form: Fix validation errors.',
						array(
							'status' => 422,
							'errors' => $validationErrors,
						)
					);
				}
			} catch ( \RuntimeException $e ) {
				return new WP_Error(
					'publish_blocked',
					'Cannot publish form: ' . $e->getMessage(),
					array( 'status' => 500 )
				);
			}
		}

		$this->formsRepo->update( $id, $data );

		return new WP_REST_Response( array( 'success' => true ), 200 );
	}

	/**
	 * Delete a form.
	 */
	public function delete_form( WP_REST_Request $request ) {
		$id   = $request->get_param( 'id' );
		$form = $this->formsRepo->find( $id );

		if ( ! $form ) {
			return new WP_Error( 'form_not_found', __( 'Form not found', 'subtleforms' ), array( 'status' => 404 ) );
		}

		$this->formsRepo->delete( $id );

		return new WP_REST_Response( array( 'success' => true ), 200 );
	}

	/**
	 * Get submissions for a form.
	 */
	public function get_submissions( WP_REST_Request $request ): WP_REST_Response {
		$args = array(
			'form_id' => $request->get_param( 'form_id' ),
			'limit'   => intval( $request->get_param( 'per_page' ) ?? 20 ),
			'offset'  => intval( $request->get_param( 'offset' ) ?? 0 ),
			'orderby' => 'created_at',
			'order'   => 'DESC',
		);

		$submissions = $this->submissionsRepo->findAll( $args );
		$total       = $this->submissionsRepo->count( $args );

		return new WP_REST_Response(
			array(
				'submissions' => $submissions,
				'total'       => $total,
				'per_page'    => $args['limit'],
				'offset'      => $args['offset'],
			),
			200
		);
	}

	/**
	 * Get all submissions with optional filtering (v0.9.0+ enhanced v0.9.1 for search).
	 */
	public function get_all_submissions( WP_REST_Request $request ): WP_REST_Response {
		$args = array(
			'form_id' => $request->get_param( 'form_id' ),
			'status'  => $request->get_param( 'status' ),
			'search'  => $request->get_param( 'search' ),
			'limit'   => intval( $request->get_param( 'per_page' ) ?? 20 ),
			'offset'  => intval( $request->get_param( 'offset' ) ?? 0 ),
			'orderby' => 'created_at',
			'order'   => 'DESC',
		);

		$submissions = $this->submissionsRepo->findAll( $args );
		$total       = $this->submissionsRepo->count( $args );

		// Enhance with form titles
		foreach ( $submissions as &$sub ) {
			if ( Helpers::safe_array_get( $sub, 'form_id' ) ) {
				$form = $this->formsRepo->find( $sub['form_id'] );
				if ( is_array( $form ) ) {
					$sub['form_title'] = Helpers::safe_array_get( $form, 'title', __( 'Unknown Form', 'subtleforms' ) );
				} else {
					$sub['form_title'] = __( 'Unknown Form', 'subtleforms' );
				}
			}
		}

		return new WP_REST_Response(
			array(
				'submissions' => $submissions,
				'total'       => $total,
				'per_page'    => $args['limit'],
				'offset'      => $args['offset'],
			),
			200
		);
	}

	/**
	 * Get a single submission (v0.9.1: auto-marks as read).
	 */
	public function get_submission( WP_REST_Request $request ) {
		$submission = $this->submissionsRepo->find( $request->get_param( 'id' ) );

		if ( ! $submission ) {
			return new WP_Error( 'submission_not_found', __( 'Submission not found', 'subtleforms' ), array( 'status' => 404 ) );
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

		return new WP_REST_Response( $submission, 200 );
	}

	/**
	 * Update a submission (v0.9.1: for status changes).
	 */
	public function update_submission( WP_REST_Request $request ) {
		$id         = intval( $request->get_param( 'id' ) );
		$submission = $this->submissionsRepo->find( $id );

		if ( ! $submission ) {
			return new WP_Error( 'submission_not_found', __( 'Submission not found', 'subtleforms' ), array( 'status' => 404 ) );
		}

		$params = $request->get_json_params();
		$data   = array_filter(
			array(
				'status' => $params['status'] ?? null,
			),
			fn( $value ) => $value !== null
		);

		if ( empty( $data ) ) {
			return new WP_Error( 'no_changes', __( 'No valid changes provided', 'subtleforms' ), array( 'status' => 400 ) );
		}

		$this->submissionsRepo->update( $id, $data );

		return new WP_REST_Response( array( 'success' => true ), 200 );
	}

	/**
	 * Get adjacent submission IDs (v0.9.4).
	 */
	public function get_adjacent_submissions( WP_REST_Request $request ) {
		$id     = intval( $request->get_param( 'id' ) );
		$formId = $request->get_param( 'form_id' ) ? intval( $request->get_param( 'form_id' ) ) : null;

		$submission = $this->submissionsRepo->find( $id );
		if ( ! $submission ) {
			return new WP_Error( 'submission_not_found', __( 'Submission not found', 'subtleforms' ), array( 'status' => 404 ) );
		}

		$adjacent = $this->submissionsRepo->getAdjacentIds( $id, $formId );

		return new WP_REST_Response( $adjacent, 200 );
	}

	/**
	 * Get execution logs for a submission.
	 */
	public function get_submission_logs( WP_REST_Request $request ) {
		$submissionId = intval( $request->get_param( 'id' ) );

		$submission = $this->submissionsRepo->find( $submissionId );
		if ( ! $submission ) {
			return new WP_Error( 'submission_not_found', __( 'Submission not found', 'subtleforms' ), array( 'status' => 404 ) );
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

		return new WP_REST_Response( $logs, 200 );
	}

	/**
	 * Get unread submissions count.
	 */
	public function get_unread_count( WP_REST_Request $request ) {
		try {
			$unreadCount = $this->submissionsRepo->count( array( 'status' => 'unread' ) );

			return new WP_REST_Response(
				array(
					'count'     => $unreadCount,
					'timestamp' => current_time( 'mysql' ),
				),
				200
			);
		} catch ( \Exception $e ) {
			return new WP_Error( 'count_error', __( 'Error fetching unread count', 'subtleforms' ), array( 'status' => 500 ) );
		}
	}

	/**
	 * Submit a form (public endpoint).
	 *
	 * @return WP_REST_Response|WP_Error
	 */
	public function submit_form( WP_REST_Request $request ) {
		$formId  = $request->get_param( 'form_id' );
		$payload = $request->get_param( 'data' ) ?? array();
		if ( is_string( $payload ) ) {
			$decoded = Helpers::safe_json_decode( $payload, true, array() );
			if ( is_array( $decoded ) ) {
				$payload = $decoded;
			}
		}
		if ( ! is_array( $payload ) ) {
			$payload = array();
		}

		// Check spam protection (honeypot + time trap)
		if ( \SubtleForms\Engine\SpamProtection::is_enabled() ) {
			$tempContext = new SubmissionContext( $formId, $payload );
			if ( \SubtleForms\Engine\SpamProtection::is_spam( $tempContext ) ) {
				$reason = $tempContext->getMeta( 'spam_reason', 'spam_detected' );
				error_log( sprintf( 'SubtleForms: Spam blocked (form %d): %s', $formId, $reason ) );
				return new WP_REST_Response( array( 'success' => true, 'message' => __( 'Thank you.', 'subtleforms' ) ), 200 );
			}
		}

		// Verify CAPTCHA if enabled
		if ( $this->captchaManager && $this->captchaManager->isEnabled() && $this->captchaManager->isConfigured() ) {
			$verification = $this->captchaManager->verify( $payload );
			if ( ! $verification['success'] ) {
				return new WP_Error(
					'captcha_verification_failed',
					$verification['error'] ?? __( 'CAPTCHA verification failed.', 'subtleforms' ),
					array( 'status' => 400 )
				);
			}
		}

		// Verify form exists
		$form = $this->formsRepo->find( $formId );
		if ( ! $form ) {
			return new WP_Error( 'form_not_found', __( 'Form not found', 'subtleforms' ), array( 'status' => 404 ) );
		}

		// Resolve active schema version for this form and attach to submission
		try {
			$activeSchema = $this->formsRepo->loadSchemaVersion( $formId );
		} catch ( \RuntimeException $e ) {
			error_log( 'SubtleForms Submission Error: ' . $e->getMessage() );
			return new WP_Error(
				'schema_load_failed',
				'Failed to load form schema: ' . $e->getMessage(),
				array( 'status' => 500 )
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
					'ip_address'     => $_SERVER['REMOTE_ADDR'] ?? null,
					'user_agent'     => $_SERVER['HTTP_USER_AGENT'] ?? null,
				)
			);
		} catch ( \RuntimeException $e ) {
			error_log( 'SubtleForms: Failed to create submission record: ' . $e->getMessage() );
			return new WP_Error(
				'submission_create_failed',
				'Failed to create submission record',
				array( 'status' => 500 )
			);
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
				error_log( 'SubtleForms: Schema compilation failed for form ' . $formId . ': ' . $e->getMessage() );
				return new WP_Error( 'invalid_schema', $e->getMessage(), array( 'status' => 400 ) );
			}

			try {
				$result = $this->pipeline->run( $steps, $context, $activeSchema['schema'] );
			} catch ( \RuntimeException $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				error_log( 'SubtleForms: Pipeline execution failed for submission ' . $submissionId . ': ' . $e->getMessage() );

				// Check if this is a validation error with field details
				$validationErrors = $context->getMeta( 'validation_errors' );
				if ( is_array( $validationErrors ) && ! empty( $validationErrors ) ) {
					return new WP_Error(
						'validation_failed',
						'Form validation failed',
						array(
							'status' => 400,
							'errors' => $validationErrors,
						)
					);
				}

				// Generic pipeline failure
				return new WP_Error( 'pipeline_failed', $e->getMessage(), array( 'status' => 500 ) );
			} catch ( \Throwable $e ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				error_log( 'SubtleForms: Unexpected error in submission ' . $submissionId . ': ' . $e->getMessage() );
				return new WP_Error( 'pipeline_failed', __( 'An unexpected error occurred', 'subtleforms' ), array( 'status' => 500 ) );
			}

			if ( ! $result->ok ) {
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				error_log( 'SubtleForms: Pipeline execution failed for submission ' . $submissionId . ': ' . $result->error );
				return new WP_Error( 'pipeline_failed', $result->error, array( 'status' => 500 ) );
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
				error_log( 'SubtleForms: Submission ' . $submissionId . ' did not reach saved status' );
				$this->submissionsRepo->update( $submissionId, array( 'status' => 'failed' ) );
				return new WP_Error(
					'save_failed',
					'Failed to save submission data',
					array( 'status' => 500 )
				);
			}

			$payloadResult = null;
			if ( is_object( $result ) ) {
				$payloadResult = method_exists( $result, 'toArray' ) ? $result->toArray() : null;
			} else {
				$payloadResult = $result;
			}

			return new WP_REST_Response(
				array(
					'success'       => true,
					'submission_id' => $submissionId,
				),
				200
			);
		}

		// No schema configured; mark completed
		$this->submissionsRepo->update( $submissionId, array( 'status' => 'completed' ) );

		return new WP_REST_Response(
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
		$grouped = $request->get_param( 'grouped' );

		if ( $grouped === 'true' || $grouped === '1' ) {
			$fields = $this->fieldRegistry->byCategory();
			// Convert FieldDefinition objects to arrays
			$fields = array_map(
				function ( $categoryFields ) {
					return array_map( fn( $field ) => $field->toArray(), $categoryFields );
				},
				$fields
			);
		} else {
			$fields = $this->fieldRegistry->toArray();
		}

		return new WP_REST_Response( $fields, 200 );
	}

	/**
	 * Dismiss onboarding wizard.
	 */
	public function dismiss_onboarding( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => 'User not authenticated',
				),
				401
			);
		}

		update_user_meta( $user_id, 'subtleforms_onboarding_dismissed', true );

		return new WP_REST_Response(
			array(
				'success' => true,
				'message' => 'Onboarding dismissed',
			),
			200
		);
	}

	/**
	 * Get onboarding status.
	 */
	public function get_onboarding_status( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_REST_Response(
				array(
					'success'   => false,
					'dismissed' => false,
				),
				200
			);
		}

		$dismissed = (bool) get_user_meta( $user_id, 'subtleforms_onboarding_dismissed', true );

		return new WP_REST_Response(
			array(
				'success'   => true,
				'dismissed' => $dismissed,
			),
			200
		);
	}

	/**
	 * Send a test email to admin_email to validate email delivery
	 */
	public function send_onboarding_test_email( WP_REST_Request $request ): WP_REST_Response {
		try {
			$settings = new \SubtleForms\Support\Settings();
			$to = $settings->getAdminEmail();
			$subject = __( 'SubtleForms: Test email', 'subtleforms' );
			$message = __( 'This is a test email sent from SubtleForms to verify delivery to your admin email address.', 'subtleforms' );

			$sent = \SubtleForms\Support\Mailer::send( $to, $subject, $message );

			if ( $sent ) {
				return new WP_REST_Response( array( 'success' => true ), 200 );
			} else {
				return new WP_REST_Response( array( 'success' => false, 'message' => __( 'Failed to send test email', 'subtleforms' ) ), 200 );
			}
		} catch ( \Exception $e ) {
			return new WP_REST_Response( array( 'success' => false, 'message' => $e->getMessage() ), 500 );
		}
	}

	/**
	 * Dismiss create form wizard ("Don't show again").
	 */
	public function dismiss_create_wizard( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => 'User not authenticated',
				),
				401
			);
		}

		update_user_meta( $user_id, 'subtleforms_create_wizard_dismissed', true );

		return new WP_REST_Response(
			array(
				'success' => true,
				'message' => 'Create wizard dismissed',
			),
			200
		);
	}

	/**
	 * Get create form wizard status.
	 */
	public function get_create_wizard_status( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_REST_Response(
				array(
					'success'   => false,
					'dismissed' => false,
				),
				200
			);
		}

		$dismissed = (bool) get_user_meta( $user_id, 'subtleforms_create_wizard_dismissed', true );

		return new WP_REST_Response(
			array(
				'success'   => true,
				'dismissed' => $dismissed,
			),
			200
		);
	}

	/**
	 * Complete builder tour.
	 */
	public function complete_tour( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => 'User not authenticated',
				),
				401
			);
		}

		update_user_meta( $user_id, 'subtleforms_tour_completed', true );

		return new WP_REST_Response(
			array(
				'success' => true,
				'message' => 'Tour completed',
			),
			200
		);
	}

	/**
	 * Get builder tour status.
	 */
	public function get_tour_status( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return new WP_REST_Response(
				array(
					'success'   => false,
					'completed' => false,
				),
				200
			);
		}

		$completed = (bool) get_user_meta( $user_id, 'subtleforms_tour_completed', true );

		return new WP_REST_Response(
			array(
				'success'   => true,
				'completed' => $completed,
			),
			200
		);
	}

	/**
	 * Get form templates.
	 */
	public function get_templates( WP_REST_Request $request ): WP_REST_Response {
		$templates = \SubtleForms\Templates\FormTemplates::get_all();

		return new WP_REST_Response(
			array(
				'success'   => true,
				'templates' => $templates,
			),
			200
		);
	}

	/**
	 * Export submissions as CSV.
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response Response with CSV data.
	 */
	public function export_submissions_csv( WP_REST_Request $request ): WP_REST_Response {
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
			return new WP_REST_Response(
				array(
					'success' => false,
					'message' => __( 'No submissions to export', 'subtleforms' ),
				),
				200
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

		return new WP_REST_Response(
			array(
				'success'  => true,
				'csv'      => base64_encode( $csv_string ),
				'filename' => $filename,
			),
			200
		);
	}
}
