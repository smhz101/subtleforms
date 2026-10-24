<?php
// phpcs:disable -- Unit test stubs; not shipped in production plugin.
/**
 * Option stubs for ImportOffer unit tests.
 *
 * @package SubtleForms\Tests
 */

require_once __DIR__ . '/activator-stubs.php';

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $name, $default = false ) {
		if ( ! isset( $GLOBALS['sf_test_options'] ) || ! is_array( $GLOBALS['sf_test_options'] ) ) {
			$GLOBALS['sf_test_options'] = array();
		}
		if ( array_key_exists( $name, $GLOBALS['sf_test_options'] ) ) {
			return $GLOBALS['sf_test_options'][ $name ];
		}
		return $default;
	}
}

if ( ! function_exists( 'add_action' ) ) {
	function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
		return true;
	}
}

if ( ! isset( $GLOBALS['wpdb'] ) ) {
	$GLOBALS['wpdb'] = new SF_Activator_Wpdb();
}
