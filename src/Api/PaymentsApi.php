<?php
/**
 * Payments REST API: live order quotes, coupon checks and coupon management.
 *
 * Public (nonce + rate limited):
 *   POST /payments/quote   { form_id, data }          → server-computed order
 *   POST /payments/coupon  { form_id, code, data }    → coupon applied to the order
 *
 * Admin:
 *   GET    /payments/overview                          → gateway status and coupon count
 *   GET    /coupons
 *   POST   /coupons
 *   PUT    /coupons/{id}
 *   DELETE /coupons/{id}
 *
 * @package SubtleForms\Api
 * @since   2.1.0
 */

declare(strict_types=1);

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Payments\CouponsRepository;
use SubtleForms\Payments\Pricing;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Security\RateLimiter;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Validation\Sanitizer;
use WP_REST_Request;
use WP_REST_Response;

final class PaymentsApi {

	use ApiGuards;

	private FormsRepository $formsRepo;
	private FeatureGate $gate;

	public function __construct( FormsRepository $formsRepo, FeatureGate $gate ) {
		$this->formsRepo = $formsRepo;
		$this->gate      = $gate;
	}

	protected function getGate(): FeatureGate {
		return $this->gate;
	}

	public function registerRoutes(): void {
		$ns = 'subtleforms/v1';

		register_rest_route(
			$ns,
			'/payments/quote',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'quote' ),
				'permission_callback' => array( $this, 'publicPermission' ),
			)
		);
		register_rest_route(
			$ns,
			'/payments/coupon',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'applyCoupon' ),
				'permission_callback' => array( $this, 'publicPermission' ),
			)
		);
		register_rest_route(
			$ns,
			'/payments/overview',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'overview' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);
		register_rest_route(
			$ns,
			'/coupons',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'listCoupons' ),
					'permission_callback' => array( $this, 'check_read_permission' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'createCoupon' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				),
			)
		);
		register_rest_route(
			$ns,
			'/coupons/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'PUT, PATCH',
					'callback'            => array( $this, 'updateCoupon' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( $this, 'deleteCoupon' ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				),
			)
		);
	}

	/**
	 * Public endpoints need a REST nonce (rendered with the form) and share the
	 * submit rate limiter, so codes cannot be guessed in bulk.
	 *
	 * @return true|\WP_Error
	 */
	public function publicPermission( WP_REST_Request $request ) {
		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new \WP_Error( 'subtleforms_invalid_nonce', __( 'Your session has expired. Please reload the page and try again.', 'subtleforms' ), array( 'status' => 403 ) );
		}
		$ip     = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0.0.0.0';
		$key    = RateLimiter::buildKey( '/payments/public', 'POST', get_current_user_id() ?: null, $ip );
		$result = RateLimiter::check( $key, 60, 60 );
		if ( ! $result['allowed'] ) {
			return new \WP_Error( 'subtleforms_rate_limited', __( 'Too many requests. Please try again later.', 'subtleforms' ), array( 'status' => 429 ) );
		}
		return true;
	}

	public function quote( WP_REST_Request $request ): WP_REST_Response {
		$ctx = $this->context( $request );
		if ( $ctx instanceof WP_REST_Response ) {
			return $ctx;
		}
		return ApiResponse::success( $ctx['quote'] );
	}

	public function applyCoupon( WP_REST_Request $request ): WP_REST_Response {
		$code = CouponsRepository::normalizeCode( (string) $request->get_param( 'code' ) );
		if ( '' === $code ) {
			return ApiResponse::error( 'subtleforms_coupon_invalid', __( 'Enter a coupon code.', 'subtleforms' ), 422 );
		}
		$ctx = $this->context( $request, $code );
		if ( $ctx instanceof WP_REST_Response ) {
			return $ctx;
		}
		if ( is_wp_error( $ctx['coupon'] ) ) {
			return ApiResponse::error( 'subtleforms_coupon_invalid', $ctx['coupon']->get_error_message(), 422 );
		}
		return ApiResponse::success(
			array(
				'coupon' => CouponsRepository::publicView( $ctx['coupon'] ),
				'quote'  => $ctx['quote'],
			)
		);
	}

	public function overview(): WP_REST_Response {
		$settings = get_option( 'subtleforms_settings', array() );
		$settings = is_array( $settings ) ? $settings : array();
		$provider = (string) ( $settings['ext_payments_provider'] ?? 'stripe' );

		/**
		 * Gateways that can take payments right now. Pro adds Stripe here once
		 * its keys are saved.
		 *
		 * @param array $gateways slug => [ 'label' => string, 'ready' => bool, 'mode' => string ].
		 */
		$gateways = (array) apply_filters( 'subtleforms/payments/gateways', array() );

		return ApiResponse::success(
			array(
				'enabled'  => ! empty( $settings['ext_payments_enabled'] ),
				'provider' => $provider,
				'mode'     => (string) ( $settings['ext_payments_mode'] ?? 'test' ),
				'currency' => strtoupper( (string) ( $settings['ext_payments_currency'] ?? 'USD' ) ),
				'gateways' => $gateways,
				'coupons'  => count( CouponsRepository::all() ),
			)
		);
	}

	public function listCoupons(): WP_REST_Response {
		return ApiResponse::success( CouponsRepository::all() );
	}

	public function createCoupon( WP_REST_Request $request ): WP_REST_Response {
		$saved = CouponsRepository::save( (array) $request->get_json_params() );
		return is_wp_error( $saved ) ? $this->fromError( $saved ) : ApiResponse::success( $saved, 201 );
	}

	public function updateCoupon( WP_REST_Request $request ): WP_REST_Response {
		$id = (int) $request['id'];
		if ( ! CouponsRepository::find( $id ) ) {
			return ApiResponse::not_found( __( 'Coupon not found.', 'subtleforms' ) );
		}
		$saved = CouponsRepository::save( (array) $request->get_json_params(), $id );
		return is_wp_error( $saved ) ? $this->fromError( $saved ) : ApiResponse::success( $saved );
	}

	public function deleteCoupon( WP_REST_Request $request ): WP_REST_Response {
		CouponsRepository::delete( (int) $request['id'] );
		return ApiResponse::success( array( 'deleted' => true ) );
	}

	/**
	 * Resolve the form, payload, coupon and quote for a public request.
	 *
	 * @return array{schema:array,payload:array,coupon:mixed,quote:array}|WP_REST_Response
	 */
	private function context( WP_REST_Request $request, ?string $code = null ) {
		$formId = absint( $request->get_param( 'form_id' ) );
		$form   = $formId ? $this->formsRepo->find( $formId ) : null;
		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}
		$active = $this->formsRepo->loadSchemaVersion( $formId );
		$schema = is_array( $active ) ? ( $active['schema'] ?? $active ) : array();

		$data    = $request->get_param( 'data' );
		$payload = is_array( $data ) ? Sanitizer::sanitizeArrayDeep( $data ) : array();
		$payload = PublicSubmitApi::applyCalculations( $payload, $schema );

		if ( null === $code ) {
			$code = CouponsRepository::normalizeCode( (string) ( $payload['_coupon'] ?? '' ) );
		}

		$base   = Pricing::quote( $schema, $payload );
		$coupon = '' !== $code ? CouponsRepository::validate( $code, $formId, (float) $base['subtotal'] ) : null;
		$quote  = is_array( $coupon ) ? Pricing::quote( $schema, $payload, $coupon ) : $base;

		return array(
			'schema'  => $schema,
			'payload' => $payload,
			'coupon'  => $coupon,
			'quote'   => $quote,
		);
	}

	private function fromError( \WP_Error $error ): WP_REST_Response {
		$data   = $error->get_error_data();
		$status = is_array( $data ) && isset( $data['status'] ) ? (int) $data['status'] : 400;
		return ApiResponse::error( $error->get_error_code(), $error->get_error_message(), $status );
	}
}
