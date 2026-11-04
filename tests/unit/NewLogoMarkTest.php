<?php
/**
 * The default menu icon is a single-colour silhouette core can repaint.
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Admin\AdminMenu;

final class NewLogoMarkTest extends TestCase {

	public function test_default_menu_icon_is_a_black_base64_svg(): void {
		$icon = AdminMenu::default_menu_icon();
		$this->assertStringStartsWith( 'data:image/svg+xml;base64,', $icon );
		$svg = base64_decode( substr( $icon, 26 ), true );
		$this->assertNotFalse( $svg );
		$this->assertStringContainsString( 'viewBox="-64 -64 640 640"', $svg );
		$this->assertSame( 2, substr_count( $svg, '<path fill="black"' ) );
		$this->assertStringNotContainsString( '<rect', $svg );
	}

	public function test_shipped_menu_icon_file_is_the_new_mark(): void {
		$file = dirname( __DIR__, 2 ) . '/assets/menu-icon.svg';
		$svg  = (string) file_get_contents( $file );
		$this->assertStringContainsString( 'viewBox="0 0 512 512"', $svg );
		$this->assertStringContainsString( 'M0 122.88 C0 55.015', $svg );
		$this->assertStringNotContainsString( 'M18.6 21.6', $svg );
	}
}
