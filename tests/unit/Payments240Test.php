<?php
// phpcs:disable -- Unit tests; not shipped in production plugin.
/**
 * Payments, free side (2.4.0, package F240-6).
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Payments\Currencies;
use SubtleForms\Payments\Pricing;

final class Payments240Test extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['sf_test_options']['subtleforms_settings'] );
		parent::tearDown();
	}

	private function jpy(): array {
		return array(
			'metadata' => array( 'payment' => array( 'currency' => 'JPY' ) ),
			'fields'   => array(
				array( 'type' => 'payment_product', 'key' => 'item', 'label' => 'Item', 'price' => 1250.50 ),
				array( 'type' => 'payment_amount', 'key' => 'tip', 'label' => 'Tip' ),
			),
		);
	}

	/** PAY-12: a zero-decimal order is whole yen in every line and the total. */
	public function test_pay12_zero_decimal_orders_round_to_whole_units(): void {
		$q = Pricing::quote( $this->jpy(), array( 'tip' => '100.70' ) );
		$this->assertSame( 'JPY', $q['currency'] );
		$this->assertSame( 1251.0, $q['items'][0]['amount'] );
		$this->assertSame( 101.0, $q['items'][1]['amount'] );
		$this->assertSame( 1352.0, $q['subtotal'] );
		$this->assertSame( 1352.0, $q['total'] );
		$this->assertSame( 1352, Pricing::toMinor( $q['total'], 'JPY' ) );
	}

	/** PAY-12: two-decimal currencies keep cents. */
	public function test_pay12_two_decimal_orders_keep_cents(): void {
		$schema                                    = $this->jpy();
		$schema['metadata']['payment']['currency'] = 'EUR';
		$q = Pricing::quote( $schema, array( 'tip' => '100.70' ) );
		$this->assertSame( 1351.2, $q['total'] );
		$this->assertSame( 135120, Pricing::toMinor( $q['total'], 'EUR' ) );
	}

	/** PAY-12: the browser list mirrors the server list exactly. */
	public function test_pay12_browser_currency_list_matches_the_server(): void {
		$js = (string) file_get_contents( dirname( __DIR__, 2 ) . '/resources/shared/currencies.js' );
		preg_match_all( "/^\s+([A-Z]{3}): \['([^']+)', (\d), ([\d.]+)\],$/m", $js, $m, PREG_SET_ORDER );
		$browser = array();
		foreach ( $m as $row ) {
			$browser[ $row[1] ] = array( $row[2], (int) $row[3], (float) $row[4] );
		}
		$server = array_map(
			static fn( $r ) => array( $r[0], (int) $r[1], (float) $r[2] ),
			Currencies::LIST
		);
		$this->assertSame( $server, $browser );
	}
}
