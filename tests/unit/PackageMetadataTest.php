<?php
/**
 * Version and licence files that must agree or ship with the plugin (PKG-01, PKG-05).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class PackageMetadataTest extends TestCase {

	private static function root(): string {
		return dirname( __DIR__, 2 );
	}

	/** PKG-01: the block metadata version is the plugin version. */
	public function test_block_json_version_matches_plugin_version(): void {
		$main = (string) file_get_contents( self::root() . '/subtleforms.php' );
		$this->assertSame( 1, preg_match( '/^\s*\*\s*Version:\s*(\S+)/m', $main, $plugin ), 'Plugin header has a Version.' );
		$block = json_decode( (string) file_get_contents( self::root() . '/resources/blocks/form/block.json' ), true );
		$this->assertIsArray( $block );
		$this->assertSame( $plugin[1], $block['version'] ?? null, 'resources/blocks/form/block.json version equals the plugin Version.' );
	}

	/** PKG-05: the GPL text is in the repository root. */
	public function test_license_file_holds_the_gpl_text(): void {
		$file = self::root() . '/license.txt';
		$this->assertFileExists( $file );
		$text = (string) file_get_contents( $file );
		$this->assertStringContainsString( 'GNU GENERAL PUBLIC LICENSE', $text );
		$this->assertStringContainsString( 'Version 2, June 1991', $text );
	}

	/** PKG-05: the licence file is not excluded from the WordPress.org release. */
	public function test_license_and_notices_are_not_in_distignore(): void {
		$ignore = (string) file_get_contents( self::root() . '/.distignore' );
		$this->assertDoesNotMatchRegularExpression( '/^\s*(license\.txt|THIRD-PARTY-NOTICES\.txt)\s*$/m', $ignore );
	}
}
