<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Regression checks for package F239-2.
 *
 * @package SubtleForms\Tests
 */

use SubtleForms\Support\Settings;
use SubtleForms\Support\Uninstaller;

if ( ! function_exists( 'update_option' ) ) {
	function update_option( $name, $value, $autoload = null ) {
		$GLOBALS['sf_test_options'][ $name ] = $value;
		return true;
	}
}

if ( ! function_exists( 'is_multisite' ) ) {
	function is_multisite() {
		return ! empty( $GLOBALS['sf_test_multisite'] );
	}
}

if ( ! function_exists( 'get_sites' ) ) {
	function get_sites( $args = array() ) {
		return $GLOBALS['sf_test_sites'] ?? array();
	}
}

if ( ! function_exists( 'switch_to_blog' ) ) {
	function switch_to_blog( $blog_id ) {
		$GLOBALS['sf_test_switched'][] = (int) $blog_id;
	}
}

if ( ! function_exists( 'restore_current_blog' ) ) {
	function restore_current_blog() {
		$GLOBALS['sf_test_restored'] = ( $GLOBALS['sf_test_restored'] ?? 0 ) + 1;
	}
}

if ( ! function_exists( '_get_cron_array' ) ) {
	function _get_cron_array() {
		return $GLOBALS['sf_test_cron'] ?? array();
	}
}

if ( ! function_exists( 'wp_clear_scheduled_hook' ) ) {
	function wp_clear_scheduled_hook( $hook, $args = array() ) {
		$GLOBALS['sf_test_cleared'][] = $hook;
	}
}

if ( ! function_exists( 'wp_upload_dir' ) ) {
	function wp_upload_dir( $time = null, $create = true ) {
		return array( 'basedir' => sys_get_temp_dir() );
	}
}

if ( ! function_exists( 'trailingslashit' ) ) {
	function trailingslashit( $string ) {
		return rtrim( (string) $string, '/\\' ) . '/';
	}
}

if ( ! function_exists( 'flush_rewrite_rules' ) ) {
	function flush_rewrite_rules( $hard = true ) {}
}

/**
 * Fake database for uninstall assertions.
 */
class F2392_Wpdb {
	public $prefix = 'wp_';
	public $options = 'wp_options';
	public $usermeta = 'wp_usermeta';
	public $sitemeta = 'wp_sitemeta';
	public $queries = array();
	public $tables = array(
		'wp_subtleforms_forms',
		'wp_subtleforms_api_logs',
		'wp_subtleforms_coupons',
		'wp_subtleforms_coupon_uses',
	);

	public function esc_like( $text ) {
		return addcslashes( (string) $text, '_%\\' );
	}

	public function prepare( $query, ...$args ) {
		foreach ( $args as $arg ) {
			$query = preg_replace( '/%s/', "'" . $arg . "'", $query, 1 );
		}
		return $query;
	}

	public function get_col( $sql ) {
		$this->queries[] = $sql;
		return $this->tables;
	}

	public function query( $sql ) {
		$this->queries[] = $sql;
		return 1;
	}
}

class Release239Test extends PHPUnit\Framework\TestCase {

	private $root;

	protected function setUp(): void {
		$this->root = dirname( __DIR__, 2 );
		$GLOBALS['sf_test_options'] = array();
		$GLOBALS['sf_test_multisite'] = false;
		$GLOBALS['sf_test_sites'] = array();
		$GLOBALS['sf_test_switched'] = array();
		$GLOBALS['sf_test_restored'] = 0;
		$GLOBALS['sf_test_cron'] = array();
		$GLOBALS['sf_test_cleared'] = array();
		$GLOBALS['wpdb'] = new F2392_Wpdb();
	}

	public function test_ai_tab_is_gone_and_stored_keys_are_removed(): void {
		$this->assertFileDoesNotExist( $this->root . '/resources/admin/components/settings/AISettings.jsx' );
		$page = file_get_contents( $this->root . '/resources/admin/pages/SettingsPage.jsx' );
		$this->assertStringNotContainsString( 'AI assistant', $page );
		$this->assertStringNotContainsString( 'AISettings', $page );

		$GLOBALS['sf_test_options']['subtleforms_settings'] = array(
			'ai_api_key'  => 'secret',
			'ai_provider' => 'openai',
			'debug_mode'  => false,
		);
		Settings::remove_ai_options();
		$stored = get_option( 'subtleforms_settings' );
		$this->assertArrayNotHasKey( 'ai_api_key', $stored );
		$this->assertArrayNotHasKey( 'ai_provider', $stored );
		$this->assertFalse( $stored['debug_mode'] );
		$activator = file_get_contents( $this->root . '/src/Activator.php' );
		$this->assertStringContainsString( 'Settings::remove_ai_options()', $activator );
	}

	public function test_readme_wordpress_org_hygiene(): void {
		$readme = file_get_contents( $this->root . '/readme.txt' );
		$this->assertStringContainsString( 'Contributors: smhz101', $readme );
		$this->assertStringContainsString( 'Requires at least: 6.6', $readme );
		$this->assertStringContainsString( '== External services ==', $readme );
		$this->assertStringContainsString( 'changelog.txt', $readme );
		$this->assertFileExists( $this->root . '/changelog.txt' );
		$this->assertStringContainsString( '= 2.3.3 -', file_get_contents( $this->root . '/changelog.txt' ) );
		$header = file_get_contents( $this->root . '/subtleforms.php' );
		$this->assertStringContainsString( 'Requires at least: 6.6', $header );
		$this->assertStringNotContainsString( 'wp_die', $header );
		$this->assertStringContainsString( "version_compare( \$wp_version, '6.6', '<' )", file_get_contents( $this->root . '/src/Activator.php' ) );
	}

	public function test_dist_excludes_dev_files_and_rebuilds(): void {
		$gulp = file_get_contents( $this->root . '/gulpfile.js' );
		$this->assertStringContainsString( 'npm run build:all', $gulp );
		$this->assertStringContainsString( 'assertBuildFresh', $gulp );
		$this->assertStringContainsString( 'composer install --no-dev --optimize-autoloader', $gulp );
		$this->assertStringContainsString( '!src/Validation/EXAMPLES.php', $gulp );
		$this->assertStringContainsString( '!build/**/*.map', $gulp );
		$this->assertStringContainsString( '!assets/README.md', $gulp );
		$this->assertStringContainsString( 'changelog.txt', $gulp );
		$ignore = file_get_contents( $this->root . '/.distignore' );
		$this->assertStringContainsString( 'docs/', $ignore );
		$this->assertStringContainsString( '.cursor/', $ignore );
		$this->assertStringNotContainsString( "\ncomposer.json\n", "\n" . $ignore . "\n" );
		$pkg = json_decode( file_get_contents( $this->root . '/package.json' ), true );
		$this->assertStringContainsString( 'make-json', $pkg['scripts']['i18n'] );
	}

	public function test_uninstall_clears_every_site_and_can_keep_data(): void {
		$GLOBALS['sf_test_cron'] = array(
			time() => array(
				'subtleforms_async_email' => array(
					array( 'args' => array( 'job' => 1 ) ),
				),
			),
		);
		Uninstaller::clean_site();
		$sql = implode( "\n", $GLOBALS['wpdb']->queries );
		$this->assertStringContainsString( 'DROP TABLE IF EXISTS wp_subtleforms_api_logs', $sql );
		$this->assertStringContainsString( 'DROP TABLE IF EXISTS wp_subtleforms_coupons', $sql );
		$this->assertStringContainsString( 'DROP TABLE IF EXISTS wp_subtleforms_coupon_uses', $sql );
		$this->assertStringContainsString( 'subtleforms', $sql );
		$this->assertContains( 'subtleforms_async_email', $GLOBALS['sf_test_cleared'] );

		$GLOBALS['wpdb']->queries = array();
		$GLOBALS['sf_test_options']['subtleforms_settings'] = array( 'keep_data_on_uninstall' => true );
		Uninstaller::clean_site();
		$this->assertSame( array(), $GLOBALS['wpdb']->queries );

		$GLOBALS['sf_test_options']['subtleforms_settings'] = array();
		$GLOBALS['sf_test_multisite'] = true;
		$GLOBALS['sf_test_sites'] = array( 2, 4 );
		Uninstaller::run();
		$this->assertSame( array( 2, 4 ), $GLOBALS['sf_test_switched'] );
		$this->assertSame( 2, $GLOBALS['sf_test_restored'] );
	}

	public function test_php_files_exit_when_accessed_directly(): void {
		$missing = array();
		$iterator = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $this->root . '/src' ) );
		foreach ( $iterator as $file ) {
			if ( $file->getExtension() !== 'php' ) {
				continue;
			}
			$contents = file_get_contents( $file->getPathname() );
			if ( strpos( $contents, "defined( 'ABSPATH' )" ) === false ) {
				$missing[] = $file->getPathname();
			}
		}
		$this->assertSame( array(), $missing );
		$main = file_get_contents( $this->root . '/subtleforms.php' );
		$this->assertMatchesRegularExpression( "/if \\( ! defined\\( 'ABSPATH' \\) \\) \\{\\s*exit;\\s*\\}/", $main );
	}

	public function test_admin_styles_and_preview_do_not_fire_front_end_hooks(): void {
		$menu = file_get_contents( $this->root . '/src/Admin/AdminMenu.php' );
		$this->assertStringNotContainsString( 'subtleforms-menu-icon">', $menu );
		$this->assertStringContainsString( 'wp_add_inline_style', $menu );
		$this->assertStringNotContainsString( "do_action( 'wp_enqueue_scripts' )", $menu );
		$this->assertStringContainsString( 'wp_get_global_stylesheet', $menu );
		$this->assertStringContainsString( "wp_set_script_translations( 'subtleforms-admin'", $menu );
		$front = file_get_contents( $this->root . '/src/Frontend/FrontendAssets.php' );
		$this->assertStringContainsString( "wp_set_script_translations( 'subtleforms-frontend'", $front );
		$block = file_get_contents( $this->root . '/src/Blocks/SubtleFormsBlock.php' );
		$this->assertStringContainsString( 'wp_set_script_translations', $block );
	}

	public function test_normal_events_are_not_logged_as_errors(): void {
		$async = file_get_contents( $this->root . '/src/Async/AsyncDispatcher.php' );
		$this->assertStringContainsString( 'Logger::info', $async );
		$this->assertStringNotContainsString( "Logger::error( \"[SubtleForms Async]", $async );
		$guards = file_get_contents( $this->root . '/src/Api/ApiGuards.php' );
		$this->assertStringNotContainsString( 'error_log(', $guards );
		$this->assertStringContainsString( 'Logger::debug', $guards );
	}
}
