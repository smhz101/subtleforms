<?php


declare(strict_types=1);

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Payments Extension
 *
 * Free-plugin stub. Actual Stripe / PayPal processing is implemented by
 * the Pro plugin via the `subtleforms/extension/payments/create_intent` filter.
 *
 * No external API calls are made here.
 */
class PaymentsExtension extends AbstractExtension {

	public function slug(): string {
		return 'payments';
	}

	public function label(): string {
		return 'Payments';
	}

	public function register(): void {
		if ( ! $this->isEnabled() ) {
			return;
		}

		// Register payment-intent REST endpoint for the front end.
		add_action( 'rest_api_init', array( $this, 'registerRoutes' ) );
	}

	public function registerRoutes(): void {
		register_rest_route(
			'subtleforms/v1',
			'/payments/intent',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'createIntent' ),
				'permission_callback' => array( $this, 'checkIntentPermission' ),
				'args'                => array(
					'form_id'   => array(
						'type'              => 'integer',
						'required'          => true,
						'minimum'           => 1,
						'sanitize_callback' => 'absint',
					),
					// Selection of priced items/options from the form schema. The
					// server resolves these to an amount; the client never states a price.
					'data'      => array(
						'type'     => 'object',
						'required' => false,
						'default'  => array(),
					),
				),
			)
		);
	}

	/**
	 * Guard the public payment-intent endpoint.
	 *
	 * The route must stay reachable by logged-out visitors, so this checks a
	 * REST nonce rather than a capability, and applies the shared rate limiter
	 * to stop an attacker minting intents in bulk.
	 *
	 * @param \WP_REST_Request $request Incoming request.
	 * @return bool|\WP_Error
	 */
	public function checkIntentPermission( \WP_REST_Request $request ) {
		$nonce = $request->get_header( 'X-WP-Nonce' );

		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new \WP_Error(
				'subtleforms_invalid_nonce',
				__( 'Your session has expired. Please reload the page and try again.', 'subtleforms' ),
				array( 'status' => 403 )
			);
		}

		$ip = isset( $_SERVER['REMOTE_ADDR'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) )
			: '0.0.0.0';

		$route  = $request->get_route();
		$method = $request->get_method();
		$policy = \SubtleForms\Security\RateLimiter::policy( $route, $method );
		$key    = \SubtleForms\Security\RateLimiter::buildKey( $route, $method, get_current_user_id() ?: null, $ip );
		$result = \SubtleForms\Security\RateLimiter::check( $key, $policy['limit'], $policy['window'] );

		if ( ! $result['allowed'] ) {
			return new \WP_Error(
				'subtleforms_rate_limited',
				__( 'Too many requests. Please try again later.', 'subtleforms' ),
				array(
					'status'      => 429,
					'retry_after' => $result['retry_after'],
				)
			);
		}

		return true;
	}

	/**
	 * Delegates payment intent creation to the Pro plugin. No HTTP calls made here.
	 *
	 * The amount is deliberately NOT part of the request contract. Implementers
	 * of the filter below must resolve the price from the stored form schema
	 * using `form_id` and `selection`; trusting a client-supplied figure would
	 * let a caller pay an arbitrary amount.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function createIntent( \WP_REST_Request $request ) {
		$formId = absint( $request->get_param( 'form_id' ) );
		$repo   = new \SubtleForms\Repositories\FormsRepository();
		$form   = $formId ? $repo->find( $formId ) : null;
		// Like /submit: guests only reach published forms (PAY-16).
		if ( ! $form || ! \SubtleForms\Api\PaymentsApi::formIsOpen( $form ) ) {
			return new \WP_Error( 'subtleforms_not_found', __( 'Form not found', 'subtleforms' ), array( 'status' => 404 ) );
		}
		$active = $repo->loadSchemaVersion( $formId );
		$schema = is_array( $active ) ? ( $active['schema'] ?? $active ) : array();

		$data    = $request->get_param( 'data' );
		$payload = is_array( $data ) ? \SubtleForms\Validation\Sanitizer::sanitizeArrayDeep( $data ) : array();
		$payload = \SubtleForms\Api\PublicSubmitApi::applyComputedValues( $payload, $schema );

		$quote = \SubtleForms\Payments\Pricing::quote( $schema, $payload );
		$code  = \SubtleForms\Payments\CouponsRepository::codeFrom( $schema, $payload );
		if ( '' !== $code ) {
			$coupon = \SubtleForms\Payments\CouponsRepository::validate( $code, $formId, (float) $quote['subtotal'], \SubtleForms\Payments\CouponsRepository::customerKey( $schema, $payload ) );
			if ( is_wp_error( $coupon ) ) {
				return $coupon;
			}
			$quote = \SubtleForms\Payments\Pricing::quote( $schema, $payload, $coupon );
		}

		if ( $quote['total'] <= 0 ) {
			return new \WP_Error( 'subtleforms_nothing_to_pay', __( 'There is nothing to pay for this order.', 'subtleforms' ), array( 'status' => 400 ) );
		}

		/**
		 * Create a payment intent with the gateway.
		 *
		 * The amount always comes from `$quote`, which the server computed from
		 * the stored schema. Never trust an amount sent by the browser.
		 *
		 * @param \WP_REST_Response|\WP_Error|array|null $result   Default null (not handled).
		 * @param \WP_REST_Request                       $request  Incoming request.
		 * @param \SubtleForms\Support\Settings          $settings Plugin settings instance.
		 * @param array                                  $quote    Server-computed order.
		 * @param int                                    $formId   Form ID.
		 */
		$result = apply_filters( 'subtleforms/extension/payments/create_intent', null, $request, $this->settings, $quote, $formId );

		if ( $result !== null ) {
			return $result;
		}

		return new \WP_Error(
			'subtleforms_pro_required',
			__( 'Payment processing requires the SubtleForms Pro plugin.', 'subtleforms' ),
			array( 'status' => 501 )
		);
	}
}
