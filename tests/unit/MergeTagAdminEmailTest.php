<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * {admin_email} follows the plugin's admin email setting (GH119-02).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\MergeTags;

final class MergeTagAdminEmailTest extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['sf_test_options'] );
		parent::tearDown();
	}

	public function test_uses_the_plugin_setting_when_set(): void {
		$GLOBALS['sf_test_options'] = array(
			'admin_email'          => 'wp@example.com',
			'subtleforms_settings' => array( 'admin_email' => 'team@example.com' ),
		);
		$this->assertSame( 'team@example.com', MergeTags::render( '{admin_email}', array() ) );
	}

	public function test_falls_back_to_the_wordpress_email(): void {
		$GLOBALS['sf_test_options'] = array( 'admin_email' => 'wp@example.com' );
		$this->assertSame( 'wp@example.com', MergeTags::render( '{admin_email}', array() ) );
	}
}
