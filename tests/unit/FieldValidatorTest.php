<?php

// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * FieldValidator unit tests, consent/checkbox required validation.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;

/**
 * @covers \SubtleForms\Engine\FieldValidator
 */
final class FieldValidatorTest extends TestCase {

	private function validate( array $schema, array $payload ): array {
		$validator = new FieldValidator();
		return $validator->validate( $schema, $payload, array(
			'hidden_fields'   => array(),
			'required_fields' => array(),
		) );
	}

	public function test_required_consent_unchecked_is_invalid() {
		$schema = array(
			'fields' => array(
				array(
					'key'      => 'consent',
					'type'     => 'consent',
					'required' => true,
					'config'   => array( 'checkboxLabel' => 'I agree.' ),
				),
			),
		);

		// Unchecked (false), must be rejected even though the generic
		// isEmpty() does not treat false as missing.
		$result = $this->validate( $schema, array( 'consent' => false ) );
		$this->assertFalse( $result['valid'] );
		$this->assertArrayHasKey( 'consent', $result['errors'] );

		// Checked (true), valid.
		$result = $this->validate( $schema, array( 'consent' => true ) );
		$this->assertTrue( $result['valid'] );
	}

	public function test_required_checkbox_unchecked_is_invalid() {
		$schema = array(
			'fields' => array(
				array(
					'key'      => 'agree',
					'type'     => 'checkbox',
					'required' => true,
				),
			),
		);

		$unchecked = $this->validate( $schema, array( 'agree' => false ) );
		$this->assertFalse( $unchecked['valid'] );

		$checked = $this->validate( $schema, array( 'agree' => true ) );
		$this->assertTrue( $checked['valid'] );
	}

	public function test_optional_consent_unchecked_is_valid() {
		$schema = array(
			'fields' => array(
				array(
					'key'  => 'marketing',
					'type' => 'consent',
					'required' => false,
				),
			),
		);

		$result = $this->validate( $schema, array( 'marketing' => false ) );
		$this->assertTrue( $result['valid'] );
	}

	/**
	 * @param array $field Field node.
	 * @return array
	 */
	private function schemaFor( array $field ): array {
		return array(
			'fields' => array( $field ),
		);
	}

	public function test_date_min_and_max_reject_one_day_outside() {
		$schema = $this->schemaFor(
			array(
				'key'    => 'when',
				'type'   => 'date',
				'config' => array(
					'minDate' => '2024-06-01',
					'maxDate' => '2024-06-30',
				),
			)
		);

		$this->assertTrue( $this->validate( $schema, array( 'when' => '2024-06-01' ) )['valid'] );
		$this->assertTrue( $this->validate( $schema, array( 'when' => '2024-06-30' ) )['valid'] );

		$before = $this->validate( $schema, array( 'when' => '2024-05-31' ) );
		$this->assertFalse( $before['valid'] );
		$this->assertSame( 'Date must be on or after 2024-06-01.', $before['errors']['when'] );

		$after = $this->validate( $schema, array( 'when' => '2024-07-01' ) );
		$this->assertFalse( $after['valid'] );
		$this->assertSame( 'Date must be on or before 2024-06-30.', $after['errors']['when'] );
	}

	public function test_number_rejects_off_step_value() {
		$schema = $this->schemaFor(
			array(
				'key'    => 'qty',
				'type'   => 'number',
				'config' => array(
					'min'  => 0,
					'max'  => 10,
					'step' => 2,
				),
			)
		);

		$off = $this->validate( $schema, array( 'qty' => 3 ) );
		$this->assertFalse( $off['valid'] );
		$this->assertSame( 'Must match the step of 2.', $off['errors']['qty'] );

		$this->assertTrue( $this->validate( $schema, array( 'qty' => 4 ) )['valid'] );
		$this->assertTrue( $this->validate( $schema, array( 'qty' => 0 ) )['valid'] );
	}

	public function test_international_phone_rejects_letters() {
		$schema = $this->schemaFor(
			array(
				'key'    => 'phone',
				'type'   => 'phone',
				'config' => array( 'format' => 'international' ),
			)
		);

		$letters = $this->validate( $schema, array( 'phone' => '555-CALL' ) );
		$this->assertFalse( $letters['valid'] );
		$this->assertSame( 'Invalid phone number.', $letters['errors']['phone'] );

		$this->assertTrue( $this->validate( $schema, array( 'phone' => '+1 (555) 123-4567' ) )['valid'] );
	}

	public function test_required_slider_zero_is_valid() {
		$schema = $this->schemaFor(
			array(
				'key'      => 'volume',
				'type'     => 'range_slider',
				'required' => true,
				'config'   => array(
					'min' => 0,
					'max' => 100,
				),
			)
		);

		$this->assertTrue( $this->validate( $schema, array( 'volume' => 0 ) )['valid'] );
	}

	public function test_required_matrix_needs_every_row() {
		$schema = $this->schemaFor(
			array(
				'key'      => 'grid',
				'type'     => 'checkbox_grid',
				'required' => true,
				'config'   => array(
					'rows'    => array( 'Color', 'Size' ),
					'columns' => array( 'Red', 'Blue' ),
				),
			)
		);

		$partial = $this->validate( $schema, array( 'grid' => array( 'Color' => 'Red' ) ) );
		$this->assertFalse( $partial['valid'] );
		$this->assertSame( 'Please answer the "Size" row.', $partial['errors']['grid'] );

		$one_cell = $this->validate(
			$schema,
			array(
				'grid' => array(
					'Color' => array( 'Red' => true ),
				),
			)
		);
		$this->assertFalse( $one_cell['valid'] );
		$this->assertSame( 'Please answer the "Size" row.', $one_cell['errors']['grid'] );

		$this->assertTrue(
			$this->validate(
				$schema,
				array(
					'grid' => array(
						'Color' => 'Red',
						'Size'  => 'Blue',
					),
				)
			)['valid']
		);

		$this->assertTrue(
			$this->validate(
				$schema,
				array(
					'grid' => array(
						'Color' => array( 'Red' => true ),
						'Size'  => array( 'Blue' => true ),
					),
				)
			)['valid']
		);
	}

}
