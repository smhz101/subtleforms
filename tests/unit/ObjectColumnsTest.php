<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Review follow-ups on PR #33: columns stored as objects ({fields} or
 * {children}) are priced and mapped like plain lists, and prefixed card ids
 * are recognised as raw card inputs.
 *
 * @package SubtleForms\Tests
 */

use SubtleForms\Payments\Pricing;
use SubtleForms\Support\FieldMapper;
use SubtleForms\Templates\FormTemplates;

class ObjectColumnsTest extends PHPUnit\Framework\TestCase {

	private function schema( string $shape ): array {
		$product = array( 'id' => 'p', 'key' => 'ticket', 'type' => 'payment_product', 'label' => 'Ticket', 'price' => 10 );
		return array(
			'fields' => array(
				array(
					'id'      => 'cols',
					'key'     => 'cols',
					'type'    => 'columns',
					'columns' => array( array( $shape => array( $product ) ), array( $shape => array() ) ),
				),
			),
		);
	}

	public function test_pricing_reads_products_in_object_columns(): void {
		foreach ( array( 'fields', 'children' ) as $shape ) {
			$keys = array_column( Pricing::fields( $this->schema( $shape ) ), 'key' );
			$this->assertContains( 'ticket', $keys, $shape );
		}
	}

	public function test_field_mapper_reads_object_columns(): void {
		foreach ( array( 'fields', 'children' ) as $shape ) {
			$keys = array_column( FieldMapper::fields( $this->schema( $shape ) ), 'key' );
			$this->assertContains( 'ticket', $keys, $shape );
		}
	}

	public function test_prefixed_card_ids_are_raw_card_inputs(): void {
		foreach ( array( 'card_cvc', 'card_expiry', 'credit_card_cvv', 'cc_cvv', 'card-number', 'CVV' ) as $id ) {
			$this->assertSame( 1, preg_match( FormTemplates::CARD_INPUT_ID, strtolower( $id ) ), $id );
		}
		foreach ( array( 'gift_card_message', 'scorecard', 'card_payment', 'discard_reason' ) as $id ) {
			$this->assertSame( 0, preg_match( FormTemplates::CARD_INPUT_ID, $id ), $id );
		}
	}
}
