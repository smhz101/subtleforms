<?php
/**
 * SubtleForms Onboarding REST API
 *
 * Handles onboarding wizard, create-form wizard, and builder tour endpoints.
 *
 * @package SubtleForms\Api
 * @since   1.9.0
 */

namespace SubtleForms\Api;

use SubtleForms\Security\RateLimiter;
use WP_REST_Request;
use WP_REST_Response;

/**
 * REST API controller for onboarding & tour state.
 */
final class OnboardingApi {

	private const NAMESPACE = 'subtleforms/v1';

	/**
	 * Register REST API routes.
	 */
	public function registerRoutes(): void {
		// Onboarding
		register_rest_route(
			self::NAMESPACE,
			'/onboarding/send-test-email',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'send_test_email' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
			)
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

		// Create wizard
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

		// Builder tour
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
	}

	// ── Onboarding ──────────────────────────────────────────────────────────

	public function dismiss_onboarding( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return ApiResponse::unauthorized( 'User not authenticated' );
		}

		update_user_meta( $user_id, 'subtleforms_onboarding_dismissed', true );

		return ApiResponse::success(
			array(
				'success' => true,
				'message' => 'Onboarding dismissed',
			)
		);
	}

	public function get_onboarding_status( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return ApiResponse::success(
				array(
					'success'   => false,
					'dismissed' => false,
				)
			);
		}

		$dismissed = (bool) get_user_meta( $user_id, 'subtleforms_onboarding_dismissed', true );

		return ApiResponse::success(
			array(
				'success'   => true,
				'dismissed' => $dismissed,
			)
		);
	}

	public function send_test_email( WP_REST_Request $request ): WP_REST_Response {
		try {
			$settings = new \SubtleForms\Support\Settings();
			$to       = $settings->getAdminEmail();
			$subject  = __( 'SubtleForms: Test email', 'subtleforms' );
			$message  = __( 'This is a test email sent from SubtleForms to verify delivery to your admin email address.', 'subtleforms' );

			$sent = \SubtleForms\Support\Mailer::send( $to, $subject, $message );

			if ( $sent ) {
				return ApiResponse::success( array( 'success' => true ) );
			}

			return ApiResponse::success(
				array(
					'success' => false,
					'message' => __( 'Failed to send test email', 'subtleforms' ),
				)
			);
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( $e->getMessage() );
		}
	}

	// ── Create wizard ───────────────────────────────────────────────────────

	public function dismiss_create_wizard( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return ApiResponse::unauthorized( 'User not authenticated' );
		}

		update_user_meta( $user_id, 'subtleforms_create_wizard_dismissed', true );

		return ApiResponse::success(
			array(
				'success' => true,
				'message' => 'Create wizard dismissed',
			)
		);
	}

	public function get_create_wizard_status( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return ApiResponse::success(
				array(
					'success'   => false,
					'dismissed' => false,
				)
			);
		}

		$dismissed = (bool) get_user_meta( $user_id, 'subtleforms_create_wizard_dismissed', true );

		return ApiResponse::success(
			array(
				'success'   => true,
				'dismissed' => $dismissed,
			)
		);
	}

	// ── Builder tour ────────────────────────────────────────────────────────

	public function complete_tour( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return ApiResponse::unauthorized( 'User not authenticated' );
		}

		update_user_meta( $user_id, 'subtleforms_tour_completed', true );

		return ApiResponse::success(
			array(
				'success' => true,
				'message' => 'Tour completed',
			)
		);
	}

	public function get_tour_status( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return ApiResponse::success(
				array(
					'success'   => false,
					'completed' => false,
				)
			);
		}

		$completed = (bool) get_user_meta( $user_id, 'subtleforms_tour_completed', true );

		return ApiResponse::success(
			array(
				'success'   => true,
				'completed' => $completed,
			)
		);
	}

	// ── Permissions ─────────────────────────────────────────────────────────

	public function check_read_permission(): bool {
		return current_user_can( 'edit_posts' );
	}

	public function check_write_permission(): bool {
		return current_user_can( 'edit_posts' );
	}
}
