<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Autofill setting (2.10.0): the declaration, the allow-list and the save contract.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\FieldSettings;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\Schemas;

final class AutocompleteTest extends TestCase {

	public function test_the_autofill_select_is_declared_on_five_types_in_the_advanced_section(): void {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		FieldSettings::decorateAll( $registry );
		foreach ( array( 'text', 'email', 'url', 'phone', 'textarea' ) as $type ) {
			$controls = array_column( $registry->get( $type )->inspectorControls, null, 'name' );
			$this->assertArrayHasKey( 'autocomplete', $controls, $type );
			$this->assertSame( 'select', $controls['autocomplete']['type'], $type );
			$this->assertSame( 'advanced', $controls['autocomplete']['section'], $type );
			$this->assertSame( 'Autofill', $controls['autocomplete']['label'] );
			$this->assertSame(
				'Tells browsers and password managers what this field asks for, so they can fill it in.',
				$controls['autocomplete']['help']
			);
			$this->assertSame(
				array( '', 'off', 'name', 'given-name', 'family-name', 'email', 'tel', 'organization', 'organization-title', 'street-address', 'address-line1', 'address-line2', 'address-level2', 'address-level1', 'postal-code', 'country-name', 'url', 'bday' ),
				array_column( $controls['autocomplete']['options'], 'value' ),
				$type
			);
		}
		$text = array_column( $registry->get( 'text' )->inspectorControls, null, 'name' );
		$labels = array_column( $text['autocomplete']['options'], 'label' );
		$this->assertSame( 'Automatic', $labels[0] );
		$this->assertSame( 'Off', $labels[1] );
		$this->assertSame( 'State or region', $labels[13] );
		$this->assertSame( 'Birthday', $labels[17] );
		$number = array_column( $registry->get( 'number' )->inspectorControls, null, 'name' );
		$this->assertArrayNotHasKey( 'autocomplete', $number );
	}

	public function test_an_allowed_value_is_stored(): void {
		foreach ( array_keys( CoreFields::autocompleteTokens() ) as $token ) {
			$this->assertSame( $token, CoreFields::sanitizeAutocomplete( array( 'autocomplete' => $token ) )['autocomplete'] );
		}
	}

	public function test_a_value_outside_the_list_is_dropped_on_save(): void {
		foreach ( array( 'nickname', 'Name', 'on', 'cc-number', 'name ', array( 'name' ), 5, null ) as $bad ) {
			$this->assertArrayNotHasKey( 'autocomplete', CoreFields::sanitizeAutocomplete( array( 'autocomplete' => $bad, 'key' => 'k' ) ) );
		}
		$this->assertSame( 'k', CoreFields::sanitizeAutocomplete( array( 'autocomplete' => 'x', 'key' => 'k' ) )['key'] );
		$this->assertSame( array( 'key' => 'k' ), CoreFields::sanitizeAutocomplete( array( 'key' => 'k' ) ) );
	}

	public function test_the_schema_save_passes_the_setting_through_the_validator(): void {
		$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
		$out       = $validator->validateOrFail(
			array( 'activate' => true, 'schema' => array( 'fields' => array( array( 'type' => 'text', 'key' => 'name', 'autocomplete' => 'name' ) ) ) ),
			Schemas::get( Schemas::FORM_SCHEMA_SAVE )
		);
		$this->assertSame( 'name', $out['schema']['fields'][0]['autocomplete'] );
	}
}
