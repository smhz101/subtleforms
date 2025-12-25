<?php
/**
 * Class FieldValidatorTest
 *
 * @package SubtleForms
 */

use SubtleForms\Engine\FieldValidator;

/**
 * Test cases for FieldValidator.
 */
class FieldValidatorTest extends WP_UnitTestCase {

	/**
	 * @var FieldValidator
	 */
	protected $validator;

	/**
	 * Set up the test fixture.
	 */
	public function setUp(): void {
		parent::setUp();
		$this->validator = new FieldValidator();
	}

	/**
	 * Test required fields validation.
	 */
	public function test_required_fields() {
		$schema = [
			'fields' => [
				[ 'key' => 'name', 'type' => 'text', 'config' => [ 'required' => true ] ],
				[ 'key' => 'email', 'type' => 'email', 'config' => [ 'required' => true ] ],
			],
		];

		$payload = [
			'name' => 'John Doe',
		];

		$conditionalState = [
			'hidden_fields' => [],
			'required_fields' => [],
		];

		$result = $this->validator->validate( $schema, $payload, $conditionalState );

		$this->assertFalse( $result['valid'] );
		$this->assertArrayHasKey( 'email', $result['errors'] );
		$this->assertArrayNotHasKey( 'name', $result['errors'] );
	}

	/**
	 * Test hidden fields are not required.
	 */
	public function test_hidden_fields_not_required() {
		$schema = [
			'fields' => [
				[ 'key' => 'name', 'type' => 'text', 'config' => [ 'required' => true ] ],
				[ 'key' => 'reason', 'type' => 'text', 'config' => [ 'required' => true ] ],
			],
		];

		$payload = [
			'name' => 'John Doe',
		];

		$conditionalState = [
			'hidden_fields' => [ 'reason' ],
			'required_fields' => [],
		];

		$result = $this->validator->validate( $schema, $payload, $conditionalState );

		$this->assertTrue( $result['valid'] );
		$this->assertEmpty( $result['errors'] );
	}

	/**
	 * Test conditionally required fields.
	 */
	public function test_conditionally_required_fields() {
		$schema = [
			'fields' => [
				[ 'key' => 'other_reason', 'type' => 'text' ], // Not required by default
			],
		];

		$payload = [];

		$conditionalState = [
			'hidden_fields' => [],
			'required_fields' => [ 'other_reason' ],
		];

		$result = $this->validator->validate( $schema, $payload, $conditionalState );

		$this->assertFalse( $result['valid'] );
		$this->assertArrayHasKey( 'other_reason', $result['errors'] );
	}
}
