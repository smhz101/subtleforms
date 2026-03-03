<?php
/**
 * Sanitizer
 *
 * Safe sanitization utilities for user input with WordPress integration.
 * Handles nested arrays, JSON, and common field types.
 *
 * @package SubtleForms\Validation
 * @since 1.9.0 (Phase A2-P1)
 */

namespace SubtleForms\Validation;

/**
 * Sanitizer class
 *
 * Provides safe sanitization functions for various data types.
 * Uses WordPress sanitization functions when available.
 */
class Sanitizer {

	/**
	 * Maximum depth for recursive sanitization
	 *
	 * @var int
	 */
	const MAX_DEPTH = 8;

	/**
	 * Maximum bytes for JSON strings
	 *
	 * @var int
	 */
	const MAX_JSON_BYTES = 200000; // 200KB

	/**
	 * Sanitize text field
	 *
	 * @param mixed $value Value to sanitize
	 * @return string
	 */
	public static function sanitizeText( $value ): string {
		if ( is_array( $value ) || is_object( $value ) ) {
			return '';
		}

		$text = (string) $value;

		// Use WordPress sanitizer if available
		if ( function_exists( 'sanitize_text_field' ) ) {
			return sanitize_text_field( $text );
		}

		// Fallback: strip tags and normalize whitespace
		$text = wp_strip_all_tags( $text );
		$text = trim( $text );
		return $text;
	}

	/**
	 * Sanitize email address
	 *
	 * @param mixed $value Value to sanitize
	 * @return string
	 */
	public static function sanitizeEmail( $value ): string {
		if ( is_array( $value ) || is_object( $value ) ) {
			return '';
		}

		$email = (string) $value;

		// Use WordPress sanitizer if available
		if ( function_exists( 'sanitize_email' ) ) {
			return sanitize_email( $email );
		}

		// Fallback: basic email sanitization
		$email = trim( strtolower( $email ) );
		$email = filter_var( $email, FILTER_SANITIZE_EMAIL );
		return $email ?: '';
	}

	/**
	 * Sanitize URL
	 *
	 * @param mixed $value Value to sanitize
	 * @return string
	 */
	public static function sanitizeUrl( $value ): string {
		if ( is_array( $value ) || is_object( $value ) ) {
			return '';
		}

		$url = (string) $value;

		// Use WordPress sanitizer if available
		if ( function_exists( 'esc_url_raw' ) ) {
			return esc_url_raw( $url );
		}

		// Fallback: basic URL sanitization
		$url = trim( $url );
		$url = filter_var( $url, FILTER_SANITIZE_URL );
		return $url ?: '';
	}

	/**
	 * Sanitize boolean value
	 *
	 * @param mixed $value Value to sanitize
	 * @return bool
	 */
	public static function sanitizeBool( $value ): bool {
		if ( is_bool( $value ) ) {
			return $value;
		}

		if ( is_numeric( $value ) ) {
			return (bool) $value;
		}

		if ( is_string( $value ) ) {
			$lower = strtolower( trim( $value ) );
			return in_array( $lower, array( 'true', '1', 'yes', 'on' ), true );
		}

		return false;
	}

	/**
	 * Sanitize integer value
	 *
	 * @param mixed $value Value to sanitize
	 * @return int
	 */
	public static function sanitizeInt( $value ): int {
		if ( is_int( $value ) ) {
			return $value;
		}

		if ( is_numeric( $value ) ) {
			return (int) $value;
		}

		return 0;
	}

	/**
	 * Sanitize float value
	 *
	 * @param mixed $value Value to sanitize
	 * @return float
	 */
	public static function sanitizeFloat( $value ): float {
		if ( is_float( $value ) ) {
			return $value;
		}

		if ( is_numeric( $value ) ) {
			return (float) $value;
		}

		return 0.0;
	}

	/**
	 * Sanitize array deeply with recursion protection
	 *
	 * @param mixed $arr Value to sanitize (should be array)
	 * @param int   $depth Current recursion depth
	 * @param int   $maxDepth Maximum allowed depth
	 * @return array
	 */
	public static function sanitizeArrayDeep( $arr, int $depth = 0, int $maxDepth = self::MAX_DEPTH ): array {
		if ( ! is_array( $arr ) ) {
			return array();
		}

		// Prevent infinite recursion
		if ( $depth >= $maxDepth ) {
			return array();
		}

		$sanitized = array();

		foreach ( $arr as $key => $value ) {
			// Sanitize key
			$sanitizedKey = self::sanitizeText( $key );

			// Sanitize value
			if ( is_array( $value ) ) {
				$sanitized[ $sanitizedKey ] = self::sanitizeArrayDeep( $value, $depth + 1, $maxDepth );
			} elseif ( is_string( $value ) ) {
				$sanitized[ $sanitizedKey ] = self::sanitizeSubmissionValue( $value );
			} elseif ( is_int( $value ) || is_float( $value ) || is_bool( $value ) || is_null( $value ) ) {
				$sanitized[ $sanitizedKey ] = $value;
			} else {
				// Convert objects to string
				$sanitized[ $sanitizedKey ] = self::sanitizeText( (string) $value );
			}
		}

		return $sanitized;
	}

	/**
	 * Sanitize JSON string
	 *
	 * Decodes JSON, sanitizes deeply, and returns sanitized array.
	 * Throws ValidationException if JSON is invalid or exceeds size limit.
	 *
	 * @param mixed $json JSON string to sanitize
	 * @param int   $maxBytes Maximum allowed bytes
	 * @return array Sanitized array
	 * @throws ValidationException If JSON is invalid or too large
	 */
	public static function sanitizeJsonString( $json, int $maxBytes = self::MAX_JSON_BYTES ): array {
		if ( ! is_string( $json ) ) {
			throw new ValidationException(
				'Invalid JSON: expected string',
				array( '__root' => 'JSON must be a string' ),
				'invalid_json'
			);
		}

		// Check size limit
		if ( strlen( $json ) > $maxBytes ) {
			throw new ValidationException(
				'JSON payload too large',
				array( '__root' => sprintf( 'Maximum size is %d bytes', $maxBytes ) ),
				'payload_too_large'
			);
		}

		// Decode JSON
		$decoded = json_decode( $json, true );

		if ( json_last_error() !== JSON_ERROR_NONE ) {
			throw new ValidationException(
				'Invalid JSON: ' . json_last_error_msg(),
				array( '__root' => 'JSON is malformed' ),
				'invalid_json'
			);
		}

		// Sanitize decoded array
		if ( ! is_array( $decoded ) ) {
			return array();
		}

		return self::sanitizeArrayDeep( $decoded );
	}

	/**
	 * Sanitize submission value (form payload field)
	 *
	 * Strips HTML tags and trims whitespace.
	 *
	 * @param mixed $value Value to sanitize
	 * @return string
	 */
	public static function sanitizeSubmissionValue( $value ): string {
		if ( is_array( $value ) || is_object( $value ) ) {
			return '';
		}

		$str = (string) $value;

		// Strip all HTML tags using WordPress function
		if ( function_exists( 'wp_strip_all_tags' ) ) {
			$str = wp_strip_all_tags( $str );
		} else {
			// Fallback: use strip_tags
			$str = strip_tags( $str );
		}

		// Trim whitespace
		$str = trim( $str );

		return $str;
	}

	/**
	 * Strip all HTML tags (WordPress wrapper with fallback)
	 *
	 * @param string $text Text to strip
	 * @return string
	 */
	private static function wp_strip_all_tags( string $text ): string {
		if ( function_exists( 'wp_strip_all_tags' ) ) {
			return wp_strip_all_tags( $text );
		}

		return strip_tags( $text );
	}
}
