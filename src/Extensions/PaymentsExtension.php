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
	 * Delegates payment intent creation to the Pro plugin. No HTTP calls made here.
	 *
	 * @param \WP_REST_Request $request
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function createIntent( \WP_REST_Request $request ) {
		/**
		 * Filter to handle payment intent creation.
		 *
		 * Pro plugin hooks here to implement Stripe / PayPal processing.
		 *
		 * @param \WP_REST_Response|\WP_Error|null $result   Default null (not handled).
		 * @param \WP_REST_Request                  $request  Incoming request.
		 * @param \SubtleForms\Support\Settings     $settings Plugin settings instance.
		 */
		$result = apply_filters( 'subtleforms/extension/payments/create_intent', null, $request, $this->settings );

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
