<?php
/**
 * PHPUnit bootstrap for standalone unit tests.
 *
 * Loads the Composer autoloader and provides minimal WP stubs so that
 * classes which call apply_filters / do_action can be tested without
 * a full WordPress environment.
 *
 * For integration tests that need WordPress, use tests/bootstrap.php.
 *
 * @package SubtleForms\Tests
 * @since   1.9.0
 */

// Composer autoloader.
require_once dirname( __DIR__, 2 ) . '/vendor/autoload.php';

// ── Minimal WordPress stubs ────────────────────────────────────────────
// Only define if they don't already exist (e.g. WP test suite loaded).

if ( ! function_exists( 'apply_filters' ) ) {
	/**
	 * Stub: returns the first argument unchanged (no filter pipeline).
	 */
	function apply_filters( string $hook, $value, ...$args ) {
		return $value;
	}
}

if ( ! function_exists( 'do_action' ) ) {
	/**
	 * Stub: no-op.
	 */
	function do_action( string $hook, ...$args ): void {}
}

if ( ! function_exists( '__' ) ) {
	function __( string $text, string $domain = 'default' ): string {
		return $text;
	}
}

if ( ! function_exists( 'esc_html' ) ) {
	function esc_html( string $text ): string {
		return htmlspecialchars( $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {
	function wp_parse_args( $args, $defaults = array() ) {
		if ( is_object( $args ) ) {
			$args = get_object_vars( $args );
		}
		return array_merge( $defaults, (array) $args );
	}
}
