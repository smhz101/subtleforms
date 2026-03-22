<?php
declare(strict_types=1);

namespace SubtleForms\Extensions;

/**
 * E-commerce Extension
 *
 * Creates a WooCommerce order when a form is submitted.
 * Requires WooCommerce to be installed and active; silently skips otherwise.
 */
class EcommerceExtension extends AbstractExtension {

	public function slug(): string {
		return 'ecommerce';
	}

	public function label(): string {
		return 'E-commerce';
	}

	public function register(): void {
		if ( ! $this->isEnabled() ) {
			return;
		}

		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		add_action( 'subtleforms/submission/saved', array( $this, 'createOrder' ), 10, 2 );
	}

	/**
	 * Create a WooCommerce order from the form submission.
	 *
	 * @param int   $form_id    Form ID.
	 * @param array $submission Submission data array.
	 */
	public function createOrder( int $form_id, array $submission ): void {
		$product_id = (int) $this->getSetting( 'product_id' );
		$currency   = (string) $this->getSetting( 'currency' );

		if ( ! $product_id ) {
			return;
		}

		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return;
		}

		$order = wc_create_order();
		if ( is_wp_error( $order ) ) {
			return;
		}

		$order->add_product( $product, 1 );

		// Attach billing email from submission if available.
		$email = $this->extractEmail( $submission );
		if ( $email ) {
			$order->set_billing_email( $email );
		}

		$order->set_currency( $currency ?: get_woocommerce_currency() );
		$order->calculate_totals();
		$order->update_status( 'pending', __( 'Order created via SubtleForms submission.', 'subtleforms' ) );
	}

	private function extractEmail( array $submission ): string {
		if ( ! empty( $submission['data'] ) && is_array( $submission['data'] ) ) {
			foreach ( $submission['data'] as $value ) {
				if ( is_string( $value ) && is_email( $value ) ) {
					return $value;
				}
			}
		}
		return '';
	}
}
