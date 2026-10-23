<?php

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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

		register_rest_route(
			'subtleforms/v1',
			'/settings/inbox-view',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'updateInboxView' ),
				'permission_callback' => array( $this, 'checkPermissions' ),
				'args'                => array(
					'reset'         => array(
						'type' => 'boolean',
					),
					'density'       => array(
						'type' => 'string',
						'enum' => Settings::INBOX_DENSITY,
					),
					'reading_pane'  => array(
						'type' => 'string',
						'enum' => Settings::INBOX_PANE,
					),
				),
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
					'data'    => self::maskSecrets( $settings ),
				)
			);
			return ApiResponse::withHeaders( $response, array( 'ETag' => $etag ) );
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( $e->getMessage() );
		}
	}

	/** What the settings screen receives instead of a saved CAPTCHA secret key. */
	public const SECRET_MASK = '********';

	/** Settings that hold a CAPTCHA secret key. */
	private const SECRET_KEYS = array( 'captcha_recaptcha_secret_key', 'captcha_hcaptcha_secret_key', 'captcha_turnstile_secret_key' );

	/**
	 * Replace saved CAPTCHA secret keys with a mask. An empty key stays empty, so
	 * the screen can tell whether one is saved.
	 *
	 * @param array $settings Settings.
	 * @return array Settings safe to send to the browser.
	 */
	public static function maskSecrets( array $settings ): array {
		foreach ( self::SECRET_KEYS as $key ) {
			if ( isset( $settings[ $key ] ) && '' !== (string) $settings[ $key ] ) {
				$settings[ $key ] = self::SECRET_MASK;
			}
		}
		return $settings;
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
		$ip     = \SubtleForms\Security\ClientIp::get() ?: '0.0.0.0';
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
			$schema = Schemas::get( Schemas::SETTINGS_UPDATE );

			// The settings screen sends back every key it was given. Keys an
			// add-on stored under ext_ (this plugin has no rule for them) are
			// kept as they are by Settings::update() and are not part of this
			// request, so they are not reported as unknown.
			$allowed = is_array( $schema['__allow'] ?? null ) ? $schema['__allow'] : array();
			foreach ( array_keys( $input ) as $key ) {
				if ( is_string( $key ) && 0 === strpos( $key, 'ext_' ) && ! in_array( $key, $allowed, true ) ) {
					unset( $input[ $key ] );
				}
			}

			// The screen sends back the mask it was given for a saved secret
			// key. That means "unchanged": the stored key is kept.
			foreach ( self::SECRET_KEYS as $secretKey ) {
				if ( isset( $input[ $secretKey ] ) && self::SECRET_MASK === $input[ $secretKey ] ) {
					unset( $input[ $secretKey ] );
				}
			}

			$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
			$validated = $validator->validateOrFail( $input, $schema );

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
					'data'    => self::maskSecrets( $updatedSettings ),
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
					'data'    => self::maskSecrets( $settings ),
				)
			);
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( __( 'Failed to reset settings: ', 'subtleforms' ) . $e->getMessage() );
		}
	}

	/**
	 * Save or clear the current admin's submissions inbox choices.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function updateInboxView( WP_REST_Request $request ) {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return ApiResponse::forbidden( __( 'You are not allowed to perform this action.', 'subtleforms' ) );
		}

		if ( rest_sanitize_boolean( $request->get_param( 'reset' ) ) ) {
			delete_user_meta( $user_id, Settings::INBOX_META );
			return ApiResponse::success( $this->settings->resolvedInboxView( $user_id ) );
		}

		$density = $request->get_param( 'density' );
		$pane    = $request->get_param( 'reading_pane' );
		if ( ! in_array( $density, Settings::INBOX_DENSITY, true ) || ! in_array( $pane, Settings::INBOX_PANE, true ) ) {
			return ApiResponse::bad_request( __( 'Choose a density and a reading pane.', 'subtleforms' ) );
		}

		update_user_meta(
			$user_id,
			Settings::INBOX_META,
			array(
				'density'      => $density,
				'reading_pane' => $pane,
			)
		);

		return ApiResponse::success( $this->settings->resolvedInboxView( $user_id ) );
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
	 * @param \WP_REST_Request $request Incoming request.
	 * @return true|\WP_Error
	 */
	public function checkPermissions( \WP_REST_Request $request ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new \WP_Error(
				'subtleforms_forbidden',
				__( 'You are not allowed to perform this action.', 'subtleforms' ),
				array( 'status' => 403 )
			);
		}

		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new \WP_Error(
				'subtleforms_invalid_nonce',
				__( 'Security check failed. Please refresh and try again.', 'subtleforms' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}

	/**
	 * Get update arguments schema
	 *
	 * @return array
	 */
	private function getUpdateArgs() {
		// Empty sender/admin emails are valid (defaults are blank). format:email
		// rejects "" before updateSettings runs, so a real edit never saves.
		$validateOptionalEmail = static function ( $value ) {
			if ( null === $value || ( is_string( $value ) && '' === trim( $value ) ) ) {
				return true;
			}

			if ( is_string( $value ) && is_email( $value ) ) {
				return true;
			}

			return new \WP_Error(
				'rest_invalid_param',
				__( 'Email address must be valid or left empty', 'subtleforms' ),
				array( 'status' => 400 )
			);
		};

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
			'submissions_density'        => array(
				'type'              => 'string',
				'enum'              => Settings::INBOX_DENSITY,
				'sanitize_callback' => 'sanitize_text_field',
			),
			'submissions_reading_pane'   => array(
				'type'              => 'string',
				'enum'              => Settings::INBOX_PANE,
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
			// Visitor IP behind a proxy
			'trusted_proxy_cidrs'       => array(
				'type'              => 'array',
				'items'             => array( 'type' => 'string' ),
				'validate_callback' => static function ( $value ) {
					$list = \SubtleForms\Security\ClientIp::parse_list( $value );
					if ( count( $list ) > 100 ) {
						return new \WP_Error( 'rest_invalid_param', __( 'Enter at most 100 proxy addresses or ranges.', 'subtleforms' ), array( 'status' => 400 ) );
					}
					foreach ( $list as $entry ) {
						if ( ! \SubtleForms\Security\ClientIp::valid_range( $entry ) ) {
							/* translators: %s: the rejected address */
							return new \WP_Error( 'rest_invalid_param', sprintf( __( '"%s" is not an IP address or CIDR range.', 'subtleforms' ), sanitize_text_field( $entry ) ), array( 'status' => 400 ) );
						}
					}
					return true;
				},
			),
			'trust_cloudflare'          => array(
				'type' => 'boolean',
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
				'sanitize_callback' => 'sanitize_email',
				'validate_callback' => $validateOptionalEmail,
			),
			'admin_email'                => array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_email',
				'validate_callback' => $validateOptionalEmail,
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
			'entries_trash_days'         => array(
				'type'    => 'integer',
				'minimum' => 1,
				'maximum' => 365,
			),
			'keep_data_on_uninstall'     => array( 'type' => 'boolean' ),

			// ── Extensions ────────────────────────────────────────────────────

			// Webhooks
			'ext_webhooks_enabled'              => array( 'type' => 'boolean' ),
			'ext_webhooks_signing_secret'       => array( 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ),
			'ext_webhooks_events'               => array( 'type' => 'array' ),
			'ext_webhooks_retries'              => array( 'type' => 'integer', 'minimum' => 0, 'maximum' => 5 ),

			// Analytics
		);
	}
}
