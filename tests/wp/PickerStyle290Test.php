<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.9.0: the picker stylesheet is plugin UI. A form with a dropdown, a date, a
 * time or a date and time field loads picker.css on its own, also a form that
 * inherits the theme (#109); a form with only text fields does not.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Frontend\FrontendAssets;

final class PickerStyle290Test extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		FrontendAssets::resetForTests();
		foreach ( array( FrontendAssets::HANDLE, FrontendAssets::PICKER_HANDLE, 'subtleforms-frontend-layout' ) as $handle ) {
			wp_dequeue_style( $handle );
			wp_deregister_style( $handle );
		}
		wp_dequeue_script( FrontendAssets::HANDLE );
		wp_deregister_script( FrontendAssets::HANDLE );
	}

	private function themeForm( array $fields ): array {
		return array(
			'metadata' => array( 'type' => 'regular', 'appearance' => array( 'preset' => 'theme' ) ),
			'fields'   => $fields,
		);
	}

	public function test_a_plain_theme_form_with_a_dropdown_gets_the_layout_lines_and_the_picker_file(): void {
		FrontendAssets::noteFormLook( $this->themeForm( array( array( 'type' => 'text' ), array( 'type' => 'select' ) ) ) );
		$this->assertTrue( wp_style_is( FrontendAssets::PICKER_HANDLE, 'enqueued' ) );
		$this->assertTrue( wp_style_is( 'subtleforms-frontend-layout', 'enqueued' ) );
		$this->assertFalse( wp_style_is( FrontendAssets::HANDLE, 'enqueued' ) );
		$this->assertStringContainsString( 'build/frontend/picker.css', wp_styles()->registered[ FrontendAssets::PICKER_HANDLE ]->src );
	}

	public function test_a_plain_theme_form_with_a_date_field_gets_only_layout_and_picker_css(): void {
		foreach ( array( 'date', 'time', 'datetime' ) as $type ) {
			FrontendAssets::resetForTests();
			wp_dequeue_style( FrontendAssets::PICKER_HANDLE );
			wp_deregister_style( FrontendAssets::PICKER_HANDLE );
			wp_dequeue_style( FrontendAssets::HANDLE );
			FrontendAssets::noteFormLook( $this->themeForm( array( array( 'type' => 'text' ), array( 'type' => $type ) ) ) );
			$this->assertTrue( wp_style_is( FrontendAssets::PICKER_HANDLE, 'enqueued' ), $type );
			$this->assertTrue( wp_style_is( 'subtleforms-frontend-layout', 'enqueued' ), $type );
			$this->assertFalse( wp_style_is( FrontendAssets::HANDLE, 'enqueued' ), $type );
		}
	}

	public function test_a_plain_theme_form_with_only_text_fields_gets_no_picker_file(): void {
		FrontendAssets::noteFormLook( $this->themeForm( array( array( 'type' => 'text' ), array( 'type' => 'email' ) ) ) );
		$this->assertFalse( wp_style_is( FrontendAssets::PICKER_HANDLE, 'enqueued' ) );
		$this->assertTrue( wp_style_is( 'subtleforms-frontend-layout', 'enqueued' ) );
	}

	public function test_a_styled_form_with_a_picker_gets_the_main_and_the_picker_stylesheet(): void {
		FrontendAssets::noteFormLook( array( 'metadata' => array( 'type' => 'regular', 'appearance' => array( 'preset' => 'minimal' ) ), 'fields' => array( array( 'type' => 'datetime' ) ) ) );
		$this->assertTrue( wp_style_is( FrontendAssets::HANDLE, 'enqueued' ) );
		$this->assertTrue( wp_style_is( FrontendAssets::PICKER_HANDLE, 'enqueued' ) );
	}

	public function test_the_picker_stylesheet_has_an_rtl_replacement(): void {
		FrontendAssets::noteFormLook( $this->themeForm( array( array( 'type' => 'date' ) ) ) );
		$this->assertSame( 'replace', wp_styles()->registered[ FrontendAssets::PICKER_HANDLE ]->extra['rtl'] ?? null );
	}
}
