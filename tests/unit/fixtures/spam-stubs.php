<?php
// phpcs:disable -- Unit test stubs; not shipped in production plugin.
/**
 * WordPress stand-ins for the spam protection unit tests.
 *
 * @package SubtleForms\Tests
 */

if ( ! function_exists( 'wp_salt' ) ) {
	function wp_salt( $scheme = 'auth' ) {
		return 'unit-test-salt';
	}
}

if ( ! function_exists( 'esc_html__' ) ) {
	function esc_html__( $text, $domain = 'default' ) {
		return $text;
	}
}

if ( ! function_exists( 'get_transient' ) ) {
	function get_transient( $key ) {
		return $GLOBALS['subtleforms_test_transients'][ $key ] ?? false;
	}
}
if ( ! function_exists( 'set_transient' ) ) {
	function set_transient( $key, $value, $ttl = 0 ) {
		$GLOBALS['subtleforms_test_transients'][ $key ] = $value;
		return true;
	}
}
if ( ! function_exists( 'delete_transient' ) ) {
	function delete_transient( $key ) {
		unset( $GLOBALS['subtleforms_test_transients'][ $key ] );
		return true;
	}
}
