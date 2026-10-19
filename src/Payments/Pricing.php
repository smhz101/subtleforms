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
 * - payment_hidden_price a fixed fee added to every order it is shown in
 *
 * Whether a priced field counts is decided by conditional logic: a field that
 * is hidden, or sits in a hidden container or a skipped step, adds nothing.
 * Whether its key is in the submitted data never decides it.
 * - calculation          when "Use as price" is on
 *
 * @package SubtleForms\Payments
 * @since   2.1.0
 */

declare(strict_types=1);

namespace SubtleForms\Payments;

use SubtleForms\Engine\ConditionalLogic;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Pricing {

	const PRICED_TYPES = array( 'payment_product', 'payment_choice', 'payment_amount', 'payment_hidden_price' );

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
	 * The fields that count for this answer set, flattened like fields().
	 *
	 * A field is left out when conditional logic hides it, or hides a step or
	 * container it sits in. Keyless nodes are judged by their own show and
	 * hide rules.
	 *
	 * @param mixed $schema  Form schema.
	 * @param array $payload Submitted values.
	 * @return array<int, array>
	 */
	public static function visibleFields( $schema, array $payload ): array {
		$out = array();
		if ( ! is_array( $schema ) || empty( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			return $out;
		}
		$logic  = new ConditionalLogic();
		$state  = $logic->evaluate( $schema, $payload );
		$hidden = array_flip( array_map( 'strval', array_merge( $state['hidden_fields'], $state['hidden_steps'] ) ) );
		// Rules on keyless nodes read the answers that count, like the evaluator.
		$values = $logic->visiblePayload( $schema, $payload );

		$walk = static function ( array $fields, bool $parentHidden ) use ( &$walk, &$out, $hidden, $logic, $values ) {
			foreach ( $fields as $field ) {
				if ( ! is_array( $field ) ) {
					continue;
				}
				$config = isset( $field['config'] ) && is_array( $field['config'] ) ? array_merge( $field, $field['config'] ) : $field;
				$key    = (string) ( $config['key'] ?? '' );
				if ( '' === $key && ( $field['type'] ?? '' ) === 'step' ) {
					$key = (string) ( $field['id'] ?? '' );
				}
				$isHidden = $parentHidden;
				if ( '' !== $key ) {
					$isHidden = $isHidden || isset( $hidden[ $key ] );
				} else {
					foreach ( ConditionalLogic::nodeLogics( $field ) as $l ) {
						$passes = $logic->logicPasses( $l, $values );
						if ( ( 'show' === $l['action'] && ! $passes ) || ( 'hide' === $l['action'] && $passes ) ) {
							$isHidden = true;
						}
					}
				}
				if ( ! $isHidden ) {
					$out[] = $config;
				}
				foreach ( array( 'fields', 'children' ) as $nested ) {
					if ( ! empty( $field[ $nested ] ) && is_array( $field[ $nested ] ) ) {
						$walk( $field[ $nested ], $isHidden );
					}
				}
				if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
					foreach ( $field['columns'] as $column ) {
						if ( ! is_array( $column ) ) {
							continue;
						}
						$list = isset( $column['fields'] ) && is_array( $column['fields'] ) ? $column['fields'] : ( isset( $column['children'] ) && is_array( $column['children'] ) ? $column['children'] : $column );
						$walk( $list, $isHidden );
					}
				}
			}
		};
		$walk( $schema['fields'], false );
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
		$form = is_array( $schema ) ? strtoupper( trim( (string) ( $schema['metadata']['payment']['currency'] ?? '' ) ) ) : '';
		if ( '' !== $form && Currencies::isSupported( $form ) ) {
			return $form;
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
	 * @return array{currency:string,items:array,subtotal:float,discount:float,coupon:?string,tax_rate:float,tax:float,total:float,formula_error:bool}
	 */
	public static function quote( $schema, array $payload, ?array $coupon = null ): array {
		$items    = array();
		$taxRate  = 0.0;
		// Prices round to what the currency can charge: whole yen, cents (PAY-12).
		$currency = self::currency( $schema );
		$money    = static fn( $v ) => self::money( $v, $currency );

		$priced  = $payload;

		// Visibility comes from conditional logic, never from which keys were sent.
		foreach ( self::visibleFields( $schema, $payload ) as $f ) {
			$type  = (string) ( $f['type'] ?? '' );
			$key   = (string) ( $f['key'] ?? '' );
			$label = wp_strip_all_tags( (string) ( $f['label'] ?? $key ) );
			$value = '' !== $key && array_key_exists( $key, $priced ) ? $priced[ $key ] : null;

			switch ( $type ) {
				case 'payment_product':
					$price = $money( $f['price'] ?? 0 );
					if ( ! empty( $f['allowQuantity'] ) ) {
						$qty = (int) ( is_numeric( $value ) ? $value : 0 );
						$min = max( 0, (int) ( $f['minQuantity'] ?? 0 ) );
						$max = (int) ( $f['maxQuantity'] ?? 0 );
						$qty = max( $min, $qty );
						if ( $max > 0 ) {
							$qty = min( $max, $qty );
						}
					} else {
						// A product without a quantity box has no visitor control:
						// it is in every order it is shown in.
						$qty = 1;
					}
					if ( $qty > 0 && $price > 0 ) {
						$items[] = self::item( $key, (string) ( $f['productName'] ?? '' ) ?: $label, $qty, $price, $currency );
					}
					break;

				case 'payment_choice':
					if ( 'checkbox' === (string) ( $f['displayAs'] ?? 'radio' ) ) {
						$selected = is_array( $value ) ? $value : ( null === $value || '' === $value ? array() : explode( ',', (string) $value ) );
					} else {
						// Radio, cards and dropdown pick one option: only the
						// first answer is ever priced (PAY-08).
						$first    = is_array( $value ) ? reset( $value ) : $value;
						$selected = null === $first || false === $first || '' === $first || ! is_scalar( $first ) ? array() : array( $first );
					}
					$selected = array_map( 'strval', array_map( 'trim', array_filter( $selected, 'is_scalar' ) ) );
					foreach ( (array) ( $f['options'] ?? array() ) as $opt ) {
						if ( ! is_array( $opt ) || ! in_array( (string) ( $opt['value'] ?? '' ), $selected, true ) ) {
							continue;
						}
						$price = $money( $opt['price'] ?? 0 );
						if ( $price > 0 ) {
							$items[] = self::item( $key, $label . ': ' . wp_strip_all_tags( (string) ( $opt['label'] ?? '' ) ), 1, $price, $currency );
						}
					}
					break;

				case 'payment_amount':
					$amount = $money( is_numeric( $value ) ? $value : 0 );
					if ( isset( $f['min'] ) && is_numeric( $f['min'] ) && $amount > 0 ) {
						$amount = max( $money( $f['min'] ), $amount );
					}
					if ( isset( $f['max'] ) && is_numeric( $f['max'] ) && (float) $f['max'] > 0 ) {
						$amount = min( $money( $f['max'] ), $amount );
					}
					if ( $amount > 0 ) {
						$items[] = self::item( $key, $label, 1, $amount, $currency );
					}
					break;

				case 'payment_hidden_price':
					$amount = $money( $f['amount'] ?? 0 );
					if ( $amount > 0 ) {
						$items[] = self::item( $key, (string) ( $f['description'] ?? '' ) ?: $label, 1, $amount, $currency );
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
				$amount = $money( isset( $payload[ $k ] ) && is_numeric( $payload[ $k ] ) ? $payload[ $k ] : 0 );
			} else {
				$amount = $money( $legacy['fixedAmount'] ?? 0 );
			}
			if ( $amount > 0 ) {
				$items[] = self::item( 'payment', __( 'Payment', 'subtleforms' ), 1, $amount, $currency );
			}
		}

		/**
		 * Order lines before totals are worked out. Add-ons with their own priced
		 * field types (such as a WooCommerce Product field) add lines here,
		 * priced on the server. Each line: key, label, qty, unit, amount.
		 *
		 * @param array $items   Lines.
		 * @param mixed $schema  Form schema.
		 * @param array $payload Submitted values.
		 */
		$items = array_values( (array) apply_filters( 'subtleforms/payments/line_items', $items, $schema, $payload ) );

		$subtotal = Currencies::round( array_sum( array_column( $items, 'amount' ) ), $currency );
		$discount = $coupon ? Currencies::round( CouponsRepository::discountFor( $coupon, $subtotal ), $currency ) : 0.0;
		$taxable  = max( 0.0, $subtotal - $discount );
		$tax      = Currencies::round( $taxable * $taxRate / 100, $currency );
		$total    = Currencies::round( $taxable + $tax, $currency );

		$quote = array(
			'currency' => $currency,
			'items'    => $items,
			'subtotal' => $subtotal,
			'discount' => $discount,
			'coupon'   => $coupon ? (string) $coupon['code'] : null,
			'tax_rate' => $taxRate,
			'tax'      => $tax,
			'total'    => $total,
			// Add-ons with computed prices (Pro Calculation) set this through
			// the `subtleforms/payments/quote` filter when a total cannot be worked out.
			'formula_error' => false,
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
		return Currencies::toMinor( $amount, $currency );
	}

	/**
	 * Normalise a price to a non-negative float, rounded to the currency's
	 * decimals (two when no currency is given).
	 *
	 * @param mixed  $value    Raw value.
	 * @param string $currency Currency code, or '' for two decimals.
	 */
	public static function money( $value, string $currency = '' ): float {
		if ( ! is_numeric( $value ) ) {
			return 0.0;
		}
		return max( 0.0, '' === $currency ? round( (float) $value, 2 ) : Currencies::round( $value, $currency ) );
	}

	private static function item( string $key, string $label, int $qty, float $unit, string $currency = '' ): array {
		return array(
			'key'    => $key,
			'label'  => $label,
			'qty'    => $qty,
			'unit'   => $unit,
			'amount' => '' === $currency ? round( $qty * $unit, 2 ) : Currencies::round( $qty * $unit, $currency ),
		);
	}
}
