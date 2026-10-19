<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.4.0 (F240-1): the server checks each field type's value the way the
 * browser does. One bad and one good value per field type, sent straight to
 * the REST submit endpoint.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class FieldValueParity240Test extends TestCase {

	/**
	 * Field, bad value, good value, and the value stored for the good one
	 * when the server tidies it.
	 *
	 * @return array<string,array{0:array,1:mixed,2:mixed,3?:mixed}>
	 */
	public function cases(): array {
		$opts = static function ( array $values ): array {
			return array_map(
				static function ( $v ) {
					return array( 'label' => ucfirst( $v ), 'value' => $v );
				},
				$values
			);
		};
		return array(
			// FB-23: a text field takes text, not a list.
			'text single value'          => array( array( 'type' => 'text' ), array( 'a', 'b' ), 'hello' ),
			// FB-07: read-only keeps its default.
			'text read-only'             => array( array( 'type' => 'text', 'readOnly' => true, 'defaultValue' => 'fixed' ), 'hacked', 'fixed' ),
			'number read-only'           => array( array( 'type' => 'number', 'config' => array( 'readOnly' => true, 'defaultValue' => '750' ) ), 600, 750 ),
			// FB-14: same message as the browser.
			'number max'                 => array( array( 'type' => 'number', 'max' => 100 ), 101, 50, null, 'Must be no more than 100.' ),
			// FA-01: dates, times, ratings, NPS, slider, matrix, colour.
			'date format'                => array( array( 'type' => 'date', 'minDate' => '2026-01-01', 'maxDate' => '2026-12-31' ), 'not-a-date', '2026-06-01' ),
			'date impossible day'        => array( array( 'type' => 'date' ), '2026-02-30', '2026-02-28' ),
			'date read-only'             => array( array( 'type' => 'date', 'readOnly' => true, 'defaultValue' => '2026-05-05' ), '2026-05-06', '2026-05-05' ),
			'time'                       => array( array( 'type' => 'time' ), '99:99', '09:30' ),
			'datetime'                   => array( array( 'type' => 'datetime' ), 'garbage', '2026-10-20T09:30' ),
			'rating'                     => array( array( 'type' => 'rating', 'max' => 7 ), 99, 7 ),
			'nps'                        => array( array( 'type' => 'net_promoter_score' ), 15, 10 ),
			'slider below min'           => array( array( 'type' => 'range_slider', 'min' => 10, 'max' => 50, 'step' => 5 ), 7, 25 ),
			'slider off step'            => array( array( 'type' => 'range_slider', 'min' => 10, 'max' => 50, 'step' => 5 ), 12, 50 ),
			'matrix'                     => array(
				array(
					'type'           => 'checkbox_grid',
					'rows'           => array( 'Speed', 'Price' ),
					'columns'        => array( 'Good', 'Bad' ),
					'multiplePerRow' => false,
				),
				array( 'Speed' => 'Nope' ),
				array( 'Speed' => 'Good', 'Price' => 'Bad' ),
			),
			'matrix several per row'     => array(
				array( 'type' => 'checkbox_grid', 'rows' => array( 'Speed' ), 'columns' => array( 'Good', 'Bad' ) ),
				array( 'Speed' => array( 'Awful' => true ) ),
				array( 'Speed' => array( 'Good' => true, 'Bad' => false ) ),
			),
			'colour'                     => array( array( 'type' => 'color_picker' ), 'javascript:alert(1)', '#336699' ),
			// FB-11: answers must be one of the choices.
			'dropdown'                   => array( array( 'type' => 'dropdown', 'options' => $opts( array( 'a', 'b' ) ) ), 'zzz', 'b' ),
			'radio'                      => array( array( 'type' => 'radio', 'options' => $opts( array( 'red', 'green' ) ) ), 'purple', 'green' ),
			'checkboxes'                 => array( array( 'type' => 'multiple_choice', 'allowMultiple' => true, 'options' => $opts( array( 'o1', 'o2' ) ) ), array( 'bogus' ), array( 'o1', 'o2' ) ),
			'picture choice'             => array( array( 'type' => 'picture_choice', 'options' => $opts( array( 'pa', 'pb' ) ) ), array( 'zzz' ), 'pa' ),
			'country'                    => array( array( 'type' => 'country' ), 'Narnia', 'PK' ),
			'country by name'            => array( array( 'type' => 'country', 'output_format' => 'name' ), 'Narnia', 'Pakistan' ),
			'chained'                    => array(
				array(
					'type'    => 'chained_select',
					'options' => array(
						array(
							'label'    => 'Fruit',
							'value'    => 'fruit',
							'children' => array( array( 'label' => 'Apple', 'value' => 'apple' ) ),
						),
					),
				),
				array( 'x', 'y' ),
				array( 'fruit', 'apple' ),
			),
			'toggle'                     => array( array( 'type' => 'toggle' ), 'maybe', 'yes' ),
			'checkbox'                   => array( array( 'type' => 'checkbox' ), 'hello', true ),
			'consent'                    => array( array( 'type' => 'consent' ), 'yes', true ),
			// FB-05, FB-06, FB-15: email and website rules.
			'email several'              => array( array( 'type' => 'email', 'allowMultiple' => true ), 'a@example.com, nope', 'a@example.com; b@example.com', 'a@example.com, b@example.com' ),
			'email without rfc check'    => array( array( 'type' => 'email', 'rfcValidation' => false ), 'user@', 'user@localhost', 'user@localhost' ),
			'website scheme'             => array( array( 'type' => 'url' ), 'ftp://example.com', 'example.com', 'https://example.com' ),
			// FLD2-07: international phone numbers.
			'phone too short'            => array( array( 'type' => 'phone', 'enableCountryCode' => true ), '+1 5', '+1 415 555 0100', '+1 4155550100' ),
			'phone unknown code'         => array( array( 'type' => 'phone', 'enableCountryCode' => true ), '+999 123', '+44 07700 900123', '+44 7700900123' ),
			'phone code only, required'  => array( array( 'type' => 'phone', 'enableCountryCode' => true, 'required' => true ), '+1', '+92 300 1234567', '+92 3001234567' ),
			// FA-17: rich text with nothing in it is empty.
			'rich text required'         => array( array( 'type' => 'rich_text', 'required' => true ), '<p><br></p>', '<p>Hello</p>' ),
			// PAY-05, PAY-06, PAY-07, PAY-08: payment field limits.
			'custom amount max'          => array( array( 'type' => 'payment_amount', 'min' => 5, 'max' => 500 ), 600, 50, null, 'Payment amount cannot exceed 500.00.' ),
			'custom amount min'          => array( array( 'type' => 'payment_amount', 'min' => 5, 'max' => 500 ), 1, 5 ),
			'product quantity'           => array( array( 'type' => 'payment_product', 'price' => 10, 'allowQuantity' => true, 'maxQuantity' => 5 ), 99, '3' ),
			'priced options'             => array( array( 'type' => 'payment_choice', 'required' => true, 'options' => array( array( 'label' => 'Basic', 'value' => 'basic', 'price' => 19 ) ) ), 'bogus', 'basic' ),
			'priced options pick one'    => array(
				array(
					'type'      => 'payment_choice',
					'displayAs' => 'radio',
					'options'   => array(
						array( 'label' => 'Basic', 'value' => 'basic', 'price' => 19 ),
						array( 'label' => 'Premium', 'value' => 'premium', 'price' => 99 ),
					),
				),
				array( 'basic', 'premium' ),
				'premium',
			),
		);
	}

	/**
	 * @dataProvider cases
	 */
	public function test_bad_value_is_refused_and_good_value_is_stored( array $field, $bad, $good, $stored = null, ?string $message = null ) {
		$field = array_merge( array( 'id' => 'f1', 'key' => 'f1', 'label' => 'Field' ), $field );
		$form  = $this->publish( array( $field ) );

		$refused = $this->submit( $form, array( 'f1' => $bad ) );
		$this->assertSame( 422, $refused['status'], 'Bad value accepted: ' . wp_json_encode( $bad ) );
		$errors = $refused['data']['error']['meta']['fields'] ?? $refused['data']['meta']['fields'] ?? array();
		$this->assertArrayHasKey( 'f1', (array) $errors, wp_json_encode( $refused['data'] ) );
		if ( null !== $message ) {
			$this->assertSame( $message, $errors['f1'] );
		}

		$accepted = $this->submit( $form, array( 'f1' => $good ) );
		$this->assertSame( 200, $accepted['status'], 'Good value refused: ' . wp_json_encode( $accepted['data'] ) );
		$payload = $this->storedPayload( $form );
		$this->assertEquals( null === $stored ? $good : $stored, $payload['f1'] ?? null );
	}

	/** FLD2-16: a Hidden field's tokens are filled in by the server. */
	public function test_hidden_field_tokens_are_resolved_on_the_server() {
		$form = $this->publish(
			array(
				array( 'id' => 'name', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'id' => 'h1', 'key' => 'h1', 'type' => 'hidden', 'label' => 'Day', 'value' => 'Sent {date}' ),
				array( 'id' => 'h2', 'key' => 'h2', 'type' => 'hidden', 'label' => 'Source', 'value' => 'newsletter' ),
			)
		);
		$result = $this->submit( $form, array( 'name' => 'Ada', 'h2' => 'tampered' ) );
		$this->assertSame( 200, $result['status'] );
		$payload = $this->storedPayload( $form );
		$this->assertSame( 'Sent ' . wp_date( 'Y-m-d' ), $payload['h1'] ?? null );
		$this->assertSame( 'newsletter', $payload['h2'] ?? null );
	}

	/** PAY2-04: Order Summary and Fixed Fee take no answer. */
	public function test_display_only_payment_fields_store_nothing() {
		$form = $this->publish(
			array(
				array( 'id' => 'p', 'key' => 'p', 'type' => 'payment_choice', 'label' => 'Plan', 'options' => array( array( 'label' => 'Basic', 'value' => 'basic', 'price' => 19 ) ) ),
				array( 'id' => 'fee', 'key' => 'fee', 'type' => 'payment_hidden_price', 'label' => 'Processing fee', 'amount' => 2 ),
				array( 'id' => 'summary', 'key' => 'summary', 'type' => 'payment_summary', 'label' => 'Summary' ),
			)
		);
		$result = $this->submit( $form, array( 'p' => 'basic', 'fee' => 0, 'summary' => 0.01 ) );
		$this->assertSame( 200, $result['status'], wp_json_encode( $result['data'] ) );
		$payload = $this->storedPayload( $form );
		$this->assertSame( 'basic', $payload['p'] ?? null );
		$this->assertArrayNotHasKey( 'fee', $payload );
		$this->assertArrayNotHasKey( 'summary', $payload );
	}
}
