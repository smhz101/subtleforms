<?php


declare(strict_types=1);

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * WooCommerce extension (settings shell).
 *
 * When WooCommerce is active, a site has one checkout: payment forms can send
 * the order to the WooCommerce cart and checkout, and the WooCommerce Product
 * field sells store products from any form. Both are SubtleForms Pro features
 * (capability `integrations.woocommerce`); Pro does the work, using the
 * `ext_ecommerce_*` settings saved from this extension's settings panel:
 *
 * - ext_ecommerce_default_processor  "woocommerce" or "subtleforms" for new payment forms
 * - ext_ecommerce_empty_cart         empty the visitor's cart before adding the form's items
 * - ext_ecommerce_destination        send visitors to the "checkout" or the "cart"
 *
 * Before 2.1 this extension created one WooCommerce order per submission
 * for a fixed product ID. That is replaced by the checkout integration, so
 * nothing is registered here.
 */
class EcommerceExtension extends AbstractExtension {

	public function slug(): string {
		return 'ecommerce';
	}

	public function label(): string {
		return 'WooCommerce';
	}

	public function register(): void {
		// Settings only. See the class comment.
	}

	/**
	 * Whether WooCommerce is installed and active.
	 */
	public static function wooActive(): bool {
		return class_exists( 'WooCommerce' );
	}
}
