<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * 2.2.1 server-side rules that need no WordPress: schema validation of single
 * checkboxes, required checks for matrices and checkbox groups, and the
 * per-type entry value rules.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Support\EntryValues;
use SubtleForms\Support\SchemaValidator;

/**
 * @covers \SubtleForms\Support\SchemaValidator
 * @covers \SubtleForms\Engine\FieldValidator
 * @covers \SubtleForms\Support\EntryValues
 */
final class Release221Test extends TestCase {

	private function schema( array $fields ): array {
		return array(
			'schema_version' => 1,
			'metadata'       => array(
				'name'  => 'Test',
				'title' => 'Test',
			),
			'fields'         => $fields,
		);
	}

	private function validator(): SchemaValidator {
		return new SchemaValidator( array( 'text', 'checkbox', 'multiple_choice', 'checkbox_grid', 'two_column_container', 'step' ) );
	}

	public function test_single_checkbox_with_options_is_rejected() {
		$schema = $this->schema(
			array(
				array( 'key' => 'extras', 'type' => 'checkbox', 'label' => 'Extras', 'options' => array( array( 'label' => 'A', 'value' => 'a' ) ) ),
			)
		);
		$errors = $this->validator()->validateWithErrors( $schema );
		$this->assertCount( 1, $errors );
		$this->assertSame( 'extras', $errors[0]['fieldKey'] );
		$this->assertStringContainsString( 'Multiple choice', $errors[0]['message'] );

		$this->expectException( \InvalidArgumentException::class );
		$this->validator()->validate( $schema );
	}

	public function test_nested_single_checkbox_with_options_is_rejected() {
		$schema = $this->schema(
			array(
				array(
					'key'     => 'cols',
					'type'    => 'two_column_container',
					'columns' => array(
						array(),
						array( array( 'key' => 'inner', 'type' => 'checkbox', 'config' => array( 'options' => array( array( 'value' => 'x' ) ) ) ) ),
					),
				),
			)
		);
		$errors = SchemaValidator::checkboxOptionErrors( $schema['fields'], 'fields' );
		$this->assertCount( 1, $errors );
		$this->assertSame( 'fields[0].columns[1][0].options', $errors[0]['path'] );
	}

	public function test_single_checkbox_without_options_and_matrix_columns_are_fine() {
		$schema = $this->schema(
			array(
				array( 'key' => 'agree', 'type' => 'checkbox', 'label' => 'Agree' ),
				array( 'key' => 'grid', 'type' => 'checkbox_grid', 'rows' => array( 'R' ), 'columns' => array( 'C1', 'C2' ) ),
			)
		);
		$this->assertSame( array(), $this->validator()->validateWithErrors( $schema ) );
	}

	private function check( array $fields, array $payload ): array {
		return ( new FieldValidator() )->validate(
			array( 'fields' => $fields ),
			$payload,
			array(
				'hidden_fields'   => array(),
				'required_fields' => array(),
			)
		);
	}

	public function test_required_empty_matrix_is_not_required() {
		$result = $this->check( array( array( 'key' => 'grid', 'type' => 'checkbox_grid', 'required' => true, 'rows' => array(), 'columns' => array() ) ), array() );
		$this->assertTrue( $result['valid'] );
	}

	public function test_required_matrix_with_rows_is_required() {
		$result = $this->check( array( array( 'key' => 'grid', 'type' => 'checkbox_grid', 'required' => true, 'rows' => array( 'A' ), 'columns' => array( 'B' ) ) ), array() );
		$this->assertFalse( $result['valid'] );
	}

	public function test_required_legacy_checkbox_group_needs_one_choice() {
		$field = array( 'key' => 'extras', 'type' => 'checkbox', 'required' => true, 'options' => array( array( 'value' => 'a' ) ) );
		$this->assertFalse( $this->check( array( $field ), array( 'extras' => array() ) )['valid'] );
		$this->assertTrue( $this->check( array( $field ), array( 'extras' => array( 'a' ) ) )['valid'] );
	}

	public function test_required_survives_partial_config() {
		$field = array( 'key' => 'name', 'type' => 'text', 'required' => true, 'config' => array( 'appearance' => array( 'width' => '50' ) ) );
		$this->assertFalse( $this->check( array( $field ), array( 'name' => '' ) )['valid'] );
	}

	public function test_secret_types_and_labels() {
		$this->assertTrue( EntryValues::isSecret( array( 'type' => 'password' ) ) );
		$this->assertFalse( EntryValues::isSecret( array( 'type' => 'text' ) ) );
		$this->assertSame( 'Password provided', EntryValues::passwordLabel( true ) );
		$this->assertSame( 'Password provided (stored as a hash)', EntryValues::passwordLabel( '$wp$2y$10$abcdefghijklmnopqrstuv' ) );
		$this->assertSame( '', EntryValues::passwordLabel( '' ) );
	}

	public function test_password_is_never_kept_as_typed_by_default() {
		$this->assertTrue( EntryValues::passwordForStorage( 's3cret', array( 'type' => 'password' ) ) );
		$this->assertSame( '', EntryValues::passwordForStorage( '', array( 'type' => 'password' ) ) );
		$this->assertSame( '', EntryValues::passwordForStorage( array( 'x' ), array( 'type' => 'password' ) ) );
	}

	public function test_secret_keys_found_in_nested_schema() {
		$schema = array(
			'fields' => array(
				array( 'key' => 'name', 'type' => 'text' ),
				array(
					'key'      => 'step1',
					'type'     => 'step',
					'children' => array( array( 'key' => 'pw', 'type' => 'password' ) ),
				),
			),
		);
		$this->assertSame( array( 'pw' ), EntryValues::secretKeys( $schema ) );
	}
}
