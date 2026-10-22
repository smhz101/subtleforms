<?php
/**
 * Shared helpers for the importer unit tests.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\SchemaValidator;
use SubtleForms\Tools\Import\ImportNotes;

/**
 * Fixture loading, field lookup and a validator that knows every type the
 * importers write.
 */
abstract class ImportTestCase extends TestCase {

	/** Site facts the mappers write into headers. */
	protected const CONTEXT = array(
		'site_title'  => 'Demo Site',
		'site_url'    => 'https://demo.test/',
		'admin_email' => 'admin@demo.test',
	);

	/**
	 * @param string $name File in tests/fixtures/import.
	 * @return array
	 */
	protected static function fixture( string $name ): array {
		$path = dirname( __DIR__ ) . '/fixtures/import/' . $name;
		$data = json_decode( (string) file_get_contents( $path ), true );
		self::assertIsArray( $data, $name . ' is valid JSON' );
		return $data;
	}

	/**
	 * Every field, steps opened, keyed by field key.
	 *
	 * @param array $fields Fields.
	 * @return array<string, array>
	 */
	protected static function byKey( array $fields ): array {
		$out = array();
		foreach ( $fields as $field ) {
			$out[ $field['key'] ] = $field;
			if ( isset( $field['children'] ) ) {
				$out += self::byKey( $field['children'] );
			}
		}
		return $out;
	}

	/**
	 * @param ImportNotes $notes Report.
	 * @return string All lines in one string.
	 */
	protected static function report( ImportNotes $notes ): string {
		return implode( "\n", $notes->strings() );
	}

	/**
	 * Validate like a save does, with the types the plugin registers.
	 *
	 * @param array $schema Schema.
	 */
	protected static function assertSavable( array $schema ): void {
		( new SchemaValidator( array( 'text', 'email', 'textarea', 'number', 'phone', 'url', 'password', 'checkbox', 'consent', 'radio', 'multiple_choice', 'dropdown', 'date', 'time', 'file_upload', 'image_upload', 'hidden', 'html', 'section_break', 'step', 'name_group', 'address_group', 'country', 'range_slider' ) ) )->validate( $schema );
		self::assertTrue( true );
	}
}
