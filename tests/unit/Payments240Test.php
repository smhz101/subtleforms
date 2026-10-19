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

	/** PAY-26: minimums follow Stripe's published table where it lists the currency. */
	public function test_pay26_minimums_match_stripe_published_amounts(): void {
		$this->assertSame( 50.0, Currencies::minimum( 'KRW' ) );
		$this->assertSame( 0.5, Currencies::minimum( 'PHP' ) );
		$this->assertSame( 0.5, Currencies::minimum( 'ZAR' ) );
		$this->assertNull( Currencies::belowMinimum( 1.0, 'PHP' ) );
	}

	/** PAY2-02: a form with no currency of its own follows the site currency. */
	public function test_pay2_02_form_without_currency_follows_the_site(): void {
		$GLOBALS['sf_test_options']['subtleforms_settings'] = array( 'ext_payments_currency' => 'eur' );
		$this->assertSame( 'EUR', Pricing::currency( array( 'metadata' => array( 'payment' => array( 'processor' => 'subtleforms' ) ) ) ) );
		$this->assertSame( 'EUR', Pricing::currency( array( 'metadata' => array( 'payment' => array( 'currency' => '' ) ) ) ) );
		$this->assertSame( 'JPY', Pricing::currency( array( 'metadata' => array( 'payment' => array( 'currency' => 'jpy' ) ) ) ) );
	}

	/** PAY2-02: saving payment settings never adds a currency, and every listed code saves. */
	public function test_pay2_02_saving_payment_settings_adds_no_currency(): void {
		$validator = new \SubtleForms\Validation\RequestValidator( array( 'schemas' => \SubtleForms\Validation\Schemas::all() ) );
		$rules     = \SubtleForms\Validation\Schemas::all()['PaymentConfig'];
		$this->assertStringNotContainsString( 'default:', $rules['currency'] );
		foreach ( array( 'PKR', 'AED', 'KRW' ) as $code ) {
			$this->assertStringContainsString( $code, $rules['currency'] );
		}
		$out = $validator->validateOrFail(
			array(
				'activate' => false,
				'schema'   => array(
					'metadata' => array( 'type' => 'payment', 'payment' => array( 'processor' => 'subtleforms', 'enabled' => true ) ),
					'fields'   => array(),
				),
			),
			\SubtleForms\Validation\Schemas::get( \SubtleForms\Validation\Schemas::FORM_SCHEMA_SAVE )
		);
		$this->assertArrayNotHasKey( 'currency', $out['schema']['metadata']['payment'] );
	}

	/** PAY-17: a Product's name, price and quantity settings are under General. */
	public function test_pay17_product_settings_are_under_general(): void {
		$registry = new \SubtleForms\Fields\FieldRegistry();
		\SubtleForms\Fields\PaymentFields::register( $registry );
		$sections = array();
		foreach ( (array) $registry->get( 'payment_product' )->inspectorControls as $c ) {
			$sections[ $c['name'] ] = $c['section'] ?? 'general-by-name';
		}
		foreach ( array( 'productName', 'price', 'allowQuantity', 'minQuantity', 'maxQuantity' ) as $name ) {
			$this->assertSame( 'general', $sections[ $name ] ?? null, $name );
		}
	}
}
