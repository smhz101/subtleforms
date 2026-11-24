<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * The uploads exposure check reads a probe response correctly and builds the
 * nginx rule for the folder (issue 169).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Uploads\UploadsExposure;

final class UploadsExposure169Test extends TestCase {

	private const PROBE = 'subtleforms-probe-0011223344556677';

	public function test_probe_text_returned_means_exposed(): void {
		$this->assertSame( UploadsExposure::EXPOSED, UploadsExposure::classify( 200, self::PROBE, self::PROBE ) );
		$this->assertSame( UploadsExposure::EXPOSED, UploadsExposure::classify( 200, self::PROBE . "\n", self::PROBE ) );
	}

	public function test_refusal_or_not_found_means_protected(): void {
		foreach ( array( 401, 403, 404, 410 ) as $code ) {
			$this->assertSame( UploadsExposure::PROTECTED, UploadsExposure::classify( $code, 'Forbidden', self::PROBE ), (string) $code );
		}
	}

	public function test_other_pages_are_unknown_not_exposed(): void {
		// A 200 that is not the probe text, such as a theme's 404 page served
		// with status 200, must not be read as exposed.
		$this->assertSame( UploadsExposure::UNKNOWN, UploadsExposure::classify( 200, '<html>Page not found</html>', self::PROBE ) );
		$this->assertSame( UploadsExposure::UNKNOWN, UploadsExposure::classify( 500, '', self::PROBE ) );
		$this->assertSame( UploadsExposure::UNKNOWN, UploadsExposure::classify( 301, '', self::PROBE ) );
	}

	public function test_result_is_rechecked_after_a_day_and_kept_until_then(): void {
		$now = 1800000000;
		$this->assertTrue( UploadsExposure::isStale( null, $now ), 'no result yet' );
		$this->assertFalse( UploadsExposure::isStale( array( 'status' => 'exposed', 'checked' => $now - 3600 ), $now ) );
		$this->assertTrue( UploadsExposure::isStale( array( 'status' => 'exposed', 'checked' => $now - UploadsExposure::RECHECK_AFTER ), $now ) );
	}

	public function test_nginx_rule_blocks_the_folder_path(): void {
		$rule = UploadsExposure::nginxRule( '/wp-content/uploads/subtleforms-uploads-abcdef0123456789/' );
		$this->assertStringContainsString( 'location ^~ /wp-content/uploads/subtleforms-uploads-abcdef0123456789/ {', $rule );
		$this->assertStringContainsString( 'deny all;', $rule );
	}
}
