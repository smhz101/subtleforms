<?php
// phpcs:disable -- Unit test stub; not shipped in production plugin.
/**
 * Stand-in for wp-admin/includes/upgrade.php in unit tests, which load
 * ABSPATH from tests/unit/. Records the tables Activator asks for.
 *
 * @package SubtleForms\Tests
 */

if ( ! function_exists( 'dbDelta' ) ) {
	function dbDelta( $queries = '', $execute = true ) {
		$GLOBALS['sf_test_dbdelta'][] = $queries;
		return array();
	}
}
