<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * The menu icon and the in-app mark come through the admin_branding filter.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Admin\AdminMenu;

final class AdminBrandingMarkTest extends TestCase {

	public static function setUpBeforeClass(): void {
		parent::setUpBeforeClass();
		if ( ! defined( 'SUBTLEFORMS_TESTING' ) ) {
			define( 'SUBTLEFORMS_TESTING', true );
		}
	}

	protected function tearDown(): void {
		remove_all_filters( 'subtleforms/admin_branding' );
		parent::tearDown();
	}

	private function brandingWith( array $values ): array {
		add_filter(
			'subtleforms/admin_branding',
			static function ( $b ) use ( $values ) {
				return array_merge( $b, $values );
			}
		);
		return AdminMenu::branding();
	}

	private function menuIcon(): string {
		$m = new \ReflectionMethod( AdminMenu::class, 'menu_icon' );
		$m->setAccessible( true );
		return $m->invoke( null );
	}

	public function test_defaults_use_the_built_in_mark(): void {
		$b = AdminMenu::branding();
		$this->assertSame( '', $b['menuIcon'] );
		$this->assertSame( '', $b['markSvg'] );
	}

	public function test_menu_icon_is_a_data_uri_by_default(): void {
		$icon = $this->menuIcon();
		$this->assertStringStartsWith( 'data:image/svg+xml;base64,', $icon );
		$svg = base64_decode( substr( $icon, strlen( 'data:image/svg+xml;base64,' ) ), true );
		$this->assertStringContainsString( 'viewBox="-64 -64 640 640"', $svg );
		$this->assertSame( 2, substr_count( $svg, 'fill="black"' ) );
		$this->assertStringNotContainsString( '#', $svg );
	}

	public function test_valid_data_uri_is_kept(): void {
		$uri = 'data:image/svg+xml;base64,' . base64_encode( '<svg xmlns="http://www.w3.org/2000/svg"><path fill="black" d="M0 0h1v1z"/></svg>' );
		$this->assertSame( $uri, $this->brandingWith( array( 'menuIcon' => $uri ) )['menuIcon'] );
		$this->assertSame( $uri, $this->menuIcon() );
	}

	public function test_valid_url_is_kept(): void {
		$url = 'https://example.com/wp-content/icon.svg';
		$this->assertSame( $url, $this->brandingWith( array( 'menuIcon' => $url ) )['menuIcon'] );
		$this->assertSame( $url, $this->menuIcon() );
	}

	public function test_unsafe_or_broken_icons_fall_back(): void {
		foreach ( array(
			'javascript:alert(1)',
			'data:text/html;base64,PHNjcmlwdD4=',
			'data:image/svg+xml;base64,!!!not base64!!!',
			'data:image/svg+xml;base64,',
			'data:image/svg+xml;base64,' . base64_encode( 'plain text, no markup' ),
			'data:image/svg+xml;base64,' . base64_encode( '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' ),
			'ftp://example.com/icon.svg',
			array( 'x' ),
		) as $bad ) {
			remove_all_filters( 'subtleforms/admin_branding' );
			$this->assertSame( '', $this->brandingWith( array( 'menuIcon' => $bad ) )['menuIcon'], is_string( $bad ) ? $bad : 'array' );
		}
		remove_all_filters( 'subtleforms/admin_branding' );
		$this->assertStringStartsWith( 'data:image/svg+xml;base64,', $this->menuIcon() );
	}

	public function test_mark_svg_keeps_only_shapes(): void {
		$svg   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" onload="x()"><title>t</title><script>alert(1)</script><g fill="#3858e9"><path d="M0 0 L10 10 Z" fill="#1e1e1e" onclick="x()"/></g><image href="https://x.test/a.png"/></svg>';
		$clean = $this->brandingWith( array( 'markSvg' => $svg ) )['markSvg'];
		$this->assertStringContainsString( '<svg', $clean );
		$this->assertStringContainsString( 'viewBox="0 0 512 512"', $clean );
		$this->assertStringContainsString( 'd="M0 0 L10 10 Z"', $clean );
		$this->assertStringContainsString( 'fill="#1e1e1e"', $clean );
		foreach ( array( 'script', 'alert', 'onload', 'onclick', '<image', '<title' ) as $needle ) {
			$this->assertStringNotContainsString( $needle, $clean );
		}
	}

	public function test_mark_svg_rejects_bad_fill_and_path_data(): void {
		$svg   = '<svg viewBox="0 0 8 8"><path d="M0 0 url(javascript:1)" fill="url(#x)"/><path d="M0 0h8v8z" fill="javascript:1"/></svg>';
		$clean = $this->brandingWith( array( 'markSvg' => $svg ) )['markSvg'];
		$this->assertStringNotContainsString( 'javascript', $clean );
		$this->assertStringNotContainsString( 'url(', $clean );
	}

	public function test_mark_svg_without_shapes_is_empty(): void {
		$this->assertSame( '', $this->brandingWith( array( 'markSvg' => '<svg viewBox="0 0 8 8"></svg>' ) )['markSvg'] );
		remove_all_filters( 'subtleforms/admin_branding' );
		$this->assertSame( '', $this->brandingWith( array( 'markSvg' => 'not svg' ) )['markSvg'] );
	}
}
