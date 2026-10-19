<?php
/**
 * The currencies SubtleForms can price and charge in.
 *
 * One list for the site setting, the form setting, the saved schema check,
 * rounding and the smallest chargeable amount. resources/shared/currencies.js
 * mirrors it for the browser.
 *
 * `decimals` is the number of minor-unit digits the gateway uses (0 for
 * zero-decimal currencies such as JPY). `minimum` is the smallest card charge
 * Stripe accepts in that currency; for currencies Stripe gives no figure for,
 * it is a little under the 0.50 USD equivalent, so a real order is never
 * refused by this check before the gateway sees it.
 *
 * @package SubtleForms\Payments
 * @since   2.4.0
 */

declare(strict_types=1);

namespace SubtleForms\Payments;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Currencies {

	/**
	 * Code => [ name, decimals, minimum ].
	 */
	const LIST = array(
		'USD' => array( 'US dollar', 2, 0.50 ),
		'EUR' => array( 'Euro', 2, 0.50 ),
		'GBP' => array( 'British pound', 2, 0.30 ),
		'CAD' => array( 'Canadian dollar', 2, 0.50 ),
		'AUD' => array( 'Australian dollar', 2, 0.50 ),
		'NZD' => array( 'New Zealand dollar', 2, 0.50 ),
		'CHF' => array( 'Swiss franc', 2, 0.50 ),
		'JPY' => array( 'Japanese yen', 0, 50 ),
		'KRW' => array( 'South Korean won', 0, 700 ),
		'INR' => array( 'Indian rupee', 2, 0.50 ),
		'PKR' => array( 'Pakistani rupee', 2, 140 ),
		'AED' => array( 'UAE dirham', 2, 2.00 ),
		'SAR' => array( 'Saudi riyal', 2, 2.00 ),
		'SGD' => array( 'Singapore dollar', 2, 0.50 ),
		'HKD' => array( 'Hong Kong dollar', 2, 4.00 ),
		'MYR' => array( 'Malaysian ringgit', 2, 2.00 ),
		'THB' => array( 'Thai baht', 2, 10.00 ),
		'PHP' => array( 'Philippine peso', 2, 25.00 ),
		'SEK' => array( 'Swedish krona', 2, 3.00 ),
		'NOK' => array( 'Norwegian krone', 2, 3.00 ),
		'DKK' => array( 'Danish krone', 2, 2.50 ),
		'PLN' => array( 'Polish zloty', 2, 2.00 ),
		'CZK' => array( 'Czech koruna', 2, 15.00 ),
		'MXN' => array( 'Mexican peso', 2, 10.00 ),
		'BRL' => array( 'Brazilian real', 2, 0.50 ),
		'ZAR' => array( 'South African rand', 2, 9.00 ),
	);

	/** Every supported code. */
	public static function codes(): array {
		return array_keys( self::LIST );
	}

	public static function isSupported( string $code ): bool {
		return isset( self::LIST[ strtoupper( trim( $code ) ) ] );
	}

	/**
	 * Number of minor-unit digits. Unknown codes are treated as two-decimal.
	 */
	public static function decimals( string $code ): int {
		$code = strtoupper( trim( $code ) );
		if ( isset( self::LIST[ $code ] ) ) {
			return (int) self::LIST[ $code ][1];
		}
		return in_array( $code, Pricing::ZERO_DECIMAL, true ) ? 0 : 2;
	}

	/**
	 * Round an amount to what the currency can charge (whole yen, cents).
	 *
	 * @param mixed  $amount   Raw amount.
	 * @param string $currency Currency code.
	 */
	public static function round( $amount, string $currency ): float {
		return is_numeric( $amount ) ? round( (float) $amount, self::decimals( $currency ) ) : 0.0;
	}

	/**
	 * An amount in the currency's smallest unit, as gateways expect.
	 */
	public static function toMinor( float $amount, string $currency ): int {
		$decimals = self::decimals( $currency );
		return (int) round( round( $amount, $decimals ) * ( 10 ** $decimals ) );
	}

	/**
	 * The smallest card charge in this currency, or 0 when not known.
	 */
	public static function minimum( string $currency ): float {
		$code = strtoupper( trim( $currency ) );
		return isset( self::LIST[ $code ] ) ? (float) self::LIST[ $code ][2] : 0.0;
	}

	/**
	 * Why a card cannot be charged this total, or null when it can.
	 *
	 * @param float  $total    Order total.
	 * @param string $currency Currency code.
	 */
	public static function belowMinimum( float $total, string $currency ): ?string {
		$min = self::minimum( $currency );
		if ( $total <= 0 || $min <= 0 || $total >= $min ) {
			return null;
		}
		return sprintf(
			/* translators: %s: smallest amount, for example "0.50 USD" */
			__( 'Card payments need an order of at least %s. Add to your order or contact the site owner.', 'subtleforms' ),
			self::format( $min, $currency )
		);
	}

	/**
	 * A plain "0.50 USD" style amount for messages.
	 */
	public static function format( float $amount, string $currency ): string {
		$code = strtoupper( trim( $currency ) );
		return number_format( $amount, self::decimals( $code ), '.', ',' ) . ' ' . $code;
	}
}
