<?php
/**
 * Server-side price calculation for payment forms.
 *
 * The browser shows a live order summary, but the amount a visitor is charged
 * always comes from here: prices are read from the stored form schema, never
 * from the request, and the coupon is checked against the coupons table.
 *
 * Priced field types:
 * - payment_product      a named product with a fixed price and optional quantity
 * - payment_choice       options that each carry a price (radio, dropdown or checkboxes)
 * - payment_amount       an amount the visitor types (donations, invoices)
 * - payment_hidden_price a fixed fee added to every order
 * - calculation          when "Use as price" is on
 *
 * @package SubtleForms\Payments
 * @since   2.1.0
 */

declare(strict_types=1);

namespace SubtleForms\Payments;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Pricing {

	const PRICED_TYPES = array( 'payment_product', 'payment_choice', 'payment_amount', 'payment_hidden_price', 'calculation' );

	/** Currencies with no minor unit (Stripe "zero-decimal" list). */
	const ZERO_DECIMAL = array( 'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF' );

	/**
	 * Every field in a schema, flattened, with config merged onto the node.
	 *
	 * @param mixed $schema Form schema.
	 * @return array<int, array>
	 */
	public static function fields( $schema ): array {
		$out = array();
		if ( ! is_array( $schema ) || empty( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			return $out;
		}
		$walk = static function ( array $fields ) use ( &$walk, &$out ) {
			foreach ( $fields as $field ) {
				if ( ! is_array( $field ) ) {
					continue;
				}
				$config = isset( $field['config'] ) && is_array( $field['config'] ) ? array_merge( $field, $field['config'] ) : $field;
				$out[]  = $config;
				foreach ( array( 'fields', 'children' ) as $nested ) {
					if ( ! empty( $field[ $nested ] ) && is_array( $field[ $nested ] ) ) {
						$walk( $field[ $nested ] );
					}
				}
				if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
					foreach ( $field['columns'] as $column ) {
						if ( is_array( $column ) ) {
							$walk( $column );
						}
					}
				}
			}
		};
		$walk( $schema['fields'] );
		return $out;
	}

	/**
	 * Whether the form charges money at all.
	 *
	 * @param mixed $schema Form schema.
	 */
	public static function isPriced( $schema ): bool {
		foreach ( self::fields( $schema ) as $f ) {
			$type = $f['type'] ?? '';
			if ( in_array( $type, array( 'payment_product', 'payment_choice', 'payment_amount', 'payment_hidden_price', 'payment_card' ), true ) ) {
				return true;
			}
			if ( 'calculation' === $type && ! empty( $f['usePrice'] ) ) {
				return true;
			}
		}
		$legacy = is_array( $schema ) ? ( $schema['metadata']['payment'] ?? array() ) : array();

		/**
		 * Whether a form takes money. Add-ons with their own priced field
		 * types (such as a WooCommerce Product field) return true here.
		 *
		 * @param bool  $priced Default result.
		 * @param mixed $schema Form schema.
		 */
		return (bool) apply_filters( 'subtleforms/payments/is_priced', ! empty( $legacy['enabled'] ), $schema );
	}

	/**
	 * The currency for a form: the form's own setting, else the site default.
	 *
	 * @param mixed $schema Form schema.
	 */
	public static function currency( $schema ): string {
		$form = is_array( $schema ) ? (string) ( $schema['metadata']['payment']['currency'] ?? '' ) : '';
		if ( '' !== $form ) {
			return strtoupper( $form );
		}
		$settings = get_option( 'subtleforms_settings', array() );
		$site     = is_array( $settings ) ? (string) ( $settings['ext_payments_currency'] ?? '' ) : '';
		return strtoupper( '' !== $site ? $site : 'USD' );
	}

	/**
	 * Build the order for a submission.
	 *
	 * @param mixed      $schema  Form schema.
	 * @param array      $payload Submitted values (calculations already applied).
	 * @param array|null $coupon  A validated coupon row, or null.
	 * @return array{currency:string,items:array,subtotal:float,discount:float,coupon:?string,tax_rate:float,tax:float,total:float}
	 */
	public static function quote( $schema, array $payload, ?array $coupon = null ): array {
		$items   = array();
		$taxRate = 0.0;

		foreach ( self::fields( $schema ) as $f ) {
			$type  = (string) ( $f['type'] ?? '' );
			$key   = (string) ( $f['key'] ?? '' );
			$label = wp_strip_all_tags( (string) ( $f['label'] ?? $key ) );
			$value = '' !== $key && array_key_exists( $key, $payload ) ? $payload[ $key ] : null;

			switch ( $type ) {
				case 'payment_product':
					$price = self::money( $f['price'] ?? 0 );
					if ( ! empty( $f['allowQuantity'] ) ) {
						$qty = (int) ( is_numeric( $value ) ? $value : 0 );
						$min = max( 0, (int) ( $f['minQuantity'] ?? 0 ) );
						$max = (int) ( $f['maxQuantity'] ?? 0 );
						$qty = max( $min, $qty );
						if ( $max > 0 ) {
							$qty = min( $max, $qty );
						}
					} else {
						// A product without a quantity box is always in the order,
						// unless conditional logic hid it (no value submitted).
						$qty = null === $value ? 0 : 1;
					}
					if ( $qty > 0 && $price > 0 ) {
						$items[] = self::item( $key, (string) ( $f['productName'] ?? '' ) ?: $label, $qty, $price );
					}
					break;

				case 'payment_choice':
					$selected = is_array( $value ) ? $value : ( null === $value || '' === $value ? array() : explode( ',', (string) $value ) );
					$selected = array_map( 'strval', array_map( 'trim', $selected ) );
					foreach ( (array) ( $f['options'] ?? array() ) as $opt ) {
						if ( ! is_array( $opt ) || ! in_array( (string) ( $opt['value'] ?? '' ), $selected, true ) ) {
							continue;
						}
						$price = self::money( $opt['price'] ?? 0 );
						if ( $price > 0 ) {
							$items[] = self::item( $key, $label . ': ' . wp_strip_all_tags( (string) ( $opt['label'] ?? '' ) ), 1, $price );
						}
					}
					break;

				case 'payment_amount':
					$amount = self::money( is_numeric( $value ) ? $value : 0 );
					if ( isset( $f['min'] ) && is_numeric( $f['min'] ) && $amount > 0 ) {
						$amount = max( (float) $f['min'], $amount );
					}
					if ( isset( $f['max'] ) && is_numeric( $f['max'] ) && (float) $f['max'] > 0 ) {
						$amount = min( (float) $f['max'], $amount );
					}
					if ( $amount > 0 ) {
						$items[] = self::item( $key, $label, 1, $amount );
					}
					break;

				case 'payment_hidden_price':
					$amount = self::money( $f['amount'] ?? 0 );
					if ( $amount > 0 ) {
						$items[] = self::item( $key, (string) ( $f['description'] ?? '' ) ?: $label, 1, $amount );
					}
					break;

				case 'calculation':
					if ( ! empty( $f['usePrice'] ) ) {
						$amount = self::money( is_numeric( $value ) ? $value : 0 );
						if ( $amount > 0 ) {
							$items[] = self::item( $key, $label, 1, $amount );
						}
					}
					break;

				case 'payment_summary':
					if ( ! empty( $f['showTax'] ) && is_numeric( $f['taxRate'] ?? null ) ) {
						$taxRate = max( 0.0, min( 100.0, (float) $f['taxRate'] ) );
					}
					break;
			}
		}

		// Forms built before 2.1 set a fixed or field-based amount in metadata.
		$legacy = is_array( $schema ) ? ( $schema['metadata']['payment'] ?? array() ) : array();
		if ( empty( $items ) && ! empty( $legacy['enabled'] ) ) {
			$amount = 0.0;
			if ( 'field' === ( $legacy['amountType'] ?? 'fixed' ) ) {
				$k      = (string) ( $legacy['amountField'] ?? '' );
				$amount = self::money( isset( $payload[ $k ] ) && is_numeric( $payload[ $k ] ) ? $payload[ $k ] : 0 );
			} else {
				$amount = self::money( $legacy['fixedAmount'] ?? 0 );
			}
			if ( $amount > 0 ) {
				$items[] = self::item( 'payment', __( 'Payment', 'subtleforms' ), 1, $amount );
			}
		}

		$subtotal = round( array_sum( array_column( $items, 'amount' ) ), 2 );
		$discount = $coupon ? CouponsRepository::discountFor( $coupon, $subtotal ) : 0.0;
		$taxable  = max( 0.0, $subtotal - $discount );
		$tax      = round( $taxable * $taxRate / 100, 2 );
		$total    = round( $taxable + $tax, 2 );

		$quote = array(
			'currency' => self::currency( $schema ),
			'items'    => $items,
			'subtotal' => $subtotal,
			'discount' => $discount,
			'coupon'   => $coupon ? (string) $coupon['code'] : null,
			'tax_rate' => $taxRate,
			'tax'      => $tax,
			'total'    => $total,
		);

		/**
		 * Filter the computed order before it is shown or charged.
		 *
		 * @param array $quote   Order.
		 * @param array $schema  Form schema.
		 * @param array $payload Submitted values.
		 */
		return (array) apply_filters( 'subtleforms/payments/quote', $quote, $schema, $payload );
	}

	/**
	 * An amount in the currency's smallest unit, as gateways expect.
	 */
	public static function toMinor( float $amount, string $currency ): int {
		return in_array( strtoupper( $currency ), self::ZERO_DECIMAL, true )
			? (int) round( $amount )
			: (int) round( $amount * 100 );
	}

	/**
	 * Normalise a price to a non-negative float with two decimals.
	 *
	 * @param mixed $value Raw value.
	 */
	public static function money( $value ): float {
		return is_numeric( $value ) ? max( 0.0, round( (float) $value, 2 ) ) : 0.0;
	}

	private static function item( string $key, string $label, int $qty, float $unit ): array {
		return array(
			'key'    => $key,
			'label'  => $label,
			'qty'    => $qty,
			'unit'   => $unit,
			'amount' => round( $qty * $unit, 2 ),
		);
	}
}
