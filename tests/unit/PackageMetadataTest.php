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
}
