<?php
/**
 * Field settings and form metadata survive a save (2.0).
 *
 * Before 2.0, FieldDefinition and FormMetadata were closed lists: anything the
 * builder wrote that was not listed (conditions, min/max, prefixes, formulas,
 * confirmation messages) passed validation and was then silently dropped from
 * the stored schema.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\Schemas;

/**
 * @covers \SubtleForms\Validation\RequestValidator
 */
final class FormSchemaPassthroughTest extends TestCase {

	private function saved( array $schema ): array {
		$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
		$out       = $validator->validateOrFail(
			array(
				'activate' => true,
				'schema'   => $schema,
			),
			Schemas::get( Schemas::FORM_SCHEMA_SAVE )
		);
		return $out['schema'];
	}

	public function test_undeclared_field_settings_are_kept(): void {
		$schema = $this->saved(
			array(
				'fields' => array(
					array(
						'type'       => 'calculation',
						'key'        => 'total',
						'formula'    => '{qty} * {price}',
						'decimals'   => 2,
						'prefix'     => '$',
						'conditions' => array( array( 'field' => 'qty', 'operator' => 'gt', 'value' => '1' ) ),
					),
				),
			)
		);

		$field = $schema['fields'][0];
		$this->assertSame( '{qty} * {price}', $field['formula'] );
		$this->assertSame( 2, $field['decimals'] );
		$this->assertSame( '$', $field['prefix'] );
		$this->assertSame( 'qty', $field['conditions'][0]['field'] );
	}

	public function test_form_metadata_keeps_confirmation_and_restrictions(): void {
		$schema = $this->saved(
			array(
				'fields'   => array(),
				'metadata' => array(
					'title'        => 'Order',
					'submitText'   => 'Place order',
					'confirmation' => array(
						'type'    => 'message',
						'message' => 'Thanks {name}',
					),
					'restrictions' => array(
						'requireLogin' => true,
						'entryLimit'   => 50,
					),
					'_theme'       => 'soft',
				),
			)
		);

		$this->assertSame( 'Place order', $schema['metadata']['submitText'] );
		$this->assertSame( 'Thanks {name}', $schema['metadata']['confirmation']['message'] );
		$this->assertTrue( $schema['metadata']['restrictions']['requireLogin'] );
		$this->assertSame( 50, $schema['metadata']['restrictions']['entryLimit'] );
		$this->assertSame( 'soft', $schema['metadata']['_theme'] );
	}

	public function test_kept_strings_are_sanitised(): void {
		$schema = $this->saved(
			array(
				'fields' => array(
					array(
						'type'  => 'text',
						'key'   => 'x',
						'notes' => '<b>ok</b><script>alert(1)</script>',
					),
				),
			)
		);

		$this->assertStringNotContainsString( '<script', $schema['fields'][0]['notes'] );
	}

	public function test_unsafe_keys_are_ignored(): void {
		$schema = $this->saved(
			array(
				'fields' => array(
					array(
						'type'       => 'text',
						'key'        => 'x',
						'bad key!'   => 'nope',
						'__internal' => 'nope',
					),
				),
			)
		);

		$this->assertArrayNotHasKey( 'bad key!', $schema['fields'][0] );
		$this->assertArrayNotHasKey( '__internal', $schema['fields'][0] );
	}
}
