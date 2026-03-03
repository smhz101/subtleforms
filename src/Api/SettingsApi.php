<?php

namespace SubtleForms\Api;

use SubtleForms\Api\ApiResponse;
use SubtleForms\Support\Settings;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\ValidationException;
use SubtleForms\Validation\Schemas;
use SubtleForms\Security\RateLimiter;
use SubtleForms\Security\ETag;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Settings API
 *
 * REST API endpoints for plugin settings.
 */
class SettingsApi {

	/**
	 * @var Settings
	 */
	private $settings;

	/**
	 * Constructor
	 *
	 * @param Settings $settings Settings manager
	 */
	public function __construct( Settings $settings ) {
		$this->settings = $settings;
	}

	/**
	 * Register routes
	 */
	public function registerRoutes() {
		register_rest_route(
			'subtleforms/v1',
			'/settings',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'getSettings' ),
					'permission_callback' => array( $this, 'checkPermissions' ),
				),
				array(
					'methods'             => 'PUT',
					'callback'            => array( $this, 'updateSettings' ),
					'permission_callback' => array( $this, 'checkPermissions' ),
					'args'                => $this->getUpdateArgs(),
				),
			)
		);

		register_rest_route(
			'subtleforms/v1',
			'/settings/reset',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'resetSettings' ),
				'permission_callback' => array( $this, 'checkPermissions' ),
			)
		);
	}

	/**
	 * Get settings
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function getSettings( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$settings = $this->settings->getAll();

			// Phase A3-P2: Add ETag header for optimistic locking
			$etag     = ETag::fromSettings( $settings );
			$response = ApiResponse::success(
				array(
					'success' => true,
					'data'    => $settings,
				)
			);
			return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( $e->getMessage() );
		}
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
		$ip     = isset( $_SERVER['REMOTE_ADDR'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) )
			: '0.0.0.0';
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
				__( 'Too many requests. Please try again later.', 'subtleforms' ),
				$result['retry_after'],
				array(),
				$headers
			);
		}

		return null;
	}

	/**
	 * Update settings
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function updateSettings( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$input = $request->get_json_params();

			if ( empty( $input ) || ! is_array( $input ) ) {
				return ApiResponse::bad_request( __( 'Invalid settings data', 'subtleforms' ) );
			}

			// Phase A3-P2: Check If-Match for optimistic locking
			$currentSettings  = $this->settings->getAll();
			$conflictResponse = $this->guardIfMatch( $request, $currentSettings );
			if ( $conflictResponse ) {
				return $conflictResponse;
			}

			// Validate input
			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $input, Schemas::get( Schemas::SETTINGS_UPDATE ) );

			// Update with validated data only
			$this->settings->update( $validated );

			// Phase A3-P2: Increment settings version for ETag
			ETag::incrementSettingsVersion();

			$updatedSettings = $this->settings->getAll();
			$etag            = ETag::fromSettings( $updatedSettings );

			$response = ApiResponse::success(
				array(
					'success' => true,
					'message' => __( 'Settings updated successfully', 'subtleforms' ),
					'data'    => $updatedSettings,
				)
			);
			return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
		} catch ( ValidationException $e ) {
			return ApiResponse::validation_error( $e->getMessage(), $e->getFields() );
		} catch ( \InvalidArgumentException $e ) {
			return ApiResponse::bad_request( $e->getMessage() );
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( __( 'Failed to update settings: ', 'subtleforms' ) . $e->getMessage() );
		}
	}

	/**
	 * Reset settings to defaults
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function resetSettings( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$this->settings->reset();
			$settings = $this->settings->getAll();

			return ApiResponse::success(
				array(
					'success' => true,
					'message' => __( 'Settings reset to defaults', 'subtleforms' ),
					'data'    => $settings,
				)
			);
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( __( 'Failed to reset settings: ', 'subtleforms' ) . $e->getMessage() );
		}
	}

	/**
	 * Guard If-Match for optimistic locking (Phase A3-P2)
	 *
	 * @param WP_REST_Request $request         Request object.
	 * @param array           $currentSettings Current settings data.
	 * @return WP_REST_Response|null 409 response if conflict, null if allowed.
	 */
	private function guardIfMatch( WP_REST_Request $request, array $currentSettings ): ?WP_REST_Response {
		$ifMatch = $request->get_header( 'If-Match' );

		// No If-Match header = optimistic locking not requested
		if ( empty( $ifMatch ) ) {
			return null;
		}

		// Generate current ETag
		$currentETag = ETag::fromSettings( $currentSettings );

		// Check if ETags match
		if ( ETag::match( $ifMatch, $currentETag ) ) {
			return null; // Match - allow operation
		}

		// Conflict - return 409 with current ETag
		return ApiResponse::conflict(
			__( 'Settings have been modified by another user. Please refresh and try again.', 'subtleforms' ),
			array(
				'resource'          => 'settings',
				'provided_if_match' => $ifMatch,
				'current_etag'      => $currentETag,
			),
			array( 'ETag' => $currentETag )
		);
	}

	/**
	 * Check permissions
	 *
	 * @return bool
	 */
	public function checkPermissions() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Get update arguments schema
	 *
	 * @return array
	 */
	private function getUpdateArgs() {
		return array(
			'default_form_status'        => array(
				'type'              => 'string',
				'enum'              => array( 'draft', 'published' ),
				'sanitize_callback' => 'sanitize_text_field',
			),
			'autosave_enabled'           => array(
				'type' => 'boolean',
			),
			'autosave_interval'          => array(
				'type'              => 'integer',
				'minimum'           => 1,
				'maximum'           => 60,
				'validate_callback' => function ( $value, $request, $key ) {
					if ( ! is_numeric( $value ) ) {
						return new \WP_Error( 'rest_invalid_param', 'autosave_interval must be a number', array( 'status' => 400 ) );
					}
					$int_value = intval( $value );
					if ( $int_value < 1 || $int_value > 60 ) {
						return new \WP_Error( 'rest_invalid_param', 'autosave_interval must be between 1 and 60', array( 'status' => 400 ) );
					}
					return true;
				},
			),
			'delete_behavior'            => array(
				'type'              => 'string',
				'enum'              => array( 'soft', 'hard' ),
				'sanitize_callback' => 'sanitize_text_field',
			),
			'success_message'            => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'error_message'              => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'redirect_after_submit'      => array(
				'type'              => 'string',
				'sanitize_callback' => 'esc_url_raw',
			),
			'submission_limit_enabled'   => array(
				'type' => 'boolean',
			),
			'submission_limit'           => array(
				'type'              => 'integer',
				'minimum'           => 1,
				'maximum'           => 100,
				'validate_callback' => function ( $value, $request, $key ) {
					if ( ! is_numeric( $value ) ) {
						return new \WP_Error( 'rest_invalid_param', 'submission_limit must be a number', array( 'status' => 400 ) );
					}
					$int_value = intval( $value );
					if ( $int_value < 1 || $int_value > 100 ) {
						return new \WP_Error( 'rest_invalid_param', 'submission_limit must be between 1 and 100', array( 'status' => 400 ) );
					}
					return true;
				},
			),
			// Spam protection
			'enable_honeypot'           => array(
				'type' => 'boolean',
			),
			'min_submission_time'       => array(
				'type'    => 'integer',
				'minimum' => 1,
				'maximum' => 300,
			),
			'admin_notification_enabled' => array(
				'type' => 'boolean',
			),
			'user_confirmation_enabled'  => array(
				'type' => 'boolean',
			),
			'sender_name'                => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'sender_email'               => array(
				'type'              => 'string',
				'format'            => 'email',
				'sanitize_callback' => 'sanitize_email',
			),
			'admin_email'                => array(
				'type'              => 'string',
				'format'            => 'email',
				'sanitize_callback' => 'sanitize_email',
			),
			'debug_mode'                 => array(
				'type' => 'boolean',
			),
			'captcha_enabled'            => array(
				'type' => 'boolean',
			),
			'captcha_provider'           => array(
				'type'              => 'string',
				'enum'              => array( '', 'recaptcha', 'hcaptcha', 'turnstile' ),
				'sanitize_callback' => 'sanitize_text_field',
			),
			'captcha_recaptcha_enabled'  => array(
				'type' => 'boolean',
			),
			'captcha_recaptcha_site_key' => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'captcha_recaptcha_secret_key' => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'captcha_recaptcha_version'  => array(
				'type'              => 'string',
				'enum'              => array( 'v2', 'v3' ),
				'sanitize_callback' => 'sanitize_text_field',
			),
			'captcha_hcaptcha_enabled'   => array(
				'type' => 'boolean',
			),
			'captcha_hcaptcha_site_key'  => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'captcha_hcaptcha_secret_key' => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'captcha_turnstile_enabled'  => array(
				'type' => 'boolean',
			),
			'captcha_turnstile_site_key' => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'captcha_turnstile_secret_key' => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
			),
			'data_retention_days'        => array(
				'type'    => 'integer',
				'minimum' => 0,
				'maximum' => 3650,
			),
		);
	}
}
