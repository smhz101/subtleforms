<?php
/**
 * WordPress.org guidelines 5 and 11: this plugin is complete on its own.
 *
 * No licence handling, no locked or upgrade-gated controls, no checks on
 * whether an add-on feature is "allowed", and admin notices only about this
 * plugin's own state.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Contracts\ExtensionInterface;
use SubtleForms\Extensions\ExtensionManager;
use SubtleForms\Support\Capabilities;
use SubtleForms\Support\FeatureGate;

/**
 * @coversNothing
 */
final class WporgComplianceTest extends TestCase {

	private static function root(): string {
		return dirname( __DIR__, 2 );
	}

	/** @return string[] Every shipped PHP file. */
	private static function phpFiles(): array {
		$files = array( self::root() . '/subtleforms.php', self::root() . '/uninstall.php' );
		foreach ( array( 'src', 'templates' ) as $dir ) {
			$it = new \RecursiveIteratorIterator( new \RecursiveDirectoryIterator( self::root() . '/' . $dir, \FilesystemIterator::SKIP_DOTS ) );
			foreach ( $it as $file ) {
				if ( $file->isFile() && 'php' === $file->getExtension() ) {
					$files[] = $file->getPathname();
				}
			}
		}
		return $files;
	}

	public function test_no_licence_words_in_shipped_php(): void {
		foreach ( self::phpFiles() as $file ) {
			foreach ( file( $file ) as $n => $line ) {
				// The plugin header names the GPL; that is the only allowed use.
				if ( preg_match( '/License(?: URI)?:\s|GPL/i', $line ) ) {
					continue;
				}
				$this->assertDoesNotMatchRegularExpression( '/licen[cs]/i', $line, basename( $file ) . ':' . ( $n + 1 ) );
			}
		}
	}

	public function test_no_upgrade_or_locked_wording_in_shipped_php(): void {
		foreach ( self::phpFiles() as $file ) {
			$source = (string) file_get_contents( $file );
			foreach ( array( 'is_locked', 'pro_placeholder', 'pro_notice', 'requiresPro', 'Upgrade to', 'Go Pro', 'unlock' ) as $word ) {
				$this->assertStringNotContainsString( $word, $source, basename( $file ) . " has '{$word}'" );
			}
		}
	}

	public function test_admin_boot_data_has_no_licence_keys(): void {
		$source = (string) file_get_contents( self::root() . '/src/Admin/AdminMenu.php' );
		$this->assertStringNotContainsString( 'license_data', $source );
		$this->assertStringNotContainsString( 'showLicense', $source );
		$this->assertStringNotContainsString( "'subscription'", $source );
		$this->assertStringContainsString( "'moreFeatures'", $source );
	}

	public function test_the_more_features_card_is_dismissed_per_user(): void {
		$menu = (string) file_get_contents( self::root() . '/src/Admin/AdminMenu.php' );
		$api  = (string) file_get_contents( self::root() . '/src/Api/OnboardingApi.php' );
		$this->assertStringContainsString( "MORE_FEATURES_META = 'subtleforms_more_features_dismissed'", $menu );
		$this->assertStringContainsString( "'/more-features/dismiss'", $api );
		$this->assertStringContainsString( 'update_user_meta( $user_id, \\SubtleForms\\Admin\\AdminMenu::MORE_FEATURES_META, true )', $api );
		$this->assertMatchesRegularExpression( "/'\\/more-features\\/dismiss',\\s*array\\(\\s*'methods'\\s*=> 'POST',\\s*'callback'\\s*=> array\\( \\\$this, 'dismiss_more_features' \\),\\s*'permission_callback' => array\\( \\\$this, 'check_write_permission' \\)/", $api );
	}

	public function test_admin_notices_come_only_from_the_plugin_own_notices(): void {
		foreach ( self::phpFiles() as $file ) {
			$source = (string) file_get_contents( $file );
			if ( false !== strpos( $source, "'admin_notices'" ) || false !== strpos( $source, "'all_admin_notices'" ) || false !== strpos( $source, "'network_admin_notices'" ) ) {
				$this->assertSame( 'AdminNotices.php', basename( $file ) );
			}
		}
		$notices = (string) file_get_contents( self::root() . '/src/Admin/AdminNotices.php' );
		$this->assertStringContainsString( "strpos( \$screen->id, 'subtleforms' ) === false", $notices, 'Notices are limited to SubtleForms screens.' );
	}

	public function test_extensions_are_registered_whatever_the_capability_map_says(): void {
		$ext = new class() implements ExtensionInterface {
			public bool $registered = false;
			public function slug(): string {
				return 'demo';
			}
			public function register(): void {
				$this->registered = true;
			}
			public function requiredCapabilities(): array {
				return array( 'extensions.demo' );
			}
		};
		$manager = new ExtensionManager( new FeatureGate( new Capabilities( array( 'extensions.demo' => false ) ) ) );
		$manager->add( $ext );
		$manager->boot();
		$this->assertTrue( $ext->registered );
	}

	public function test_templates_and_fields_carry_no_lock_flags(): void {
		$fields = (string) file_get_contents( self::root() . '/src/Api/FieldsApi.php' );
		$this->assertStringNotContainsString( "'is_pro'", $fields );
		$this->assertStringNotContainsString( 'templates.pro', $fields );
	}
}
