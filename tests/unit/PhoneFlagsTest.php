<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 2.7.2 country flags: the "Show country flags" setting of the Phone and
 * Country fields, how it is stored and validated, and the `flags` feature the
 * form container lists only when a field turned it on.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Frontend\FrontendAssets;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\Schemas;

final class PhoneFlagsTest extends TestCase {

	private function groups( array $fields ): array {
		return FrontendAssets::fieldGroups( array( 'metadata' => array( 'type' => 'regular' ), 'fields' => $fields ) );
	}

	private function saved( array $field ): array {
		$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
		$out       = $validator->validateOrFail(
			array(
				'activate' => true,
				'schema'   => array( 'fields' => array( $field ) ),
			),
			Schemas::get( Schemas::FORM_SCHEMA_SAVE )
		);
		return $out['schema']['fields'][0];
	}

	public function test_flags_are_off_by_default_for_phone_and_country(): void {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		foreach ( array( 'phone', 'country' ) as $type ) {
			$def = $registry->get( $type );
			$this->assertArrayHasKey( 'showFlags', $def->fieldSpecificAttributes, $type );
			$this->assertFalse( $def->fieldSpecificAttributes['showFlags'], $type );
			$controls = array_column( $def->inspectorControls, null, 'name' );
			$this->assertSame( 'checkbox', $controls['showFlags']['type'], $type );
			$this->assertSame( 'Show country flags', $controls['showFlags']['label'], $type );
			$this->assertStringContainsString( 'Loads a flag image only for forms that use it', $controls['showFlags']['help'], $type );
		}
	}

	public function test_setting_is_saved_and_validated_as_a_boolean(): void {
		$on = $this->saved( array( 'type' => 'phone', 'key' => 'p', 'enableCountryCode' => true, 'showFlags' => true ) );
		$this->assertTrue( $on['showFlags'] );
		$off = $this->saved( array( 'type' => 'country', 'key' => 'c', 'showFlags' => false ) );
		$this->assertFalse( $off['showFlags'] );

		// Whatever the browser sends is stored as a real boolean; junk is off.
		$this->assertTrue( $this->saved( array( 'type' => 'phone', 'key' => 'p', 'showFlags' => 'on' ) )['showFlags'] );
		$this->assertFalse( $this->saved( array( 'type' => 'phone', 'key' => 'p', 'showFlags' => 'no' ) )['showFlags'] );
		$this->assertFalse( $this->saved( array( 'type' => 'phone', 'key' => 'p', 'showFlags' => array( 'x' ) ) )['showFlags'] );
	}

	public function test_flags_feature_is_found_only_when_a_field_asks_for_it(): void {
		$this->assertSame( array(), $this->groups( array( array( 'type' => 'phone', 'key' => 'p' ) ) ) );
		$this->assertSame(
			array( 'geo' ),
			$this->groups( array( array( 'type' => 'phone', 'key' => 'p', 'enableCountryCode' => true ) ) )
		);
		$this->assertSame(
			array( 'geo' ),
			$this->groups( array( array( 'type' => 'phone', 'key' => 'p', 'enableCountryCode' => true, 'showFlags' => false ) ) )
		);
		$this->assertSame(
			array( 'flags', 'geo' ),
			$this->groups( array( array( 'type' => 'phone', 'key' => 'p', 'enableCountryCode' => true, 'showFlags' => true ) ) )
		);
		$this->assertSame(
			array( 'flags', 'geo' ),
			$this->groups( array( array( 'type' => 'tel', 'key' => 'p', 'config' => array( 'enableCountryCode' => true, 'showFlags' => true ) ) ) )
		);
		$this->assertSame(
			array( 'flags', 'geo' ),
			$this->groups( array( array( 'type' => 'country', 'key' => 'c', 'showFlags' => true ) ) )
		);
		$this->assertSame( array( 'geo' ), $this->groups( array( array( 'type' => 'country', 'key' => 'c' ) ) ) );
	}

	public function test_flags_alone_do_not_load_anything_without_a_picker(): void {
		// A phone field without the country picker has no list to put flags in.
		$this->assertSame( array(), $this->groups( array( array( 'type' => 'phone', 'key' => 'p', 'showFlags' => true ) ) ) );
		// Other field types ignore the setting.
		$this->assertSame( array(), $this->groups( array( array( 'type' => 'text', 'key' => 't', 'showFlags' => true ) ) ) );
		// Something that is not a true boolean does not switch it on.
		foreach ( array( 'no', 'false', '0', 0, null, array() ) as $value ) {
			$this->assertSame(
				array( 'geo' ),
				$this->groups( array( array( 'type' => 'country', 'key' => 'c', 'showFlags' => $value ) ) ),
				var_export( $value, true )
			);
		}
	}

	public function test_flags_are_found_in_nested_fields(): void {
		$fields = array(
			array(
				'type'     => 'step',
				'children' => array(
					array( 'type' => 'phone', 'key' => 'p', 'enableCountryCode' => true, 'showFlags' => true ),
				),
			),
		);
		$this->assertSame( array( 'flags', 'geo' ), $this->groups( $fields ) );
	}

	public function test_flags_group_has_a_chunk_and_a_browser_loader(): void {
		$chunks = ( new ReflectionClass( FrontendAssets::class ) )->getConstant( 'GROUP_CHUNKS' );
		$this->assertSame( 'feature-flags', $chunks['flags'] );
		$js = (string) file_get_contents( dirname( __DIR__, 2 ) . '/resources/frontend/components/fields/lazyFields.jsx' );
		$this->assertMatchesRegularExpression( '/flags: \(\) => import\(\/\* webpackChunkName: "feature-flags" \*\//', $js );
	}

	public function test_theme_forms_get_the_flag_layout_lines(): void {
		$css = FrontendAssets::layoutCss();
		$this->assertStringContainsString( '.subtleforms-flag{', $css );
		$this->assertStringContainsString( 'width:20px;height:15px;border-radius:2px', $css );
	}
}
