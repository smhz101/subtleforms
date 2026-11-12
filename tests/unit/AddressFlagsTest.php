<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 2.9.0 country flags on the Address field are an add-on capability: Free has
 * no control for them, and lists the `flags` feature only when an add-on
 * declares `address_flags` and the address has `showFlags` true.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Frontend\FrontendAssets;
use SubtleForms\Support\ExtensionPoints;

final class AddressFlagsTest extends TestCase {

	private function groups( array $fields ): array {
		return FrontendAssets::fieldGroups( array( 'metadata' => array( 'type' => 'regular' ), 'fields' => $fields ) );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['sf_test_filters']['subtleforms/addon/features'] );
	}

	private function declare_feature(): void {
		$GLOBALS['sf_test_filters']['subtleforms/addon/features'] = static fn( $features ) => array_merge( (array) $features, array( 'address_flags' ) );
	}

	public function test_free_has_no_flags_control_on_the_address_field(): void {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		$def = $registry->get( 'address_group' );
		$this->assertSame( array( 'label', 'fields' ), array_column( $def->inspectorControls, 'name' ) );
		$this->assertArrayNotHasKey( 'showFlags', $def->fieldSpecificAttributes );
	}

	public function test_the_feature_name_is_a_known_extension_point(): void {
		$this->assertSame( 'address_flags', ExtensionPoints::ADDRESS_FLAGS );
		$this->assertContains( 'address_flags', ExtensionPoints::all() );
		$this->assertSame( 3, ExtensionPoints::LEVEL );
		$this->assertFalse( ExtensionPoints::isProvided( 'address_flags' ) );
		$this->declare_feature();
		$this->assertTrue( ExtensionPoints::isProvided( 'address_flags' ) );
	}

	public function test_without_the_feature_an_address_never_asks_for_the_flags_code(): void {
		foreach ( array( true, false, 'no' ) as $value ) {
			$this->assertSame( array( 'geo' ), $this->groups( array( array( 'type' => 'address_group', 'key' => 'a', 'showFlags' => $value ) ) ), var_export( $value, true ) );
		}
		$this->assertSame(
			array( 'geo' ),
			$this->groups( array( array( 'type' => 'address_group', 'key' => 'a', 'config' => array( 'showFlags' => true ) ) ) )
		);
	}

	public function test_with_the_feature_the_flags_code_is_listed_only_when_the_address_asks(): void {
		$this->declare_feature();
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
