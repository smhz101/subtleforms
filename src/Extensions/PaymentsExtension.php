<?php
declare(strict_types=1);

namespace SubtleForms\Extensions;

/**
 * Payments Extension
 *
 * Handles payment intents via Stripe or PayPal when a form submission
 * includes a payment amount.  The REST endpoint creates a payment intent
 * so the front end can complete the charge without exposing secret keys.
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
				'permission_callback' => '__return_true',
				'args'                => array(
					'amount'  => array(
						'type'              => 'integer',
						'required'          => true,
						'minimum'           => 1,
						'sanitize_callback' => 'absint',
					),
					'form_id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	/**
	 * Create a payment intent and return the client secret.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function createIntent( \WP_REST_Request $request ) {
		$provider = (string) $this->getSetting( 'provider' );
		$amount   = (int) $request->get_param( 'amount' );
		$currency = strtolower( (string) $this->getSetting( 'currency' ) ?: 'usd' );
		$mode     = (string) $this->getSetting( 'mode' );

		if ( 'stripe' === $provider ) {
			return $this->stripeCreateIntent( $amount, $currency, $mode );
		}

		if ( 'paypal' === $provider ) {
			return $this->paypalCreateOrder( $amount, $currency, $mode );
		}

		return new \WP_Error( 'unsupported_provider', __( 'Unsupported payment provider.', 'subtleforms' ), array( 'status' => 400 ) );
	}

	private function stripeCreateIntent( int $amount, string $currency, string $mode ): \WP_REST_Response {
		$secret_key = (string) $this->getSetting( 'stripe_sk' );
		if ( ! $secret_key ) {
			return new \WP_REST_Response( array( 'error' => 'missing_key' ), 400 );
		}

		$response = wp_remote_post(
			'https://api.stripe.com/v1/payment_intents',
			array(
				'headers'   => array(
					'Authorization' => 'Bearer ' . $secret_key,
					'Content-Type'  => 'application/x-www-form-urlencoded',
				),
				'body'      => array(
					'amount'   => $amount,
					'currency' => $currency,
				),
				'timeout'   => 20,
				'sslverify' => true,
			)
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_REST_Response( array( 'error' => 'request_failed' ), 502 );
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		return new \WP_REST_Response(
			array(
				'provider'      => 'stripe',
				'client_secret' => $body['client_secret'] ?? null,
				'intent_id'     => $body['id'] ?? null,
			),
			200
		);
	}

	private function paypalCreateOrder( int $amount, string $currency, string $mode ): \WP_REST_Response {
		$client_id     = (string) $this->getSetting( 'paypal_client_id' );
		$client_secret = (string) $this->getSetting( 'paypal_client_secret' );

		if ( ! $client_id || ! $client_secret ) {
			return new \WP_REST_Response( array( 'error' => 'missing_key' ), 400 );
		}

		$base_url = 'live' === $mode
			? 'https://api-m.paypal.com'
			: 'https://api-m.sandbox.paypal.com';

		// Step 1: get access token.
		$token_response = wp_remote_post(
			"{$base_url}/v1/oauth2/token",
			array(
				'headers'   => array(
					'Authorization' => 'Basic ' . base64_encode( $client_id . ':' . $client_secret ),
					'Content-Type'  => 'application/x-www-form-urlencoded',
				),
				'body'      => 'grant_type=client_credentials',
				'timeout'   => 20,
				'sslverify' => true,
			)
		);

		if ( is_wp_error( $token_response ) ) {
			return new \WP_REST_Response( array( 'error' => 'auth_failed' ), 502 );
		}

		$token_data   = json_decode( wp_remote_retrieve_body( $token_response ), true );
		$access_token = $token_data['access_token'] ?? '';

		if ( ! $access_token ) {
			return new \WP_REST_Response( array( 'error' => 'no_token' ), 502 );
		}

		// Step 2: create order.
		$order_response = wp_remote_post(
			"{$base_url}/v2/checkout/orders",
			array(
				'headers'   => array(
					'Authorization' => 'Bearer ' . $access_token,
					'Content-Type'  => 'application/json',
				),
				'body'      => wp_json_encode(
					array(
						'intent'         => 'CAPTURE',
						'purchase_units' => array(
							array(
								'amount' => array(
									'currency_code' => strtoupper( $currency ),
									'value'         => number_format( $amount / 100, 2, '.', '' ),
								),
							),
						),
					)
				),
				'timeout'   => 20,
				'sslverify' => true,
			)
		);

		if ( is_wp_error( $order_response ) ) {
			return new \WP_REST_Response( array( 'error' => 'order_failed' ), 502 );
		}

		$order_data = json_decode( wp_remote_retrieve_body( $order_response ), true );

		return new \WP_REST_Response(
			array(
				'provider' => 'paypal',
				'order_id' => $order_data['id'] ?? null,
			),
			200
		);
	}
}
