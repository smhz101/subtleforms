<?php

/**
 * Server-side order maths for payment forms (2.1).
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\Formula;
use SubtleForms\Payments\Pricing;
use SubtleForms\Payments\CouponsRepository;

final class PricingTest extends TestCase {

	private function schema(): array {
		return array(
			'fields' => array(
				array( 'type' => 'payment_product', 'key' => 'ticket', 'label' => 'Ticket', 'price' => 20, 'allowQuantity' => true, 'maxQuantity' => 5 ),
				array(
					'type'    => 'payment_choice',
					'key'     => 'extras',
					'label'   => 'Extras',
					'options' => array(
						array( 'label' => 'Lunch', 'value' => 'lunch', 'price' => 10 ),
						array( 'label' => 'Video', 'value' => 'video', 'price' => 15 ),
					),
				),
				array( 'type' => 'payment_hidden_price', 'key' => 'fee', 'label' => 'Fee', 'amount' => 2.5 ),
				array( 'type' => 'calculation', 'key' => 'calc', 'label' => 'Calc', 'usePrice' => false ),
				array( 'type' => 'payment_summary', 'key' => 'sum', 'showTax' => true, 'taxRate' => 10 ),
			),
		);
	}

	public function test_items_subtotal_tax_and_total(): void {
		$q = Pricing::quote( $this->schema(), array( 'ticket' => '2', 'extras' => array( 'lunch', 'video' ), 'calc' => '999' ) );
		$this->assertCount( 4, $q['items'] );
		$this->assertSame( 67.5, $q['subtotal'] );
		$this->assertSame( 6.75, $q['tax'] );
		$this->assertSame( 74.25, $q['total'] );
	}

	public function test_quantity_is_clamped_and_prices_come_from_schema(): void {
		$q = Pricing::quote( $this->schema(), array( 'ticket' => '50', 'price' => '0.01' ) );
		$this->assertSame( 5, $q['items'][0]['qty'] );
		$this->assertSame( 100.0, $q['items'][0]['amount'] );
	}

	public function test_coupon_discount_applies_before_tax(): void {
		$coupon = array( 'code' => 'TEN', 'type' => 'percent', 'amount' => 10.0 );
		$q      = Pricing::quote( $this->schema(), array( 'ticket' => '1' ), $coupon );
		// subtotal 22.5, discount 2.25, tax 10% of 20.25 = 2.03 (rounded), total 22.28
		$this->assertSame( 2.25, $q['discount'] );
		$this->assertSame( 22.28, $q['total'] );
	}

	public function test_fixed_coupon_never_exceeds_subtotal(): void {
		$this->assertSame( 5.0, CouponsRepository::discountFor( array( 'type' => 'fixed', 'amount' => 50 ), 5.0 ) );
	}

	public function test_minor_units(): void {
		$this->assertSame( 1999, Pricing::toMinor( 19.99, 'usd' ) );
		$this->assertSame( 500, Pricing::toMinor( 500, 'JPY' ) );
	}

	public function test_charged_formula_failure_is_not_a_silent_line(): void {
		$schema = array(
			'fields' => array(
				array(
					'type'     => 'calculation',
					'key'      => 'due',
					'label'    => 'Due',
					'usePrice' => true,
					'formula'  => '1/0',
				),
			),
		);
		$q = Pricing::quote( $schema, array( 'due' => 0 ) );
		$this->assertTrue( $q['formula_error'] );
		$this->assertSame( array(), $q['items'] );
		$this->assertNull( Formula::evaluate( '1/0', array() ) );
	}

	public function test_charged_missing_reference_is_not_a_silent_line(): void {
		$schema = array(
			'fields' => array(
				array(
					'type'     => 'calculation',
					'key'      => 'due',
					'label'    => 'Due',
					'usePrice' => true,
					'formula'  => '{qty} / {price}',
				),
			),
		);
		$q = Pricing::quote( $schema, array( 'qty' => 1, 'due' => 25 ) );
		$this->assertTrue( $q['formula_error'] );
		$this->assertSame( array(), $q['items'] );
	}

	public function test_charged_explicit_zero_is_not_a_failure(): void {
		$schema = array(
			'fields' => array(
				array(
					'type'     => 'calculation',
					'key'      => 'due',
					'label'    => 'Due',
					'usePrice' => true,
					'formula'  => '0+0',
				),
			),
		);
		$q = Pricing::quote( $schema, array( 'due' => 40 ) );
		$this->assertFalse( $q['formula_error'] );
		$this->assertSame( array(), $q['items'] );
		$this->assertSame( 0.0, $q['total'] );
	}
}
