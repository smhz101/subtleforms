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

	private static function factory_user( string $role ): int {
		return (int) wp_insert_user(
			array(
				'user_login' => 'sf105_' . wp_generate_password( 6, false ),
				'user_pass'  => wp_generate_password(),
				'role'       => $role,
			)
		);
	}
}
