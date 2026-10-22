<?php
/**
 * Pricing decides which priced fields count from conditional logic, never
 * from which keys were sent (PAY-01, PAY-02).
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Payments\Pricing;

final class PricingVisibilityTest extends TestCase {

	private static function showWhen( string $field, string $value ): array {
		return array(
			'action' => 'show',
			'groups' => array(
				array(
					'match' => 'all',
					'rules' => array(
						array( 'field' => $field, 'operator' => 'equals', 'value' => $value ),
					),
				),
			),
		);
	}

	public function test_pay01_fixed_product_is_charged_when_its_key_is_left_out(): void {
		$schema = array(
			'fields' => array(
				array( 'type' => 'payment_product', 'key' => 'entry_fee', 'label' => 'Entry fee', 'price' => 5, 'allowQuantity' => false ),
				array( 'type' => 'payment_amount', 'key' => 'donation', 'label' => 'Donation' ),
			),
		);
		$q = Pricing::quote( $schema, array( 'donation' => '100' ) );
		$this->assertSame( 105.0, $q['total'] );
		$this->assertSame( 'entry_fee', $q['items'][0]['key'] );
	}

	public function test_pay01_fixed_product_hidden_by_logic_is_not_charged_even_when_sent(): void {
		$product          = array( 'type' => 'payment_product', 'key' => 'entry_fee', 'label' => 'Entry fee', 'price' => 5 );
		$product['logic'] = self::showWhen( 'want', 'yes' );
		$schema           = array(
			'fields' => array(
				array( 'type' => 'radio', 'key' => 'want' ),
				$product,
			),
		);
		$this->assertSame( 0.0, Pricing::quote( $schema, array( 'want' => 'no', 'entry_fee' => '1' ) )['total'] );
		$this->assertSame( 5.0, Pricing::quote( $schema, array( 'want' => 'yes' ) )['total'] );
	}

	public function test_pay02_hidden_fixed_fee_is_not_charged_or_listed(): void {
		$fee = array(
			'type'   => 'payment_hidden_price',
			'key'    => 'parking',
			'label'  => 'Fixed Fee',
			'config' => array(
				'amount'      => 3,
				'description' => 'Parking service fee',
				'logic'       => self::showWhen( 'want', 'yes' ),
			),
		);
		$schema = array(
			'fields' => array(
				array( 'type' => 'select', 'key' => 'want' ),
				array( 'type' => 'payment_product', 'key' => 'ticket', 'label' => 'Ticket', 'price' => 20 ),
				$fee,
			),
		);
		$no = Pricing::quote( $schema, array( 'want' => 'no' ) );
		$this->assertSame( 20.0, $no['total'] );
		$this->assertSame( array( 'ticket' ), array_column( $no['items'], 'key' ) );

		$yes = Pricing::quote( $schema, array( 'want' => 'yes' ) );
		$this->assertSame( 23.0, $yes['total'] );
		$this->assertSame( 'Parking service fee', $yes['items'][1]['label'] );
	}

	/**
	 * A rule on a step is advanced logic (SubtleForms Pro). Without it the rule
	 * is ignored, the step is shown, and what is shown is what is charged.
	 */
	public function test_pay02_a_step_rule_is_ignored_without_an_add_on_so_its_fields_count(): void {
		$schema = array(
			'fields' => array(
				array(
					'type'     => 'step',
					'id'       => 'step_1',
					'children' => array(
						array( 'type' => 'select', 'key' => 'want' ),
						array( 'type' => 'payment_product', 'key' => 'ticket', 'label' => 'Ticket', 'price' => 20 ),
					),
				),
				array(
					'type'     => 'step',
					'id'       => 'step_2',
					'logic'    => self::showWhen( 'want', 'yes' ),
					'children' => array(
						array( 'type' => 'payment_hidden_price', 'key' => 'fee', 'amount' => 3 ),
						array( 'type' => 'payment_product', 'label' => 'Keyless', 'price' => 7 ),
					),
				),
			),
		);
		$this->assertSame( 30.0, Pricing::quote( $schema, array( 'want' => 'no' ) )['total'] );
		$this->assertSame( 30.0, Pricing::quote( $schema, array( 'want' => 'yes' ) )['total'] );
	}
}
