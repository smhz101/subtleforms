<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.9.0: the builder preview loads what a page of the active theme loads.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Admin\ThemePreviewAssets;

final class ThemePreviewAssetsTest extends TestCase {

	/** @var string */
	private $root;

	/** @var string */
	private $previous;

	/** @var int */
	private $runs = 0;

	protected function setUp(): void {
		parent::setUp();
		$this->root = get_theme_root();
		wp_mkdir_p( $this->root . '/fakeone' );
		file_put_contents( $this->root . '/fakeone/style.css', "/*\nTheme Name: Fake One\nVersion: 1.0\n*/\n" );
		file_put_contents( $this->root . '/fakeone/index.php', '<?php // Silence.' );
		file_put_contents( $this->root . '/fakeone/a.css', '.fake-a{color:#111}' );
		file_put_contents( $this->root . '/fakeone/b.css', '.fake-b{color:#222}' );
		wp_clean_themes_cache();
		$this->previous = get_stylesheet();
		switch_theme( 'fakeone' );
		delete_transient( $this->key() );
		ThemePreviewAssets::flush();
		$this->runs = 0;
	}

	protected function tearDown(): void {
		remove_all_actions( 'wp_enqueue_scripts' );
		switch_theme( $this->previous );
		wp_clean_themes_cache();
		@unlink( $this->root . '/fakeone/style.css' );
		@unlink( $this->root . '/fakeone/index.php' );
		@unlink( $this->root . '/fakeone/a.css' );
		@unlink( $this->root . '/fakeone/b.css' );
		@rmdir( $this->root . '/fakeone' );
		parent::tearDown();
	}

	private function key(): string {
		$m = new \ReflectionMethod( ThemePreviewAssets::class, 'cacheKey' );
		$m->setAccessible( true );
		return $m->invoke( null );
	}

	private function enqueueTwoFiles(): void {
		add_action(
			'wp_enqueue_scripts',
			function () {
				$this->runs++;
				wp_enqueue_style( 'fake-b', get_stylesheet_directory_uri() . '/b.css', array( 'fake-a' ), '1' );
				wp_register_style( 'fake-a', get_stylesheet_directory_uri() . '/a.css', array(), '1' );
				wp_add_inline_style( 'fake-b', '.fake-inline{color:#333}' );
				wp_enqueue_style( 'other-plugin', 'https://elsewhere.example/p.css', array(), '1' );
			}
		);
	}

	public function test_collects_theme_files_in_dependency_order_with_inline_css(): void {
		$this->enqueueTwoFiles();
		$data = ThemePreviewAssets::collect();

		$base = get_stylesheet_directory_uri();
		$this->assertFalse( $data['degraded'] );
		$mine = array_values( array_filter( $data['stylesheets'], function ( $h ) use ( $base ) {
			return 0 === strpos( $h, $base . '/a.css' ) || 0 === strpos( $h, $base . '/b.css' );
		} ) );
		$this->assertSame( array( $base . '/a.css?ver=1', $base . '/b.css?ver=1' ), $mine );
		$this->assertStringContainsString( '.fake-inline{color:#333}', $data['inlineCss'] );
		foreach ( $data['stylesheets'] as $href ) {
			$this->assertStringNotContainsString( 'elsewhere.example', $href );
		}
	}

	public function test_describes_a_classic_theme_page(): void {
		$this->enqueueTwoFiles();
		$data = ThemePreviewAssets::collect();

		$this->assertFalse( $data['isBlockTheme'] );
		$this->assertSame( array( 'page', 'wp-embed-responsive', 'fakeone' ), $data['bodyClasses'] );
		$this->assertSame( 'entry-content', $data['contentClass'] );
		$this->assertIsString( $data['globalCss'] );
		$this->assertIsString( $data['fontFaces'] );
	}

	public function test_queues_are_put_back_and_nothing_is_printed(): void {
		wp_styles();
		$before = $GLOBALS['wp_styles'];
		wp_enqueue_style( 'admin-only', 'https://example.test/admin.css' );
		$this->enqueueTwoFiles();

		ob_start();
		ThemePreviewAssets::collect();
		$printed = ob_get_clean();

		$this->assertSame( '', $printed );
		$this->assertSame( $before, $GLOBALS['wp_styles'] );
		$this->assertTrue( wp_style_is( 'admin-only', 'enqueued' ) );
		wp_dequeue_style( 'admin-only' );
	}

	public function test_a_theme_that_throws_gives_the_two_file_fallback(): void {
		add_action(
			'wp_enqueue_scripts',
			function () {
				throw new \RuntimeException( 'needs the main query' );
			}
		);
		$data = ThemePreviewAssets::collect();

		$this->assertTrue( $data['degraded'] );
		$this->assertSame( array( get_stylesheet_uri() ), $data['stylesheets'] );
		$this->assertSame( '', $data['inlineCss'] );
		$this->assertNotEmpty( $data['bodyClasses'] );
		// A degraded answer is not cached.
		$this->assertFalse( get_transient( $this->key() ) );
	}

	public function test_the_answer_is_cached_until_the_theme_switches(): void {
		$this->enqueueTwoFiles();

		ThemePreviewAssets::collect();
		ThemePreviewAssets::collect();
		$this->assertSame( 1, $this->runs );
		$this->assertIsArray( get_transient( $this->key() ) );

		do_action( 'switch_theme', 'fakeone', wp_get_theme(), wp_get_theme() );
		ThemePreviewAssets::collect();
		$this->assertSame( 2, $this->runs );
	}

	public function test_customizer_saves_and_upgrades_also_clear_it(): void {
		$this->enqueueTwoFiles();
		ThemePreviewAssets::collect();

		do_action( 'customize_save_after', null );
		ThemePreviewAssets::collect();
		$this->assertSame( 2, $this->runs );

		// Site Editor global styles saves (colours, type, layout).
		do_action( 'save_post_wp_global_styles', 0 );
		ThemePreviewAssets::collect();
		$this->assertSame( 3, $this->runs );

		// Core hooks its own handlers onto this action; load the classes they name.
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		do_action( 'upgrader_process_complete', null, array() );
		ThemePreviewAssets::collect();
		$this->assertSame( 4, $this->runs );
	}

	public function test_the_route_returns_the_same_data_to_an_admin_only(): void {
		$this->enqueueTwoFiles();
		$route = rest_get_server()->get_routes()['/subtleforms/v1/appearance/theme-assets'] ?? null;
		$this->assertNotNull( $route );
		$this->assertSame( array( 'GET' => true ), $route[0]['methods'] );
	}
}
