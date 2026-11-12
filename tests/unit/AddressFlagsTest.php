<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 2.9.0 country flags on the Address field: the "Show country flags" control
 * sits right after the sub-field rows, shows while the Country part is on, and
 * the `flags` feature is listed only for an address that turned it on.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Frontend\FrontendAssets;

final class AddressFlagsTest extends TestCase {

	private function groups( array $fields ): array {
		return FrontendAssets::fieldGroups( array( 'metadata' => array( 'type' => 'regular' ), 'fields' => $fields ) );
	}

	public function test_control_follows_the_sub_field_rows(): void {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		$def   = $registry->get( 'address_group' );
		$names = array_column( $def->inspectorControls, 'name' );
		$this->assertSame( array( 'label', 'fields', 'showFlags' ), $names );

		$control = array_column( $def->inspectorControls, null, 'name' )['showFlags'];
		$this->assertSame( 'checkbox', $control['type'] );
		$this->assertSame( 'Show country flags', $control['label'] );
		$this->assertSame( 'general', $control['section'] );
		$this->assertStringContainsString( 'Country sub-field', $control['help'] );
		$this->assertStringContainsString( 'Loads flag images only for forms that use it', $control['help'] );
		$this->assertSame( array( 'enable_country' ), array_keys( $control['showWhen'] ) );
		$this->assertSame( array( true, 1, '1', '' ), $control['showWhen']['enable_country'] );

		$this->assertFalse( $def->fieldSpecificAttributes['showFlags'] );
	}

	public function test_flags_feature_is_listed_only_when_the_address_asks(): void {
		$this->assertSame( array( 'geo' ), $this->groups( array( array( 'type' => 'address_group', 'key' => 'a' ) ) ) );
		$this->assertSame( array( 'geo' ), $this->groups( array( array( 'type' => 'address_group', 'key' => 'a', 'showFlags' => false ) ) ) );
		$this->assertSame( array( 'geo' ), $this->groups( array( array( 'type' => 'address_group', 'key' => 'a', 'showFlags' => 'no' ) ) ) );
		$this->assertSame( array( 'flags', 'geo' ), $this->groups( array( array( 'type' => 'address_group', 'key' => 'a', 'showFlags' => true ) ) ) );
		$this->assertSame(
			array( 'flags', 'geo' ),
			$this->groups( array( array( 'type' => 'address_group', 'key' => 'a', 'config' => array( 'showFlags' => true ) ) ) )
		);
	}
}
