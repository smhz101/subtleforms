<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.7.2: the theme data route, and custom CSS being kept for people who may
 * not edit it.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once ABSPATH . 'wp-admin/includes/user.php';

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Support\ThemeStyles;

final class CustomStyling272Test extends TestCase {

	private function get(): \WP_REST_Response {
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/appearance/theme' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		return rest_do_request( $request );
	}

	public function test_route_is_for_administrators_only(): void {
		wp_set_current_user( 0 );
		$this->assertContains( $this->get()->get_status(), array( 401, 403 ) );

		$author = self::factory_user( 'author' );
		wp_set_current_user( $author );
		$this->assertSame( 403, $this->get()->get_status() );
		wp_delete_user( $author );
	}

	public function test_block_theme_gives_its_palette_fonts_and_font_faces(): void {
		if ( ! wp_is_block_theme() ) {
			$this->markTestSkipped( 'The site theme is not a block theme.' );
		}
		$this->asAdmin();
		$response = $this->get();
		$this->assertSame( 200, $response->get_status() );
		$data = $response->get_data()['data'];

		$this->assertTrue( $data['isBlockTheme'] );
		$this->assertNotEmpty( $data['palette'] );
		foreach ( array( 'slug', 'name', 'color' ) as $key ) {
			$this->assertArrayHasKey( $key, $data['palette'][0] );
		}
		$this->assertNotEmpty( $data['fontSizes'] );
		$this->assertStringStartsWith( 'var(--wp--preset--', $data['bodyFont'] ?: 'var(--wp--preset--' );
		$this->assertStringStartsWith( ':root', $data['variablesCss'] );
		$this->assertStringNotContainsString( '<style', $data['fontFaceCss'] );
		if ( ! empty( $data['fontFamilies'] ) ) {
			$this->assertStringContainsString( '@font-face', $data['fontFaceCss'] );
		}
		foreach ( array( 'buttonStyles', 'headingFont', 'colors' ) as $key ) {
			$this->assertArrayHasKey( $key, $data );
		}
	}

	public function test_classic_theme_falls_back_to_editor_supports(): void {
		// A theme without theme.json: WordPress gives the palette as a plain list
		// and there are no font families.
		$data = ThemeStyles::compute(
			array(
				'color'      => array( 'palette' => array( array( 'slug' => 'brand', 'name' => 'Brand', 'color' => '#aa0000' ) ) ),
				'typography' => array(),
			),
			array(),
			false
		);
		$this->assertFalse( $data['isBlockTheme'] );
		$this->assertSame( 'brand', $data['palette'][0]['slug'] );
		$this->assertSame( array(), $data['fontFamilies'] );
		$this->assertSame( '', $data['bodyFont'] );

		// And from add_theme_support() when settings carry nothing.
		add_theme_support( 'editor-color-palette', array( array( 'slug' => 'sky', 'name' => 'Sky', 'color' => '#00aaff' ) ) );
		add_theme_support( 'editor-font-sizes', array( array( 'slug' => 'big', 'name' => 'Big', 'size' => 30 ) ) );
		$data = ThemeStyles::compute( array(), array(), false );
		remove_theme_support( 'editor-color-palette' );
		remove_theme_support( 'editor-font-sizes' );
		$this->assertSame( 'sky', $data['palette'][0]['slug'] );
		$this->assertSame( '30px', $data['fontSizes'][0]['size'] );
	}

	public function test_theme_shorthand_becomes_a_css_variable(): void {
		$this->assertSame( 'var(--wp--preset--color--primary)', ThemeStyles::preset( 'var:preset|color|primary' ) );
		$this->assertSame( '#fff', ThemeStyles::preset( '#fff' ) );
	}

	public function test_arbitrary_custom_css_cannot_be_saved(): void {
		$this->asAdmin();
		$repo   = new FormsRepository();
		$schema = array(
			'metadata'       => array(
				'type'       => 'regular',
				'name'       => 'Css',
				'title'      => 'Css',
				'appearance' => array(
					'preset'    => 'theme',
					'tokens'    => array( 'labelSize' => '15px' ),
					'customCss' => '.subtleforms-button{letter-spacing:2px}',
				),
			),
			'schema_version' => 1,
			'fields'         => array( array( 'type' => 'text', 'key' => 'a', 'label' => 'A' ) ),
		);
		$id = $repo->create( array( 'title' => 'Css', 'status' => 'published', 'schema' => $schema ) );
		$this->formIds[] = $id;
		$repo->saveSchemaVersion( $id, $schema, true );
		wp_cache_flush();
		$saved = $repo->loadSchemaVersion( $id )['schema']['metadata']['appearance'];
		$this->assertArrayNotHasKey( 'customCss', $saved );
		$this->assertSame( '15px', $saved['tokens']['labelSize'] );
		$this->assertSame( 'theme', $saved['preset'] );
	}


}
