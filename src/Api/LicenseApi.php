<?php
/**
 * License REST API Controller
 *
 * Handles subscription management endpoints: connect, disconnect, and status.
 * All endpoints require manage_options capability.
 *
 * Routes:
 *   POST /subtleforms/v1/license/connect      — Activate a license key.
 *   POST /subtleforms/v1/license/disconnect   — Deactivate and clear credentials.
 *   GET  /subtleforms/v1/license/status       — Current subscription status.
 *
 * @package SubtleForms\Api
 * @since   2.1.0
 */

namespace SubtleForms\Api;

use SubtleForms\Licensing\SubscriptionManager;

/**
 * REST API controller for license / subscription management.
 */
class LicenseApi {

	/** @var SubscriptionManager */
	private $subscriptionManager;

	/**
	 * @param SubscriptionManager $subscriptionManager
	 */
	public function __construct( SubscriptionManager $subscriptionManager ) {
		$this->subscriptionManager = $subscriptionManager;
	}

	/**
	 * Register the REST routes.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			'subtleforms/v1',
			'/license/connect',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'connect' ),
				'permission_callback' => array( $this, 'admin_permission' ),
				'args'                => array(
					'email'       => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_email',
						'validate_callback' => fn( $v ) => is_email( $v ),
					),
					'license_key' => array(
						'required'          => true,
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		register_rest_route(
			'subtleforms/v1',
			'/license/disconnect',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'disconnect' ),
				'permission_callback' => array( $this, 'admin_permission' ),
			)
		);

		register_rest_route(
			'subtleforms/v1',
			'/license/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'status' ),
				'permission_callback' => array( $this, 'admin_permission' ),
			)
		);
	}

	/**
	 * Permission callback — only site admins may manage licensing.
	 *
	 * @param \WP_REST_Request $request Incoming request.
	 * @return true|\WP_Error
	 */
	public function admin_permission( \WP_REST_Request $request ) {
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
	 * POST /subtleforms/v1/license/connect
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public function connect( \WP_REST_Request $request ): \WP_REST_Response {
		$email      = $request->get_param( 'email' );
		$licenseKey = $request->get_param( 'license_key' );

		$result = $this->subscriptionManager->connect( $email, $licenseKey );

		if ( empty( $result['success'] ) ) {
			return new \WP_REST_Response(
				array(
					'success' => false,
					'message' => $result['error'] ?? __( 'License activation failed.', 'subtleforms' ),
				),
				422
			);
		}

		return new \WP_REST_Response( $this->buildStatusPayload(), 200 );
	}

	/**
	 * POST /subtleforms/v1/license/disconnect
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public function disconnect( \WP_REST_Request $request ): \WP_REST_Response {
		$this->subscriptionManager->disconnect();
		return new \WP_REST_Response( array( 'success' => true ), 200 );
	}

	/**
	 * GET /subtleforms/v1/license/status
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response
	 */
	public function status( \WP_REST_Request $request ): \WP_REST_Response {
		return new \WP_REST_Response( $this->buildStatusPayload(), 200 );
	}

	/**
	 * Build the status response payload.
	 *
	 * @return array
	 */
	private function buildStatusPayload(): array {
		return array_merge(
			array( 'success' => true ),
			$this->subscriptionManager->toArray()
		);
	}
}
