<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * 2.6.0 front-end speed: the field code groups a form needs, as listed on
 * the form container, match what the browser loads for the schema.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Frontend\FrontendAssets;

final class FrontEndSpeed260Test extends TestCase {

	private function root(): string {
		return dirname( __DIR__, 2 );
	}

	public function test_plain_form_needs_no_extra_code(): void {
		$schema = array(
			'metadata' => array( 'type' => 'regular' ),
			'fields'   => array(
				array( 'type' => 'text', 'key' => 'name' ),
				array( 'type' => 'email', 'key' => 'email' ),
				array( 'type' => 'phone', 'key' => 'phone' ),
				array( 'type' => 'select', 'key' => 'topic' ),
			),
		);
		$this->assertSame( array(), FrontendAssets::fieldGroups( $schema ) );
		$this->assertSame( array(), FrontendAssets::fieldGroups( null ) );
	}

	public function test_groups_are_found_in_steps_columns_and_containers(): void {
		$schema = array(
			'metadata' => array( 'type' => 'conversational' ),
			'fields'   => array(
				array(
					'type'     => 'step',
					'children' => array(
						array( 'type' => 'date' ),
						array(
							'type'    => 'two_column_container',
							'columns' => array(
								array( array( 'type' => 'phone', 'config' => array( 'enableCountryCode' => true ) ) ),
								array( 'fields' => array( array( 'type' => 'image_upload' ) ) ),
							),
						),
					),
				),
				array(
					'type'   => 'repeat_container',
					'config' => array( 'fields' => array( array( 'type' => 'payment_product' ) ) ),
				),
				array( 'type' => 'chained_select' ),
				array( 'type' => 'rich_text' ),
				array( 'type' => 'address_group' ),
			),
		);
		$this->assertSame(
			array( 'chained', 'conversational', 'date', 'geo', 'payments', 'repeater', 'richText', 'upload' ),
			FrontendAssets::fieldGroups( $schema )
		);
	}

	public function test_type_groups_match_the_browser_list(): void {
		$js = (string) file_get_contents( $this->root() . '/resources/frontend/components/fields/lazyFields.jsx' );
		$this->assertSame( 1, preg_match( '/const TYPE_GROUPS = \{(.*?)\};/s', $js, $m ) );
		preg_match_all( "/(\w+): '(\w+)'/", $m[1], $pairs, PREG_SET_ORDER );
		$browser = array();
		foreach ( $pairs as $pair ) {
			$browser[ $pair[1] ] = $pair[2];
		}
		$server = ( new ReflectionClass( FrontendAssets::class ) )->getConstant( 'TYPE_GROUPS' );
		ksort( $browser );
		ksort( $server );
		$this->assertSame( $server, $browser );

		// Every group has a loader in the browser.
		preg_match( '/const LOADERS = \{(.*?)\n\};/s', $js, $loaders );
		foreach ( array_unique( array_merge( array_values( $server ), array( 'geo', 'conversational' ) ) ) as $group ) {
			$this->assertMatchesRegularExpression( '/\b' . $group . ': \(\) =>/', $loaders[1], $group );
		}
	}

	public function test_script_is_deferred_and_country_list_is_not_in_the_main_bundle(): void {
		$php = (string) file_get_contents( $this->root() . '/src/Frontend/FrontendAssets.php' );
		$this->assertStringContainsString( "'strategy'  => 'defer'", $php );
		$validation = (string) file_get_contents( $this->root() . '/resources/frontend/utils/fieldValidation.js' );
		$this->assertStringNotContainsString( "shared/phone'", $validation );
		$conditions = (string) file_get_contents( $this->root() . '/resources/shared/conditions.js' );
		$this->assertStringNotContainsString( "from './countries'", $conditions );
	}

	public function test_widget_lookup_does_not_call_the_core_only_sidebar_helper(): void {
		// Plugin Check reports wp_get_sidebars_widgets() as a forbidden
		// function, which blocks the release.
		$php = (string) file_get_contents( $this->root() . '/src/Frontend/FormDetector.php' );
		$this->assertDoesNotMatchRegularExpression( '/\bwp_get_sidebars_widgets\s*\(/', $php );
		$this->assertStringContainsString( "get_option( 'sidebars_widgets'", $php );
	}
}
