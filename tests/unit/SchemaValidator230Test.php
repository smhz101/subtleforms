<?php

// phpcs:disable -- Unit test file; not shipped in production plugin.
namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\SchemaValidator;

/**
 * 2.3.0: any field that takes an answer makes a form publishable.
 *
 * @covers \SubtleForms\Support\SchemaValidator
 */
final class SchemaValidator230Test extends TestCase {

	private function publishErrors( array $fields ): array {
		$validator = new SchemaValidator( array( 'signature', 'rich_text', 'html', 'two_column_container', 'toggle' ) );
		return $validator->validateForPublishingWithErrors(
			array(
				'schema_version' => 1,
				'metadata'       => array( 'name' => 'x', 'title' => 'X' ),
				'fields'         => $fields,
			)
		);
	}

	public function test_signature_only_form_can_be_published() {
		$this->assertSame( array(), $this->publishErrors( array( array( 'key' => 'sig', 'type' => 'signature' ) ) ) );
		$this->assertSame( array(), $this->publishErrors( array( array( 'key' => 'bio', 'type' => 'rich_text' ) ) ) );
	}

	public function test_fields_inside_columns_count() {
		$errors = $this->publishErrors(
			array(
				array(
					'key'     => 'cols',
					'type'    => 'two_column_container',
					'columns' => array( array( array( 'key' => 't', 'type' => 'toggle' ) ), array() ),
				),
			)
		);
		$this->assertSame( array(), $errors );
	}

	public function test_layout_only_form_cannot_be_published() {
		$errors = $this->publishErrors( array( array( 'key' => 'intro', 'type' => 'html' ) ) );
		$this->assertCount( 1, $errors );
		$this->assertTrue( SchemaValidator::takesAnswer( 'signature' ) );
		$this->assertFalse( SchemaValidator::takesAnswer( 'section_break' ) );
		$this->assertFalse( SchemaValidator::takesAnswer( 'three_column_container' ) );
	}
}
