<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.7.1: the form stylesheet has an RTL replacement registered, and a page
 * whose forms all inherit the theme prints no plugin stylesheet.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Frontend\FrontendAssets;

final class RtlStyleTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		FrontendAssets::resetForTests();
		wp_dequeue_style( FrontendAssets::HANDLE );
		wp_dequeue_script( FrontendAssets::HANDLE );
		wp_deregister_script( FrontendAssets::HANDLE );
	}

	public function test_form_stylesheet_is_registered_for_rtl(): void {
		FrontendAssets::enqueue();
		$style = wp_styles()->registered[ FrontendAssets::HANDLE ];
		$this->assertSame( 'replace', $style->extra['rtl'] ?? null );

		$this->assertStringContainsString( 'index.jsx-rtl.css', $this->rtlHref() );
	}

	private function rtlHref(): string {
		$wp_styles = wp_styles();
		$wp_styles->text_direction = 'rtl';
		ob_start();
		$wp_styles->do_item( FrontendAssets::HANDLE );
		$html = ob_get_clean();
		$wp_styles->text_direction = 'ltr';
		return $html;
	}

	public function test_theme_only_page_drops_the_stylesheet(): void {
		FrontendAssets::enqueue();
		$this->assertTrue( wp_style_is( FrontendAssets::HANDLE, 'enqueued' ) );

		FrontendAssets::noteFormLook( array( 'metadata' => array( 'type' => 'regular', 'appearance' => array( 'preset' => 'theme' ) ), 'fields' => array( array( 'type' => 'text' ) ) ) );
		$this->assertFalse( wp_style_is( FrontendAssets::HANDLE, 'enqueued' ) );
		$this->assertTrue( wp_style_is( 'subtleforms-frontend-layout', 'enqueued' ) );

		// A second form that needs the stylesheet brings it back.
		FrontendAssets::noteFormLook( array( 'metadata' => array( 'type' => 'regular', 'appearance' => array( 'preset' => 'minimal' ) ), 'fields' => array( array( 'type' => 'text' ) ) ) );
		$this->assertTrue( wp_style_is( FrontendAssets::HANDLE, 'enqueued' ) );
	}
}
