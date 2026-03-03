<?php

namespace SubtleForms\Api;

use SubtleForms\Licensing\LicenseManager;
use SubtleForms\Security\RateLimiter;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * License API Endpoints
 *
 * Handles REST API endpoints for license management:
 * - POST /license/activate
 * - POST /license/deactivate
 * - GET /license/status
 * - POST /license/validate
 *
 * @package SubtleForms\Api
 * @since 2.0.0
 */
class LicenseApi {

	/**
	 * @var LicenseManager
	 */
	private $license_manager;

	/**
	 * @var RateLimiter
	 */
	private $rate_limiter;

	/**
	 * Constructor
	 *
	 * @param LicenseManager $license_manager License manager
	 * @param RateLimiter    $rate_limiter    Rate limiter
	 */
	public function __construct( LicenseManager $license_manager, RateLimiter $rate_limiter ) {
		$this->license_manager = $license_manager;
		$this->rate_limiter    = $rate_limiter;
	}

	/**
	 * Register REST routes
	 */
	public function register_routes() {
		$namespace = 'subtleforms/v1';

		// Activate license
		register_rest_route( $namespace, '/license/activate', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'activate' ),
			'permission_callback' => array( $this, 'check_admin_permissions' ),
			'args'                => array(
				'key' => array(
					'required'          => true,
					'type'              => 'string',
					'description'       => __( 'License key to activate', 'subtleforms' ),
					'sanitize_callback' => 'sanitize_text_field',
					'validate_callback' => array( $this, 'validate_license_key' ),
				),
			),
		) );

		// Deactivate license
		register_rest_route( $namespace, '/license/deactivate', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'deactivate' ),
			'permission_callback' => array( $this, 'check_admin_permissions' ),
		) );

		// Get license status
		register_rest_route( $namespace, '/license/status', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'get_status' ),
			'permission_callback' => array( $this, 'check_admin_permissions' ),
		) );

		// Validate license (force refresh)
		register_rest_route( $namespace, '/license/validate', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'validate' ),
			'permission_callback' => array( $this, 'check_admin_permissions' ),
		) );
	}

	/**
	 * Activate license
	 *
	 * @param WP_REST_Request $request Request object
	 * @return WP_REST_Response|WP_Error
	 */
	public function activate( WP_REST_Request $request ) {
		// Rate limiting (3 attempts per hour to prevent brute force)
		$limiter_key = 'license_activate_' . get_current_user_id();
		if ( ! $this->rate_limiter->attempt( $limiter_key, 3, 3600 ) ) {
			return ApiResponse::error(
				'rate_limit_exceeded',
				__( 'Too many activation attempts. Please try again later.', 'subtleforms' ),
				array( 'status' => 429 )
			);
		}

		$key = $request->get_param( 'key' );

		// Activate license
		$result = $this->license_manager->activate( $key );

		if ( ! $result['success'] ) {
			return ApiResponse::error(
				'activation_failed',
				$result['message'],
				array( 'status' => 400 )
			);
		}

		return ApiResponse::success( $result['data'], $result['message'] );
	}

	/**
	 * Deactivate license
	 *
	 * @param WP_REST_Request $request Request object
	 * @return WP_REST_Response|WP_Error
	 */
	public function deactivate( WP_REST_Request $request ) {
		$success = $this->license_manager->deactivate();

		if ( ! $success ) {
			return ApiResponse::error(
				'deactivation_failed',
				__( 'Failed to deactivate license.', 'subtleforms' ),
				array( 'status' => 500 )
			);
		}

		return ApiResponse::success(
			array( 'status' => 'deactivated' ),
			__( 'License deactivated successfully.', 'subtleforms' )
		);
	}

	/**
	 * Get license status
	 *
	 * @param WP_REST_Request $request Request object
	 * @return WP_REST_Response
	 */
	public function get_status( WP_REST_Request $request ) {
		$data = $this->license_manager->getLicenseData();

		// Add computed fields
		$data['is_valid']             = $this->license_manager->isValid();
		$data['days_until_expiration'] = $this->license_manager->getDaysUntilExpiration();

		// Add warnings if needed
		$warnings = array();
		$days     = $data['days_until_expiration'];

		if ( $days !== null && $days <= 30 ) {
			$warnings[] = sprintf(
				/* translators: %d: days remaining */
				_n(
					'Your license expires in %d day.',
					'Your license expires in %d days.',
					$days,
					'subtleforms'
				),
				$days
			);
		}

		if ( $data['status'] === LicenseManager::STATUS_GRACE_PERIOD ) {
			$warnings[] = __( 'Your license has expired but is in grace period.', 'subtleforms' );
		}

		$data['warnings'] = $warnings;

		return ApiResponse::success( $data );
	}

	/**
	 * Validate license (force refresh)
	 *
	 * @param WP_REST_Request $request Request object
	 * @return WP_REST_Response|WP_Error
	 */
	public function validate( WP_REST_Request $request ) {
		// Rate limiting (10 attempts per hour)
		$limiter_key = 'license_validate_' . get_current_user_id();
		if ( ! $this->rate_limiter->attempt( $limiter_key, 10, 3600 ) ) {
			return ApiResponse::error(
				'rate_limit_exceeded',
				__( 'Too many validation attempts. Please try again later.', 'subtleforms' ),
				array( 'status' => 429 )
			);
		}

		// Force refresh license data
		$data = $this->license_manager->getLicenseData( true );

		$message = __( 'License validated successfully.', 'subtleforms' );

		if ( ! $this->license_manager->isValid() ) {
			$message = __( 'License validation failed.', 'subtleforms' );
		}

		return ApiResponse::success(
			array(
				'status'    => $data['status'],
				'is_valid'  => $this->license_manager->isValid(),
				'expires_at' => $data['expires_at'],
				'plan'      => $data['plan'],
			),
			$message
		);
	}

	/**
	 * Validate license key format
	 *
	 * @param string          $value   License key
	 * @param WP_REST_Request $request Request object
	 * @param string          $param   Parameter name
	 * @return bool|WP_Error
	 */
	public function validate_license_key( $value, $request, $param ) {
		// Remove hyphens
		$clean_key = str_replace( '-', '', $value );

		// Must be 16 alphanumeric characters
		if ( ! preg_match( '/^[A-Z0-9]{16}$/', strtoupper( $clean_key ) ) ) {
			return new WP_Error(
				'invalid_license_format',
				__( 'Invalid license key format. Expected format: XXXX-XXXX-XXXX-XXXX', 'subtleforms' )
			);
		}

		return true;
	}

	/**
	 * Check admin permissions
	 *
	 * @return bool
	 */
	public function check_admin_permissions() {
		return current_user_can( 'manage_options' );
	}
}
