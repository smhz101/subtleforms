<?php

// phpcs:disable -- Unit test file; not shipped in production plugin.
namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\SchemaValidator;

/**
 * Field IDs (2.4.1): custom IDs follow the builder's rules, reserved names
 * are refused, and a field inside a step or column cannot reuse an ID.
 *
 * @covers \SubtleForms\Support\SchemaValidator
 */
final class FieldKeys241Test extends TestCase {

	private function validator(): SchemaValidator {
		return new SchemaValidator( array( 'text', 'email', 'step', 'two_column_container', 'repeat_container' ) );
	}

	private function schema( array $fields ): array {
		return array(
			'metadata'       => array( 'name' => 'keys', 'title' => 'Keys' ),
			'schema_version' => 1,
			'fields'         => $fields,
		);
	}

	private function errors( array $fields ): array {
		return array_column( $this->validator()->validateWithErrors( $this->schema( $fields ) ), 'message' );
	}

	public function test_custom_ids_with_hyphens_are_accepted(): void {
		$fields = array(
			array( 'type' => 'text', 'key' => 'crm-id', 'label' => 'CRM ID' ),
			array( 'type' => 'step', 'key' => 'step_1', 'children' => array( array( 'type' => 'email', 'key' => 'customer_email', 'label' => 'Email' ) ) ),
		);
		$this->assertTrue( $this->validator()->validate( $this->schema( $fields ) ) );
		$this->assertSame( array(), $this->errors( $fields ) );
	}

	public function test_an_id_longer_than_64_characters_is_refused(): void {
		$this->expectException( \InvalidArgumentException::class );
		$this->validator()->validate( $this->schema( array( array( 'type' => 'text', 'key' => str_repeat( 'a', 65 ), 'label' => 'Long' ) ) ) );
	}

	public function test_reserved_ids_are_refused_at_any_depth(): void {
		$this->assertNotEmpty( $this->errors( array( array( 'type' => 'text', 'key' => 'form_rendered_at', 'label' => 'Trap' ) ) ) );
		$nested = $this->errors(
			array(
				array( 'type' => 'step', 'key' => 'step_1', 'children' => array( array( 'type' => 'text', 'key' => 'website_url', 'label' => 'Site' ) ) ),
			)
		);
		$this->assertCount( 1, $nested );
		$this->assertStringContainsString( 'website_url', $nested[0] );
	}

	public function test_a_field_in_a_step_or_column_cannot_reuse_an_id(): void {
		$messages = $this->errors(
			array(
				array( 'type' => 'email', 'key' => 'email', 'label' => 'Email' ),
				array( 'type' => 'step', 'key' => 'step_1', 'children' => array( array( 'type' => 'email', 'key' => 'email', 'label' => 'Email again' ) ) ),
			)
		);
		$this->assertCount( 1, $messages );
		$this->assertStringContainsString( 'Two fields use the ID email', $messages[0] );

		$this->expectException( \InvalidArgumentException::class );
		$this->validator()->validate(
			$this->schema(
				array(
					array(
						'type'    => 'two_column_container',
						'key'     => 'cols',
						'columns' => array(
							array( 'fields' => array( array( 'type' => 'text', 'key' => 'city', 'label' => 'City' ) ) ),
							array( 'fields' => array( array( 'type' => 'text', 'key' => 'city', 'label' => 'Town' ) ) ),
						),
					),
				)
			)
		);
	}

	public function test_repeater_fields_only_clash_with_each_other(): void {
		$fields = array(
			array( 'type' => 'text', 'key' => 'city', 'label' => 'City' ),
			array( 'type' => 'repeat_container', 'key' => 'offices', 'label' => 'Offices', 'children' => array( array( 'type' => 'text', 'key' => 'city', 'label' => 'City' ) ) ),
		);
		$this->assertSame( array(), $this->errors( $fields ) );
	}

	public function test_a_duplicate_in_the_top_list_is_reported_once(): void {
		$messages = $this->errors(
			array(
				array( 'type' => 'text', 'key' => 'a', 'label' => 'A' ),
				array( 'type' => 'text', 'key' => 'a', 'label' => 'A again' ),
			)
		);
		$this->assertCount( 1, $messages );
	}

	public function test_each_repeater_checks_its_own_fields(): void {
		$repeater = static fn( array $children ) => array( 'type' => 'repeat_container', 'key' => 'offices', 'label' => 'Offices', 'children' => $children );

		$duplicate = $this->errors( array( $repeater( array( array( 'type' => 'text', 'key' => 'city', 'label' => 'City' ), array( 'type' => 'text', 'key' => 'city', 'label' => 'Town' ) ) ) ) );
		$this->assertCount( 1, $duplicate );
		$this->assertStringContainsString( 'repeater offices use the ID city', $duplicate[0] );

		$reserved = $this->errors( array( $repeater( array( array( 'type' => 'text', 'key' => 'website_url', 'label' => 'Site' ) ) ) ) );
		$this->assertCount( 1, $reserved );
		$this->assertStringContainsString( 'website_url', $reserved[0] );

		$invalid = $this->errors( array( $repeater( array( array( 'type' => 'text', 'key' => 'bad key!', 'label' => 'Bad' ) ) ) ) );
		$this->assertCount( 1, $invalid );

		// Two Repeaters, inside a step, may use the same IDs as each other.
		$this->assertSame(
			array(),
			$this->errors(
				array(
					array(
						'type'     => 'step',
						'key'      => 'step_1',
						'children' => array(
							$repeater( array( array( 'type' => 'text', 'key' => 'city', 'label' => 'City' ) ) ),
							array( 'type' => 'repeat_container', 'key' => 'homes', 'label' => 'Homes', 'children' => array( array( 'type' => 'text', 'key' => 'city', 'label' => 'City' ) ) ),
						),
					),
				)
			)
		);
	}
}
