<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A form that inherits the theme loads no plugin stylesheet (2.7.1).
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Frontend\FrontendAssets;

final class ThemeFormStyleTest extends TestCase {

	private function schema( array $appearance, array $fields = null, string $type = 'regular' ): array {
		return array(
			'metadata' => array( 'type' => $type, 'appearance' => $appearance ),
			'fields'   => $fields ?? array(
				array( 'type' => 'text', 'key' => 'name' ),
				array( 'type' => 'select', 'key' => 'topic' ),
			),
		);
	}

	public function test_untouched_theme_preset_is_plain(): void {
		$this->assertTrue( FrontendAssets::isPlainThemeForm( $this->schema( array( 'preset' => 'theme' ) ) ) );
		$this->assertTrue(
			FrontendAssets::isPlainThemeForm(
				$this->schema( array( 'preset' => 'theme', 'tokens' => array( 'fontFamily' => 'inherit', 'colorPrimary' => '' ), 'variants' => array( 'width' => 'theme' ) ) )
			)
		);
	}

	public function test_other_presets_and_tuned_theme_keep_the_stylesheet(): void {
		$this->assertFalse( FrontendAssets::isPlainThemeForm( $this->schema( array( 'preset' => 'minimal' ) ) ) );
		$this->assertFalse( FrontendAssets::isPlainThemeForm( $this->schema( array( 'preset' => 'theme', 'tokens' => array( 'colorPrimary' => '#ff0000' ) ) ) ) );
		$this->assertFalse( FrontendAssets::isPlainThemeForm( $this->schema( array( 'preset' => 'theme', 'variants' => array( 'button' => 'outline' ) ) ) ) );
		$this->assertFalse( FrontendAssets::isPlainThemeForm( null ) );
	}

	public function test_widgets_and_step_forms_keep_the_stylesheet(): void {
		$theme = array( 'preset' => 'theme' );
		$this->assertFalse( FrontendAssets::isPlainThemeForm( $this->schema( $theme, array( array( 'type' => 'signature', 'key' => 's' ) ) ) ) );
		$this->assertFalse( FrontendAssets::isPlainThemeForm( $this->schema( $theme, null, 'conversational' ) ) );
		$this->assertFalse( FrontendAssets::isPlainThemeForm( $this->schema( $theme, array( array( 'type' => 'group', 'fields' => array( array( 'type' => 'toggle' ) ) ) ) ) ) );
	}

	public function test_layout_lines_paint_nothing_but_the_error_colour(): void {
		$css = FrontendAssets::layoutCss();
		$this->assertStringNotContainsString( 'background', $css );
		$this->assertStringNotContainsString( 'border:1', $css );
		$this->assertStringNotContainsString( 'font-', $css );
		$this->assertStringNotContainsString( 'gradient', $css );
		$this->assertStringContainsString( 'subtleforms-sr-only', $css );
	}
}
