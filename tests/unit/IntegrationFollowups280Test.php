<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Free 2.8.0 follow-ups: proxy settings, one IP reader, plugin file hooks,
 * dead admin CSS, and the removed integration panels.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Security\ClientIp;
use SubtleForms\Support\Settings;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\Schemas;

require_once __DIR__ . '/fixtures/security-stubs.php';

final class IntegrationFollowups280Test extends TestCase {

	private static function root(): string {
		return dirname( __DIR__, 2 );
	}

	public function test_proxy_settings_have_defaults_and_rules(): void {
		$this->assertSame( array(), Settings::DEFAULTS['trusted_proxy_cidrs'] );
		$this->assertFalse( Settings::DEFAULTS['trust_cloudflare'] );
		$this->assertArrayHasKey( 'trusted_proxy_cidrs', Settings::VALIDATION_RULES );
		$this->assertArrayHasKey( 'trust_cloudflare', Settings::VALIDATION_RULES );
	}

	public function test_a_proxy_list_is_cleaned_and_bad_entries_are_refused(): void {
		$settings = new Settings();
		$out      = $settings->validate( array( 'trusted_proxy_cidrs' => array( '10.0.0.0/8', ' 192.168.1.5 ', '10.0.0.0/8', '2001:db8::/32' ), 'trust_cloudflare' => '1' ) );
		$this->assertSame( array( '10.0.0.0/8', '192.168.1.5', '2001:db8::/32' ), $out['trusted_proxy_cidrs'] );
		$this->assertTrue( $out['trust_cloudflare'] );

		// One per line is accepted too.
		$out = $settings->validate( array( 'trusted_proxy_cidrs' => "10.0.0.1\n10.0.0.2" ) );
		$this->assertSame( array( '10.0.0.1', '10.0.0.2' ), $out['trusted_proxy_cidrs'] );

		foreach ( array( 'not-an-ip', '10.0.0.0/33', '2001:db8::/129', '10.0.0.0/abc', '1.2.3' ) as $bad ) {
			try {
				$settings->validate( array( 'trusted_proxy_cidrs' => array( $bad ) ) );
				$this->fail( "{$bad} should be refused" );
			} catch ( \InvalidArgumentException $e ) {
				$this->assertStringContainsString( 'trusted_proxy_cidrs', $e->getMessage() );
			}
		}
	}

	public function test_valid_range(): void {
		$this->assertTrue( ClientIp::valid_range( '10.0.0.0/8' ) );
		$this->assertTrue( ClientIp::valid_range( '203.0.113.9' ) );
		$this->assertTrue( ClientIp::valid_range( '2606:4700::/32' ) );
		$this->assertFalse( ClientIp::valid_range( '10.0.0.0/40' ) );
		$this->assertFalse( ClientIp::valid_range( '' ) );
	}

	public function test_settings_schema_accepts_the_proxy_keys(): void {
		$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
		$out       = $validator->validateOrFail( array( 'trusted_proxy_cidrs' => array( '10.0.0.0/8' ), 'trust_cloudflare' => true ), Schemas::get( Schemas::SETTINGS_UPDATE ) );
		$this->assertSame( array( '10.0.0.0/8' ), $out['trusted_proxy_cidrs'] );
		$this->assertTrue( $out['trust_cloudflare'] );
	}

	public function test_only_client_ip_reads_remote_addr(): void {
		$offenders = array();
		$iterator  = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( self::root() . '/src', \FilesystemIterator::SKIP_DOTS ) );
		foreach ( $iterator as $file ) {
			if ( 'php' !== $file->getExtension() || 'ClientIp.php' === $file->getFilename() ) {
				continue;
			}
			$code = (string) file_get_contents( $file->getPathname() );
			if ( false !== strpos( $code, 'REMOTE_ADDR' ) ) {
				$offenders[] = str_replace( self::root() . '/', '', $file->getPathname() );
			}
		}
		$this->assertSame( array(), $offenders, 'Use ClientIp::get() instead of REMOTE_ADDR' );
	}

	public function test_plugin_file_docblock_version_matches_the_plugin_version(): void {
		$main = (string) file_get_contents( self::root() . '/subtleforms.php' );
		preg_match( "/define\( 'SUBTLEFORMS_VERSION', '([^']+)' \)/", $main, $constant );
		preg_match( '/^ \* Version: (\S+)/m', $main, $header );
		preg_match( '/@package SubtleForms\s+\* @version (\S+)/', $main, $docblock );
		$this->assertSame( $constant[1], $header[1] );
		$this->assertSame( $constant[1], $docblock[1], 'docblock @version matches the plugin version' );
	}

	public function test_the_schema_check_runs_on_admin_init_and_on_plugins_loaded(): void {
		$main = (string) file_get_contents( self::root() . '/subtleforms.php' );
		$this->assertStringContainsString( 'SubtleForms\Activator::maybe_upgrade();', $main );
		$this->assertMatchesRegularExpression( "/add_action\(\s*'admin_init',\s*function \(\) \{\s*SubtleForms\\\\Activator::maybe_upgrade\(\);/", $main );
	}

	public function test_the_dead_admin_stylesheets_are_gone(): void {
		$this->assertFileDoesNotExist( self::root() . '/assets/css/admin.css' );
		$this->assertFileDoesNotExist( self::root() . '/assets/css/admin-builder.css' );
		$menu = (string) file_get_contents( self::root() . '/src/Admin/AdminMenu.php' );
		$this->assertStringNotContainsString( 'admin.css', $menu );
		$this->assertStringNotContainsString( 'admin-builder.css', $menu );
		// What the style still did lives in the compiled admin stylesheet.
		$this->assertStringContainsString( 'box-sizing: border-box', (string) file_get_contents( self::root() . '/resources/admin/styles/_design-system.scss' ) );
		$this->assertStringContainsString( '.subtleforms-row-actions', (string) file_get_contents( self::root() . '/resources/admin/components/DataTable.scss' ) );
	}

	public function test_the_settings_panels_of_removed_integrations_are_gone(): void {
		foreach ( array( 'Crm', 'Ecommerce', 'EmailMarketing', 'Multilanguage', 'Payments', 'Pdf' ) as $name ) {
			$this->assertFileDoesNotExist( self::root() . "/resources/admin/components/settings/extensions/{$name}Panel.jsx" );
		}
		$this->assertFileExists( self::root() . '/resources/admin/components/settings/extensions/WebhooksPanel.jsx' );
	}
}
