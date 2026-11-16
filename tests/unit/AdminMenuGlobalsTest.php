<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * fix_admin_globals() must not turn an unset $submenu_file into a string.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Admin\AdminMenu;

final class AdminMenuGlobalsTest extends TestCase {

	public function test_null_submenu_file_stays_null_and_set_values_stay_strings() {
		global $title, $parent_file, $submenu_file;
		$title        = 'SubtleForms';
		$parent_file  = null;
		$submenu_file = null;

		$menu = ( new \ReflectionClass( AdminMenu::class ) )->newInstanceWithoutConstructor();
		$menu->fix_admin_globals();
		$this->assertNull( $parent_file );
		$this->assertNull( $submenu_file );

		$parent_file  = 'subtleforms';
		$submenu_file = 'subtleforms-forms';
		$menu->fix_admin_globals();
		$this->assertSame( 'subtleforms', $parent_file );
		$this->assertSame( 'subtleforms-forms', $submenu_file );
	}
}
