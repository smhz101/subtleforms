<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * FieldValidator unit tests — consent/checkbox required validation.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

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

		// Unchecked (false) — must be rejected even though the generic
		// isEmpty() does not treat false as missing.
		$result = $this->validate( $schema, array( 'consent' => false ) );
		$this->assertFalse( $result['valid'] );
		$this->assertArrayHasKey( 'consent', $result['errors'] );

		// Checked (true) — valid.
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
}
