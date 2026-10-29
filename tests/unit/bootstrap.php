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
		// A test can register one callback per hook here.
		if ( isset( $GLOBALS['sf_test_filters'][ $hook ] ) && is_callable( $GLOBALS['sf_test_filters'][ $hook ] ) ) {
			return $GLOBALS['sf_test_filters'][ $hook ]( $value, ...$args );
		}
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

if ( ! function_exists( '_n' ) ) {
	function _n( string $single, string $plural, $number, string $domain = 'default' ): string {
		return 1 === (int) $number ? $single : $plural;
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
	function wp_strip_all_tags( $value, $remove_breaks = false ) {
		$value = preg_replace( '@<(script|style)[^>]*?>.*?</\1>@si', '', (string) $value );
		$value = strip_tags( $value );
		if ( $remove_breaks ) {
			$value = preg_replace( '/[\r\n\t ]+/', ' ', $value );
		}
		return trim( $value );
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

if ( ! function_exists( 'is_email' ) ) {
	function is_email( $value ) {
		return (bool) filter_var( (string) $value, FILTER_VALIDATE_EMAIL );
	}
}

if ( ! function_exists( 'absint' ) ) {
	function absint( $value ) {
		return abs( (int) $value );
	}
}

if ( ! defined( 'SUBTLEFORMS_VERSION' ) ) {
	define( 'SUBTLEFORMS_VERSION', 'test' );
}

if ( ! function_exists( 'wp_kses' ) ) {
	/**
	 * Stub: drop script/style, keep only tags present as keys in $allowed.
	 */
	function wp_kses( $value, $allowed = array(), $protocols = array() ) {
		$value = preg_replace( '#<(script|style)[^>]*>.*?</\1>#is', '', (string) $value );
		if ( ! is_array( $allowed ) || array() === $allowed ) {
			return trim( strip_tags( $value ) );
		}
		$tag_list = '<' . implode( '><', array_map( 'strval', array_keys( $allowed ) ) ) . '>';
		return trim( strip_tags( $value, $tag_list ) );
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

if ( ! function_exists( 'sanitize_key' ) ) {
	function sanitize_key( $key ): string {
		$key = strtolower( (string) $key );
		return (string) preg_replace( '/[^a-z0-9_\-]/', '', $key );
	}
}

if ( ! function_exists( 'esc_attr' ) ) {
	function esc_attr( $text ): string {
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'get_locale' ) ) {
	function get_locale(): string {
		return 'en_US';
	}
}

if ( ! function_exists( 'get_option' ) ) {
	function get_option( $option, $default = false ) {
		return $default;
	}
}

if ( ! function_exists( 'wp_unslash' ) ) {
	function wp_unslash( $value ) {
		if ( is_array( $value ) ) {
			return array_map( 'wp_unslash', $value );
		}
		return is_string( $value ) ? stripslashes( $value ) : $value;
	}
}


if ( ! function_exists( 'wp_verify_nonce' ) ) {
	/**
	 * Stub shared by Package B/C unit tests.
	 * Prefer `$GLOBALS['sf_test_nonce']` when set; else Package B `sf_test_nonce_ok`.
	 */
	function wp_verify_nonce( $nonce, $action = -1 ) {
		$GLOBALS['sf_test_last_verified_nonce'] = array( 'nonce' => $nonce, 'action' => $action );
		if ( isset( $GLOBALS['sf_test_nonce'] ) ) {
			return is_string( $nonce ) && $nonce === $GLOBALS['sf_test_nonce'] ? 1 : false;
		}
		if ( array_key_exists( 'sf_test_nonce_ok', $GLOBALS ) ) {
			return ! empty( $GLOBALS['sf_test_nonce_ok'] ) && 'wp_rest' === $action && 'good-nonce' === $nonce;
		}
		return is_string( $nonce ) && 'valid-nonce' === $nonce ? 1 : false;
	}
}

if ( ! function_exists( 'wp_parse_url' ) ) {
	function wp_parse_url( $url, $component = -1 ) {
		return parse_url( (string) $url, $component );
	}
}

if ( ! function_exists( 'rest_get_url_prefix' ) ) {
	function rest_get_url_prefix() {
		return $GLOBALS['sf_test_rest_prefix'] ?? 'wp-json';
	}
}
