<?php
// phpcs:disable -- PHPUnit bootstrap; not shipped in production plugin.
defined( 'ABSPATH' ) || define( 'ABSPATH', __DIR__ . '/' );
if ( ! defined( 'ABSPATH' ) ) { exit; }
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

if ( ! function_exists( 'sanitize_text_field' ) ) {
	function sanitize_text_field( $value ) {
		return is_scalar( $value ) ? trim( strip_tags( (string) $value ) ) : '';
	}
}

if ( ! function_exists( 'wp_strip_all_tags' ) ) {
	function wp_strip_all_tags( $value ) {
		return strip_tags( (string) $value );
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $name, $default = false ) {
		return $GLOBALS['sf_test_options'][ $name ] ?? $default;
	}
}

if ( ! function_exists( 'wp_kses_post' ) ) {
	// Rough stand-in: drop script/style blocks and keep simple inline markup.
	function wp_kses_post( $value ) {
		$value = preg_replace( '#<(script|style)[^>]*>.*?</\\1>#is', '', (string) $value );
		return strip_tags( $value, '<b><strong><em><i><a><br><p><ul><ol><li><span>' );
	}
}

if ( ! function_exists( 'esc_url_raw' ) ) {
	function esc_url_raw( $value ) {
		return (string) $value;
	}
}

if ( ! function_exists( 'sanitize_email' ) ) {
	function sanitize_email( $value ) {
		return (string) $value;
	}
}

if ( ! function_exists( 'wp_kses' ) ) {
	function wp_kses( $value, $allowed = array(), $protocols = array() ) {
		return (string) $value;
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {
	/**
	 * Stub: encode using native json_encode so Support classes that call it
	 * (e.g. FormMeta) work in the standalone unit test environment.
	 *
	 * @param mixed $data Data to encode.
	 * @return string|false
	 */
	function wp_json_encode( $data ) {
		return json_encode( $data );
	}
}
