<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Which paths the admin preload accepts.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Admin\AdminPreload;

final class AdminPreloadPathsTest extends TestCase {

	public function test_only_plugin_routes_pass() {
		$out = AdminPreload::acceptable(
			array(
				'/subtleforms/v1/analytics/summary?days=30',
				'/subtleforms/v1/analytics/summary?days=30',
				'/wp/v2/users',
				'/subtleforms/v2/forms',
				'//evil.test/subtleforms/v1/x',
				'/subtleforms/v1/../wp/v2/users',
				'/subtleforms/v1/',
				"/subtleforms/v1/forms\n",
				'/subtleforms/v1/a b',
				'/subtleforms/v1/a#frag',
				7,
				null,
				array(),
			)
		);
		$this->assertSame( array( '/subtleforms/v1/analytics/summary?days=30', '/subtleforms/v1/forms' ), $out );
	}

	public function test_a_non_array_gives_nothing_and_the_count_is_capped() {
		$this->assertSame( array(), AdminPreload::acceptable( 'x' ) );
		$many = array();
		for ( $i = 0; $i < 40; $i++ ) {
			$many[] = '/subtleforms/v1/r' . $i;
		}
		$this->assertCount( AdminPreload::MAX_PATHS, AdminPreload::acceptable( $many ) );
	}

	public function test_the_forms_screen_has_a_default_path_and_others_none() {
		$this->assertCount( 1, AdminPreload::defaultPaths( 'subtleforms-forms' ) );
		$this->assertSame( array(), AdminPreload::defaultPaths( 'subtleforms-reports' ) );
		$this->assertSame( array(), AdminPreload::defaultPaths( 'subtleforms' ) );
	}

	public function test_the_settings_screen_preloads_the_settings_and_the_email_marketing_state() {
		$this->assertSame(
			array( '/subtleforms/v1/settings', '/subtleforms/v1/integrations/email-marketing' ),
			AdminPreload::defaultPaths( 'subtleforms-settings' )
		);
	}
}
