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

use SubtleForms\Fields\ActionHooks;
use SubtleForms\Support\Captcha\FieldCaptcha;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Support\SchemaRepair;

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
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'create_form' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
					'args'                => array(
						'title'  => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'status' => array(
							'type'              => 'string',
							'default'           => 'draft',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
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
					'callback'            => array( $this, 'update_form' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
					'args'                => array(
						'id'     => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
						'title'  => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'status' => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			array(
				'methods'             => 'DELETE',
				'callback'            => array( $this, 'delete_form' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
				'args'                => array(
					'id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					// move_to_trash=1 soft-deletes (status='trash'); force=1 hard-deletes.
					// Default (neither) is a hard delete, preserving the existing
					// behaviour relied on by the builder's orphan-draft cleanup
					// (Part B10).
					'move_to_trash' => array(
						'type'              => 'boolean',
						'default'           => false,
						'sanitize_callback' => function ( $v ) {
							return (bool) $v;
						},
					),
					'force' => array(
						'type'              => 'boolean',
						'default'           => false,
						'sanitize_callback' => function ( $v ) {
							return (bool) $v;
						},
					),
				),
			),
		)
	);

	// Restore a trashed form (Part B10).
	register_rest_route(
		self::NAMESPACE,
		'/forms/(?P<id>\d+)/restore',
		array(
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'restore_form' ),
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

	// Duplicate a form on the server in one step (2.3.1, QA-12).
	register_rest_route(
		self::NAMESPACE,
		'/forms/(?P<id>\d+)/duplicate',
		array(
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'duplicate_form' ),
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

	// Status counts for the All Forms tab bar (Part B10).
	register_rest_route(
		self::NAMESPACE,
		'/forms/counts',
		array(
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_form_counts' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			),
		)
	);

		// The page ticket is traded for a per-visitor single-use submit token on
		// first interaction, and an old token for a fresh one (2.7.1).
		register_rest_route(
			self::NAMESPACE,
			'/forms/(?P<id>\d+)/spam-token',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'refresh_spam_token' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'id'    => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
					'token' => array(
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => 'sanitize_text_field',
					),
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
					'args'                => array(
						'id'      => array(
							'type'              => 'integer',
							'required'          => true,
							'sanitize_callback' => 'absint',
						),
						'version' => array(
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
						'context' => array(
							'type'              => 'string',
							'sanitize_callback' => 'sanitize_key',
						),
					),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'save_form_schema' ),
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
	}

	// ────────────────────────────────────────────────────────────────────
	// Permission callbacks
	// ────────────────────────────────────────────────────────────────────

	/**
	 * Permission check for the public schema GET endpoint.
	 *
	 * Authenticated admins are always allowed. Unauthenticated users may
	 * only access schemas for published forms, we reject early with a
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
				// Single source of truth for type/status/unpublished-changes.
				$form = \SubtleForms\Support\FormMeta::with_meta( $form );
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

		// Single source of truth for type/status/unpublished-changes.
		$form = \SubtleForms\Support\FormMeta::with_meta( $form );

		// The builder tells an admin who changes a field ID that existing
		// entries keep their answers under the old ID (2.4.1).
		$counts                   = $this->submissionsRepo->get_counts_by_forms( array( (int) $form['id'] ) );
		$form['submission_count'] = (int) ( $counts[ (int) $form['id'] ] ?? 0 );

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

		$isAuthenticated = is_user_logged_in() && current_user_can( 'manage_options' );
		$isPublished     = isset( $form['status'] ) && $form['status'] === 'published';
		$requestsDraft   = $context === 'builder';

		// PUBLIC ACCESS: Only active schema for published forms.
		// SECURITY: Never expose the full form row (it contains draft_schema,
		// config, created_at, updated_at, active_version and status, internal
		// data the renderer does not need). Return a minimal form object and
		// a schema stripped to only the fields the frontend renderer uses.
		if ( ! $isAuthenticated ) {
			if ( ! $isPublished ) {
				return ApiResponse::not_found( __( 'Form not available', 'subtleforms' ) );
			}

			$payload = $this->publicPayload( $form, $version );
			if ( null === $payload ) {
				return ApiResponse::not_found( __( 'Schema not available', 'subtleforms' ) );
			}

			return ApiResponse::success( $payload );
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

		// Logged-in visitors viewing the live form get the same rendering
		// schema as everyone else (translations, plan limits); the builder
		// keeps the raw one.
		if ( ! $requestsDraft && is_array( $schemaData ) ) {
			$schemaData = SchemaRepair::repair( $schemaData, (int) $form['id'] );
			$schemaData = self::filterPublicSchema( $schemaData, (int) $form['id'] );
		}

		return ApiResponse::success(
			array(
				'form'    => $form,
				'schema'  => $schemaData,
				'version' => $schema['version'] ?? null,
			)
		);
	}

	/**
	 * Trade the page's render ticket (or an expired submit token) for a
	 * per-visitor single-use submit token. Rate limited per client address.
	 * Only a validly signed value for this published form is answered; a missing or forged token,
	 * or an unknown form, gets a 404 so nothing can be minted from scratch.
	 *
	 * @param WP_REST_Request $request REST request.
	 */
	public function refresh_spam_token( WP_REST_Request $request ): WP_REST_Response {
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		$formId = absint( $request->get_param( 'id' ) );
		$form   = $this->formsRepo->find( $formId );
		if ( ! $form || 'published' !== ( $form['status'] ?? '' ) ) {
			return ApiResponse::not_found( __( 'Form not available', 'subtleforms' ) );
		}

		$token = \SubtleForms\Engine\SpamProtection::refresh_token( $request->get_param( 'token' ), $formId );
		if ( null === $token ) {
			return ApiResponse::not_found( __( 'Form not available', 'subtleforms' ) );
		}

		return ApiResponse::success( array( 'spam_token' => $token ) );
	}

	/**
	 * What a visitor gets for a published form: the form's id and title, the
	 * public schema, its version and a signed load time. Nothing else from the
	 * form row (draft schema, config, notifications, webhooks) is included.
	 *
	 * This is the one place that builds it. The schema route returns it and,
	 * since 2.6.1, the shortcode and the block print the same array into the
	 * page (Frontend\InlineData), so what the browser draws from the page and
	 * what it would have fetched can never differ.
	 *
	 * @param array<string, mixed> $form    Form row.
	 * @param int|null             $version Schema version, null for the active one.
	 * @return array<string, mixed>|null Null when the form has no schema.
	 */
	public function publicPayload( array $form, ?int $version = null ): ?array {
		$formId = (int) ( $form['id'] ?? 0 );
		try {
			$schema = $this->formsRepo->loadSchemaVersion( $formId, $version );
		} catch ( \RuntimeException $e ) {
			Logger::error( 'API Error: %s', $e->getMessage() );
			return null;
		}

		if ( ! $schema ) {
			return null;
		}

		$schemaData = $schema['schema'] ?? $schema;
		$schemaData = is_array( $schemaData ) ? SchemaRepair::repair( $schemaData, $formId ) : $schemaData;
		$schemaData = $this->injectCaptchaHtml( $schemaData );

		return array(
			'form'       => array(
				'id'    => $formId,
				'title' => $form['title'] ?? '',
			),
			'schema'     => self::filterPublicSchema( $this->buildPublicSchema( $schemaData ), $formId ),
			'version'    => $schema['version'] ?? null,
			// Server-signed build time (a render ticket) for the spam time trap
			// (FF-11, FF-12). The browser trades it for a submit token.
			'spam_token' => \SubtleForms\Engine\SpamProtection::issue_ticket( $formId ),
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
		// Also ensure metadata.title is populated (required by publish validation).
		// Fall back to the form's top-level title so the schema is always
		// self-consistent even if the client omits it.
		if ( empty( $schema['metadata']['title'] ) || ! is_string( $schema['metadata']['title'] ) ) {
			$schema['metadata']['title'] = Helpers::safe_string_get( $form, 'title', '' );
		}

		// Ensure fields array exists
		if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			$schema['fields'] = array();
		}

		$schema = $this->keepSpamSettings( $formId, $schema );

		$schema = FormsRepository::beforeSave( $schema, $formId, (bool) $activate );

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
				// Keep the draft in step with what was just activated. Publishing
				// promotes the draft, so a draft older than this save (the last
				// autosave) would otherwise replace these changes a moment later.
				$this->formsRepo->saveDraftSchema( $formId, $schema );
				$savedSchema = $this->formsRepo->loadSchemaVersion( $formId, $version );
				if ( ! $savedSchema ) {
					Logger::error( 'Failed to load just-saved schema version %d for form %d', $version, $formId );
					return ApiResponse::server_error( __( 'Schema was saved but could not be loaded back', 'subtleforms' ) );
				}

				/**
				 * A schema version was published (made active). Add-ons use
				 * this to register the form's strings for translation.
				 *
				 * @param int   $formId  Form ID.
				 * @param array $schema  Published schema.
				 * @param int   $version Version number.
				 * @since 2.1.0
				 */
				do_action( 'subtleforms/forms/schema_published', $formId, $savedSchema['schema'] ?? $schema, $version );

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
	 * Spam settings for a schema about to be saved (2.6.0).
	 *
	 * A schema that carries its own spam settings is saved as sent. One that
	 * does not (an older client or script) keeps the settings already stored
	 * for the form. The first schema of a form created without one gets the
	 * new form defaults, so every way of creating a form starts protected.
	 * A form saved before 2.6.0 that has no settings is left as it is.
	 *
	 * @param int   $formId Form ID.
	 * @param array $schema Schema.
	 * @return array
	 */
	private function keepSpamSettings( int $formId, array $schema ): array {
		$key = \SubtleForms\Engine\SpamProtection::FORM_KEY;
		if ( isset( $schema['metadata'][ $key ] ) && is_array( $schema['metadata'][ $key ] ) && $schema['metadata'][ $key ] ) {
			return $schema;
		}

		try {
			$stored = $this->formsRepo->getDraftSchema( $formId );
			$active = $this->formsRepo->loadSchemaVersion( $formId );
		} catch ( \RuntimeException $e ) {
			return $schema;
		}
		$active = is_array( $active ) ? ( $active['schema'] ?? null ) : null;

		foreach ( array( $stored, $active ) as $candidate ) {
			if ( is_array( $candidate ) && isset( $candidate['metadata'][ $key ] ) && is_array( $candidate['metadata'][ $key ] ) && $candidate['metadata'][ $key ] ) {
				$schema['metadata'][ $key ] = $candidate['metadata'][ $key ];
				return $schema;
			}
		}

		if ( null === $stored && null === $active ) {
			return \SubtleForms\Engine\SpamProtection::with_new_form_defaults( $schema );
		}
		return $schema;
	}

	/**
	 * Recursively derive missing 'key' from 'id' for all field definitions.
	 *
	 * Handles nested fields inside step/section containers for multi-step forms.
	 *
	 * @param array $fields Fields array (modified in place via reference).
	 */
	private function deriveFieldKeys( array &$fields ): void {
		foreach ( $fields as &$_field ) {
			if ( ! is_array( $_field ) ) {
				continue;
			}
			if ( ( empty( $_field['key'] ) || ! is_string( $_field['key'] ) ) && ! empty( $_field['id'] ) ) {
				$_field['key'] = preg_replace( '/[^a-zA-Z0-9_]/', '_', (string) $_field['id'] );
			}
			// Recurse into step/section container nested fields
			if ( ! empty( $_field['fields'] ) && is_array( $_field['fields'] ) ) {
				$this->deriveFieldKeys( $_field['fields'] );
			}
		}
		unset( $_field );
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
			Logger::debug( 'create_form - raw input: %s', print_r( $input, true ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $input, Schemas::get( Schemas::FORM_CREATE ) );
		} catch ( ValidationException $e ) {
			Logger::error( 'create_form - validation failed: %s', $e->getMessage() );
			Logger::debug( 'create_form - invalid fields: %s', wp_json_encode( $e->getFields() ) );
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

			// Derive missing 'key' from 'id' so SchemaValidator passes for templates
			// that define fields with 'id' only (e.g. all built-in templates).
			// Recurse into step/section container 'fields' arrays for multi-step forms.
			$this->deriveFieldKeys( $schema['fields'] );

			// A single checkbox with a list of options becomes Multiple choice,
			// as the builder does when it opens such a field (2.3.2). Templates
			// from add-ons may still use the old shape.
			list( $schema['fields'] ) = \SubtleForms\Support\SchemaRepair::checkboxListsToMultipleChoice( $schema['fields'] );

			// New forms stop robots quietly: the hidden trap field and the
			// time trap start on, from the site defaults (2.6.0).
			$schema = \SubtleForms\Engine\SpamProtection::with_new_form_defaults( $schema );

			$schema = FormsRepository::beforeSave( $schema, (int) $id, true );

			try {
				$this->formsRepo->saveSchemaVersion( $id, $schema, true );
			} catch ( \InvalidArgumentException $e ) {
				// Never leave an empty form behind (2.3.2): the form is removed
				// and the reason is returned so the screen can show it.
				Logger::error( 'Failed to save initial schema for form %d: %s', $id, $e->getMessage() );
				$this->formsRepo->delete( $id );
				return ApiResponse::validation_error(
					sprintf(
						/* translators: %s: reason the form could not be created */
						__( 'The form could not be created: %s', 'subtleforms' ),
						$e->getMessage()
					)
				);
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

				// Inject title from form record if the stored schema is missing it.
				// This guards against schemas saved before the title-injection was added.
				if ( empty( $schemaData['metadata']['title'] ) ) {
					if ( ! isset( $schemaData['metadata'] ) || ! is_array( $schemaData['metadata'] ) ) {
						$schemaData['metadata'] = array();
					}
					$schemaData['metadata']['title'] = $form['title'] ?? '';
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

		// The forms screen sends move_to_trash. A bare DELETE is the builder
		// dropping a new form the visitor never saved, and that stays a
		// permanent delete. Hard delete ignores the query.
		$alreadyTrashed = ( $form['status'] ?? '' ) === 'trash';
		$settings       = get_option( 'subtleforms_settings', array() );
		$behavior       = is_array( $settings ) ? (string) ( $settings['delete_behavior'] ?? 'soft' ) : 'soft';
		$wantsTrash     = rest_sanitize_boolean( $request->get_param( 'move_to_trash' ) );
		if ( $wantsTrash && \SubtleForms\Support\Settings::deletionMode( $behavior, $alreadyTrashed ) === 'trash' ) {
			$this->formsRepo->trash( $id );
			return ApiResponse::success( array( 'success' => true, 'trashed' => true ) );
		}

		$this->formsRepo->delete( $id );

		return ApiResponse::success( array( 'success' => true, 'deleted' => true ) );
	}

	/**
	 * Restore a trashed form.
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response
	 */
	public function restore_form( WP_REST_Request $request ): WP_REST_Response {
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

		if ( ( $form['status'] ?? '' ) !== 'trash' ) {
			return ApiResponse::validation_error( __( 'Form is not in the Trash', 'subtleforms' ) );
		}

		$restored = $this->formsRepo->restore( $id );
		if ( false === $restored ) {
			return ApiResponse::server_error( __( 'The form could not be restored. Please try again.', 'subtleforms' ) );
		}

		return ApiResponse::success(
			array(
				'success' => true,
				'status'  => $restored,
			)
		);
	}

	/**
	 * Duplicate a form (QA-12).
	 *
	 * The copy gets a new ID, the title "<title> (copy)", Draft status and
	 * the source's current draft (or live) schema, repaired if it has fields
	 * outside every step. Entries are never copied. When anything fails the
	 * half-made copy is removed and the real reason is returned.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function duplicate_form( WP_REST_Request $request ): WP_REST_Response {
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
		if ( ( $form['status'] ?? '' ) === 'trash' ) {
			return ApiResponse::validation_error( __( 'Restore this form from the Trash before copying it.', 'subtleforms' ) );
		}

		try {
			$schema = $this->formsRepo->getDraftSchema( $id );
			if ( ! is_array( $schema ) || empty( $schema ) ) {
				$active = $this->formsRepo->loadSchemaVersion( $id );
				$schema = is_array( $active ) ? ( $active['schema'] ?? $active ) : array();
			}
		} catch ( \Throwable $e ) {
			Logger::error( 'Duplicate form %d: could not read the schema: %s', $id, $e->getMessage() );
			return ApiResponse::server_error(
				/* translators: %s: error message */
				sprintf( __( 'The form could not be copied because its fields could not be read: %s', 'subtleforms' ), $e->getMessage() )
			);
		}

		$schema = is_array( $schema ) ? $schema : array();
		if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			$schema['fields'] = array();
		}
		$schema = SchemaRepair::repair( $schema, $id );

		/* translators: %s: title of the form being copied */
		$title = sprintf( __( '%s (copy)', 'subtleforms' ), (string) ( $form['title'] ?? '' ) );
		if ( ! isset( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
			$schema['metadata'] = array();
		}
		$schema['metadata']['title'] = $title;
		if ( empty( $schema['metadata']['name'] ) ) {
			$schema['metadata']['name'] = $title;
		}
		$schema['schema_version'] = $schema['schema_version'] ?? 1;

		$newId = $this->formsRepo->create(
			array(
				'title'  => $title,
				'config' => array(),
				'status' => 'draft',
				'schema' => $schema,
			)
		);
		if ( $newId <= 0 ) {
			return ApiResponse::server_error( __( 'The copy could not be created in the database. Please try again.', 'subtleforms' ) );
		}

		try {
			$this->formsRepo->saveDraftSchema( $newId, $schema );
		} catch ( \Throwable $e ) {
			// Roll back: never leave an empty copy behind.
			$this->formsRepo->delete( $newId );
			Logger::error( 'Duplicate form %d failed: %s', $id, $e->getMessage() );
			return ApiResponse::validation_error(
				/* translators: %s: error message */
				sprintf( __( 'The form could not be copied: %s', 'subtleforms' ), $e->getMessage() )
			);
		}

		/**
		 * Fires after a form is duplicated.
		 *
		 * @param int $newId  New form ID.
		 * @param int $id     Source form ID.
		 * @since 2.3.1
		 */
		do_action( 'subtleforms/form/duplicated', $newId, $id );

		return ApiResponse::success(
			array(
				'id'     => $newId,
				'title'  => $title,
				'status' => 'draft',
			),
			201
		);
	}

	/**
	 * Get per-status form counts for the All Forms tab bar.
	 *
	 * @return WP_REST_Response
	 */
	public function get_form_counts(): WP_REST_Response {
		$counts = $this->formsRepo->count_by_status();
		return ApiResponse::success( $counts );
	}

	// ────────────────────────────────────────────────────────────────────
	// CAPTCHA helpers
	// ────────────────────────────────────────────────────────────────────

	/**
	 * Build a public-safe schema for unauthenticated rendering.
	 *
	 * The renderer only needs the field list and a small set of metadata
	 * keys (type, appearance, title, description, theme toggles, payment
	 * display settings). It never needs `actions` (which contain webhook
	 * URLs, email recipients and other integration config) or internal
	 * metadata such as `integrations`. Stripping these halves the payload
	 * and prevents leaking unpublished/integration config to the public.
	 *
	 * @param array $schema Active published schema.
	 * @return array Minimal schema for frontend rendering.
	 */
	private function buildPublicSchema( array $schema ): array {
		$public = array(
			'fields'         => self::stripCaptchaSecrets( $schema['fields'] ?? array() ),
			'schema_version' => $schema['schema_version'] ?? 1,
		);

		if ( isset( $schema['metadata'] ) && is_array( $schema['metadata'] ) ) {
			$allowed_meta = array(
				'type',
				'appearance',
				'payment',
				'title',
				'description',
				'name',
				'template',
				'_showTitle',
				'_showDescription',
				'_theme',
				'submitText',
				// Field defaults (2.3.2).
				'labelVisibility',
				'descriptionPlacement',
				'requiredMessage',
				'validationMessage',
			);

			$public['metadata'] = array();
			foreach ( $allowed_meta as $key ) {
				if ( array_key_exists( $key, $schema['metadata'] ) ) {
					$public['metadata'][ $key ] = $schema['metadata'][ $key ];
				}
			}

			// Payment display settings the renderer needs (amount, currency,
			// mode). Never expose gateway secrets (secretKey, publishableKey,
			// apiKey, provider credentials, etc.) to the public.
			if ( isset( $public['metadata']['payment'] ) && is_array( $public['metadata']['payment'] ) ) {
				$payment = $public['metadata']['payment'];
				$clean   = array();
				foreach ( array( 'enabled', 'amountType', 'fixedAmount', 'amountField', 'currency', 'mode', 'processor' ) as $pk ) {
					if ( array_key_exists( $pk, $payment ) ) {
						$clean[ $pk ] = $payment[ $pk ];
					}
				}
				$public['metadata']['payment'] = $clean;
			}
		}

		return $public;
	}

	/**
	 * Filter the schema the frontend renderer receives.
	 *
	 * @param array $schema Rendering schema.
	 * @param int   $formId Form ID.
	 * @return array
	 */
	public static function filterPublicSchema( array $schema, int $formId ): array {
		/**
		 * Filter the schema sent to the browser to render a form (never the
		 * builder's copy). SubtleForms Pro translates strings here with WPML
		 * or Polylang.
		 *
		 * @param array $schema Rendering schema (fields, metadata).
		 * @param int   $formId Form ID.
		 * @since 2.1.0
		 */
		$filtered = apply_filters( 'subtleforms/public_schema', $schema, $formId );
		$filtered = is_array( $filtered ) ? $filtered : $schema;
		if ( isset( $filtered['fields'] ) && is_array( $filtered['fields'] ) ) {
			$filtered['fields'] = self::escapeMarkup( $filtered['fields'] );
		}
		return $filtered;
	}

	/**
	 * Run HTML block markup through the post-content filter on the way out,
	 * so markup stored before it was filtered on save is never sent raw.
	 *
	 * @param array $fields Field nodes.
	 * @return array
	 */
	private static function escapeMarkup( array $fields ): array {
		foreach ( $fields as $i => $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( 'html' === ( $field['type'] ?? '' ) ) {
				if ( isset( $field['content'] ) && is_string( $field['content'] ) ) {
					$field['content'] = wp_kses_post( $field['content'] );
				}
				if ( isset( $field['config']['content'] ) && is_string( $field['config']['content'] ) ) {
					$field['config']['content'] = wp_kses_post( $field['config']['content'] );
				}
			}
			foreach ( array( 'children', 'fields' ) as $child ) {
				if ( isset( $field[ $child ] ) && is_array( $field[ $child ] ) ) {
					$field[ $child ] = self::escapeMarkup( $field[ $child ] );
				}
			}
			if ( isset( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $c => $column ) {
					if ( is_array( $column ) ) {
						$field['columns'][ $c ] = self::escapeMarkup( $column );
					}
				}
			}
			$fields[ $i ] = $field;
		}
		return $fields;
	}

	/**
	 * Inject CAPTCHA HTML into schema fields for frontend rendering.
	 */
	private function injectCaptchaHtml( $schema ) {
		if ( is_array( $schema ) ) {
			ActionHooks::fire( $schema, array( 'when' => 'render' ) );
			$schema['fields'] = $this->processCaptchaFields( $schema['fields'] ?? array(), '' );
		}
		return $schema;
	}

	/**
	 * Recursively process fields to inject CAPTCHA HTML.
	 */
	/**
	 * Site keys can stay on the public form. Secret keys cannot.
	 *
	 * @param mixed $fields Field nodes.
	 * @return array
	 */
	private static function stripCaptchaSecrets( $fields ): array {
		if ( ! is_array( $fields ) ) {
			return array();
		}
		$clean = array();
		foreach ( $fields as $key => $field ) {
			if ( ! is_array( $field ) ) {
				$clean[ $key ] = $field;
				continue;
			}
			unset( $field['secret_key'] );
			if ( isset( $field['config'] ) && is_array( $field['config'] ) ) {
				unset( $field['config']['secret_key'] );
			}
			foreach ( array( 'fields', 'children' ) as $child ) {
				if ( isset( $field[ $child ] ) ) {
					$field[ $child ] = self::stripCaptchaSecrets( $field[ $child ] );
				}
			}
			if ( isset( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $i => $column ) {
					if ( ! is_array( $column ) ) {
						continue;
					}
					if ( isset( $column['fields'] ) ) {
						$column['fields'] = self::stripCaptchaSecrets( $column['fields'] );
					} elseif ( isset( $column['children'] ) ) {
						$column['children'] = self::stripCaptchaSecrets( $column['children'] );
					} else {
						$column = self::stripCaptchaSecrets( $column );
					}
					$field['columns'][ $i ] = $column;
				}
			}
			$clean[ $key ] = $field;
		}
		return $clean;
	}

	private function processCaptchaFields( $fields, $captcha_html ) {
		$provider_name = $this->captchaManager ? $this->captchaManager->getActiveProviderName() : '';

		foreach ( $fields as &$field ) {
			if ( in_array( $field['type'] ?? '', array( 'captcha', 'recaptcha', 'hcaptcha', 'turnstile' ), true ) ) {
				$provider = FieldCaptcha::provider( $field );
				$settings = array();
				if ( $this->captchaManager && '' !== $provider ) {
					$settings[ $provider ] = $this->captchaManager->keysFor( $provider );
				}
				$resolved = FieldCaptcha::resolve( $field, $settings );
				$html     = '';
				if ( $resolved['ready'] && $this->captchaManager ) {
					$html = $this->captchaManager->widgetFor( $resolved['provider'], $resolved['site_key'] );
				}
				$field['config']['captchaHtml']     = $html;
				$field['config']['captchaWarning']  = '' === $html ? $resolved['warning'] : '';
				$field['config']['providerName']    = $provider;
			}

			if ( ! empty( $field['fields'] ) && is_array( $field['fields'] ) ) {
				$field['fields'] = $this->processCaptchaFields( $field['fields'], $captcha_html );
			}

			if ( ! empty( $field['children'] ) && is_array( $field['children'] ) ) {
				$field['children'] = $this->processCaptchaFields( $field['children'], $captcha_html );
			}

			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as &$column ) {
					if ( ! is_array( $column ) ) {
						continue;
					}
					if ( isset( $column['fields'] ) && is_array( $column['fields'] ) ) {
						$column['fields'] = $this->processCaptchaFields( $column['fields'], $captcha_html );
					} elseif ( isset( $column['children'] ) && is_array( $column['children'] ) ) {
						$column['children'] = $this->processCaptchaFields( $column['children'], $captcha_html );
					} else {
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
