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
