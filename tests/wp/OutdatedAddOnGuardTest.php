<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

use SubtleForms\Admin\AdminNotices;
use SubtleForms\Compat\OutdatedAddOnGuard;

/**
 * P1-05: an add-on built for an earlier SubtleForms is not started.
 */
class OutdatedAddOnGuardTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		// Stand-in for the main file of an old add-on build: it defines the
		// start-up function and hooks it on plugins_loaded at priority 20.
		if ( ! function_exists( 'subtleforms_pro_init' ) ) {
			$file = sys_get_temp_dir() . '/sf-old-addon-main.php';
			file_put_contents( $file, "<?php\nfunction subtleforms_pro_init() { \$GLOBALS['sf_old_addon_booted'] = true; }\n" );
			require_once $file;
		}
		$GLOBALS['sf_old_addon_booted'] = false;
		remove_action( 'plugins_loaded', 'subtleforms_pro_init', 20 );
		add_action( 'plugins_loaded', 'subtleforms_pro_init', 20 );
	}

	protected function tearDown(): void {
		remove_action( 'plugins_loaded', 'subtleforms_pro_init', 20 );
		OutdatedAddOnGuard::apply( '' );
		// set_current_screen() makes is_admin() true for later tests.
		unset( $GLOBALS['current_screen'] );
		parent::tearDown();
	}

	private function notice( int $userId, string $screen = 'plugins' ): string {
		wp_set_current_user( $userId );
		require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';
		require_once ABSPATH . 'wp-admin/includes/screen.php';
		set_current_screen( $screen );
		ob_start();
		AdminNotices::maybe_show_outdated_add_on_notice();
		return (string) ob_get_clean();
	}

	public function test_old_add_on_is_not_started_and_notice_shows_for_admins(): void {
		$this->assertNotFalse( has_action( 'plugins_loaded', 'subtleforms_pro_init' ) );

		OutdatedAddOnGuard::apply( '2.5.0' );

		$this->assertFalse( has_action( 'plugins_loaded', 'subtleforms_pro_init' ) );
		$this->assertSame( '2.5.0', OutdatedAddOnGuard::blocked_version() );

		$html = $this->notice( self::factory_user( 'administrator' ) );
		$this->assertStringContainsString( 'SubtleForms Pro 2.5.0 is not compatible with this version of SubtleForms. Update SubtleForms Pro to version 2.8.0 or later.', $html );
		$this->assertDoesNotMatchRegularExpression( '/licen[sc]e|upgrade|buy|purchase|price/i', $html );
	}

	public function test_notice_is_limited_to_plugin_and_subtleforms_screens(): void {
		OutdatedAddOnGuard::apply( '2.5.0' );
		$admin = self::factory_user( 'administrator' );

		$this->assertNotSame( '', $this->notice( $admin, 'toplevel_page_subtleforms' ) );
		$this->assertNotSame( '', $this->notice( $admin, 'plugins' ) );
		$this->assertSame( '', $this->notice( $admin, 'dashboard' ) );
	}

	public function test_notice_is_hidden_from_users_who_cannot_manage_plugins(): void {
		OutdatedAddOnGuard::apply( '2.4.0' );

		$this->assertSame( '', $this->notice( self::factory_user( 'editor' ) ) );
	}

	public function test_every_released_old_build_is_blocked(): void {
		foreach ( array( '2.4.0', '2.4.1', '2.4.2', '2.5.0', '2.6.0', '2.6.9', '2.7.0', '2.7.1' ) as $version ) {
			remove_action( 'plugins_loaded', 'subtleforms_pro_init', 20 );
			add_action( 'plugins_loaded', 'subtleforms_pro_init', 20 );
			OutdatedAddOnGuard::apply( $version );
			$this->assertFalse( has_action( 'plugins_loaded', 'subtleforms_pro_init' ), $version );
		}
	}

	public function test_a_compatible_add_on_is_left_alone(): void {
		foreach ( array( '2.8.0', '2.8.1', '2.10.0', '3.0.0' ) as $version ) {
			OutdatedAddOnGuard::apply( $version );
			$this->assertSame( 20, has_action( 'plugins_loaded', 'subtleforms_pro_init' ), $version );
			$this->assertSame( '', OutdatedAddOnGuard::blocked_version(), $version );
		}
		$this->assertSame( '', $this->notice( self::factory_user( 'administrator' ) ) );
	}

	public function test_no_add_on_means_nothing_happens(): void {
		remove_action( 'plugins_loaded', 'subtleforms_pro_init', 20 );
		OutdatedAddOnGuard::apply( '2.5.0' );
		$this->assertSame( '', OutdatedAddOnGuard::blocked_version() );
	}

	/** RCOMP-05: the notice can be dismissed per person, until the installed version changes. */
	public function test_the_notice_can_be_dismissed_until_the_add_on_version_changes(): void {
		OutdatedAddOnGuard::apply( '2.5.0' );
		$admin = self::factory_user( 'administrator' );
		$html  = $this->notice( $admin );
		$this->assertStringContainsString( 'is-dismissible', $html );
		$this->assertStringContainsString( 'data-version="2.5.0"', $html );
		$this->assertSame( 1, preg_match( '/data-nonce="([^"]+)"/', $html, $m ) );

		$result = $this->dismiss( $admin, $m[1], '2.5.0' );
		$this->assertTrue( $result['success'] ?? false, wp_json_encode( $result ) );
		$this->assertSame( '2.5.0', get_user_meta( $admin, AdminNotices::OUTDATED_DISMISSED_META, true ) );
		$this->assertSame( '', $this->notice( $admin ), 'gone for this person' );
		$other = self::factory_user( 'administrator' );
		$this->assertNotSame( '', $this->notice( $other ), 'other people still see it' );

		// Another installed version brings it back.
		add_action( 'plugins_loaded', 'subtleforms_pro_init', 20 );
		OutdatedAddOnGuard::apply( '2.7.0' );
		$this->assertStringContainsString( 'SubtleForms Pro 2.7.0', $this->notice( $admin ) );
	}

	public function test_dismissing_needs_the_nonce_the_capability_and_the_blocked_version(): void {
		OutdatedAddOnGuard::apply( '2.5.0' );
		$admin = self::factory_user( 'administrator' );
		$this->assertSame( 'bad_nonce', $this->dismiss( $admin, 'nope', '2.5.0' )['error'] ?? '' );
		$nonce = wp_create_nonce( AdminNotices::OUTDATED_DISMISS_ACTION );
		$this->assertFalse( $this->dismiss( $admin, $nonce, '9.9.9' )['success'] ?? true, 'a version that is not blocked is refused' );
		$editor = self::factory_user( 'editor' );
		wp_set_current_user( $editor );
		$this->assertFalse( $this->dismiss( $editor, wp_create_nonce( AdminNotices::OUTDATED_DISMISS_ACTION ), '2.5.0' )['success'] ?? true );
		$this->assertSame( '', (string) get_user_meta( $admin, AdminNotices::OUTDATED_DISMISSED_META, true ) );
		$this->assertSame( '', (string) get_user_meta( $editor, AdminNotices::OUTDATED_DISMISSED_META, true ) );
	}

	/** Run the dismiss handler as AJAX and return the decoded JSON (or an error code). */
	private function dismiss( int $userId, string $nonce, string $version ): array {
		wp_set_current_user( $userId );
		$_POST['nonce']   = $nonce;
		$_POST['version'] = $version;
		$_REQUEST['nonce'] = $nonce;
		$ajax    = static fn() => true;
		$handler = static fn() => static function ( $message ) {
			throw new \RuntimeException( is_string( $message ) ? $message : 'dead' );
		};
		add_filter( 'wp_doing_ajax', $ajax );
		add_filter( 'wp_die_ajax_handler', $handler );
		ob_start();
		$error = '';
		try {
			AdminNotices::dismiss_outdated_add_on_notice();
		} catch ( \RuntimeException $e ) {
			$error = $e->getMessage();
		}
		$out = (string) ob_get_clean();
		remove_filter( 'wp_doing_ajax', $ajax );
		remove_filter( 'wp_die_ajax_handler', $handler );
		unset( $_POST['nonce'], $_POST['version'], $_REQUEST['nonce'] );
		$data = json_decode( $out, true );
		if ( is_array( $data ) ) {
			return $data;
		}
		return array( 'error' => '-1' === $error || '' !== $error ? 'bad_nonce' : '', 'raw' => $out );
	}

}
