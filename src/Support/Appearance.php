<?php
/**
 * Appearance sanitisation.
 *
 * @package SubtleForms
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validates form and field appearance values before they are stored.
 *
 * Appearance values are rendered into CSS custom properties on the form's root
 * element, so they reach a stylesheet rather than a text node. Escaping on
 * output is not enough for that: `url(...)` in a custom property still makes a
 * request when a rule consumes it. Values are therefore checked against the
 * shape each token is supposed to have, and anything unrecognised is dropped
 * rather than stored and escaped later.
 *
 * The key lists mirror `resources/shared/appearance.js`. That file is the
 * contract the builder and renderer share; this one is the gate in front of the
 * database. A token added there must be added here or it will not persist.
 */
final class Appearance {

	/**
	 * Token keys that hold a colour.
	 */
	private const COLOR_TOKENS = array(
		'colorPrimary',
		'colorPrimaryHover',
		'colorText',
		'colorTextLight',
		'colorBackground',
		'colorSurface',
		'colorBorder',
		'colorError',
		// 2.0 tokens the builder writes; without them here they were dropped
		// on save (fixed in 2.3.0).
		'colorLabel',
		'colorInputText',
		'colorFocus',
		'colorButtonText',
	);

	/**
	 * Token keys that hold a CSS length.
	 */
	private const SIZE_TOKENS = array(
		'fontSize',
		'radius',
		'borderWidth',
		'fieldGap',
		'inputPaddingY',
		'marginTop',
		'marginBottom',
		'buttonRadius',
	);

	/**
	 * Token keys that hold a bare number.
	 */
	private const NUMBER_TOKENS = array( 'lineHeight' );

	/**
	 * Token keys restricted to a fixed set of values.
	 */
	private const ENUM_TOKENS = array(
		'labelWeight' => array( '400', '500', '600', '700' ),
		'width'       => array( '100', '75', '66', '50', '33', '25' ),
		'align'       => array( 'left', 'center', 'right' ),
	);

	/**
	 * Font stacks the builder offers. Free-form font names are not accepted:
	 * the value lands in a custom property, and an allow-list is cheaper to
	 * reason about than escaping one.
	 */
	private const FONT_TOKENS = array( 'fontFamily' );

	/**
	 * Variant keys and their permitted values.
	 */
	private const VARIANTS = array(
		'input'       => array( 'outlined', 'filled', 'underlined' ),
		'button'      => array( 'solid', 'outline', 'ghost' ),
		'buttonAlign' => array( 'left', 'center', 'right', 'full' ),
		'width'       => array( 'narrow', 'standard', 'wide', 'full' ),
		'layout'      => array( 'stacked', 'inline' ),
	);

	/**
	 * Sanitise a form's appearance object.
	 *
	 * @param mixed $appearance Raw appearance value from the request.
	 * @return array Sanitised appearance, or an empty array.
	 */
	public static function sanitizeForm( $appearance ): array {
		if ( ! is_array( $appearance ) ) {
			return array();
		}

		$clean = array();

		if ( ! empty( $appearance['preset'] ) && is_string( $appearance['preset'] ) ) {
			$preset = preg_replace( '/[^a-z0-9_-]/', '', strtolower( $appearance['preset'] ) );
			if ( $preset !== '' ) {
				$clean['preset'] = substr( $preset, 0, 40 );
			}
		}

		$tokens = self::sanitizeTokens( $appearance['tokens'] ?? null );
		if ( ! empty( $tokens ) ) {
			$clean['tokens'] = $tokens;
		}

		$variants = self::sanitizeVariants( $appearance['variants'] ?? null );
		if ( ! empty( $variants ) ) {
			$clean['variants'] = $variants;
		}

		return $clean;
	}

	/**
	 * Sanitise a field's appearance object.
	 *
	 * Field overrides use the same token names as the form plus a few layout
	 * keys, so they go through the same value checks.
	 *
	 * @param mixed $appearance Raw appearance value from the request.
	 * @return array Sanitised appearance, or an empty array.
	 */
	public static function sanitizeField( $appearance ): array {
		if ( ! is_array( $appearance ) ) {
			return array();
		}

		$clean = self::sanitizeTokens( $appearance );

		if ( ! empty( $appearance['hideLabel'] ) ) {
			$clean['hideLabel'] = true;
		}

		// False is the meaningful value: flags are shown unless this is off.
		// sanitizeTokens() drops booleans, so keep it explicitly.
		if ( array_key_exists( 'showFlags', $appearance ) ) {
			$clean['showFlags'] = (bool) $appearance['showFlags'];
		}

		return $clean;
	}

	/**
	 * Sanitise a token map.
	 *
	 * @param mixed $tokens Raw token map.
	 * @return array Sanitised tokens.
	 */
	private static function sanitizeTokens( $tokens ): array {
		if ( ! is_array( $tokens ) ) {
			return array();
		}

		$clean = array();

		foreach ( $tokens as $key => $value ) {
			if ( ! is_string( $key ) || ( ! is_string( $value ) && ! is_numeric( $value ) ) ) {
				continue;
			}

			$value = trim( (string) $value );

			if ( $value === '' ) {
				continue;
			}

			if ( in_array( $key, self::COLOR_TOKENS, true ) ) {
				$sanitized = self::sanitizeColor( $value );
			} elseif ( in_array( $key, self::SIZE_TOKENS, true ) ) {
				$sanitized = self::sanitizeLength( $value );
			} elseif ( in_array( $key, self::NUMBER_TOKENS, true ) ) {
				$sanitized = is_numeric( $value ) ? (string) ( 0 + $value ) : null;
			} elseif ( in_array( $key, self::FONT_TOKENS, true ) ) {
				$sanitized = self::sanitizeFontStack( $value );
			} elseif ( isset( self::ENUM_TOKENS[ $key ] ) ) {
				$sanitized = in_array( $value, self::ENUM_TOKENS[ $key ], true ) ? $value : null;
			} else {
				// Unknown token: drop it rather than store an unchecked value.
				$sanitized = null;
			}

			if ( $sanitized !== null ) {
				$clean[ $key ] = $sanitized;
			}
		}

		return $clean;
	}

	/**
	 * Sanitise the structural variant map.
	 *
	 * @param mixed $variants Raw variant map.
	 * @return array Sanitised variants.
	 */
	private static function sanitizeVariants( $variants ): array {
		if ( ! is_array( $variants ) ) {
			return array();
		}

		$clean = array();

		foreach ( self::VARIANTS as $key => $allowed ) {
			if ( isset( $variants[ $key ] ) && in_array( $variants[ $key ], $allowed, true ) ) {
				$clean[ $key ] = $variants[ $key ];
			}
		}

		return $clean;
	}

	/**
	 * Accept a hex, rgb()/rgba() or hsl()/hsla() colour, plus the two keywords
	 * the UI can produce.
	 *
	 * @param string $value Raw colour.
	 * @return string|null Sanitised colour, or null when unrecognised.
	 */
	private static function sanitizeColor( string $value ): ?string {
		if ( in_array( $value, array( 'transparent', 'inherit', 'currentColor' ), true ) ) {
			return $value;
		}

		if ( preg_match( '/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', $value ) ) {
			return strtolower( $value );
		}

		// Numeric-only arguments, so no nested functions or urls can appear.
		if ( preg_match( '/^(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s\/]+\)$/i', $value ) ) {
			return $value;
		}

		return null;
	}

	/**
	 * Accept a CSS length with a known unit, or a bare zero.
	 *
	 * @param string $value Raw length.
	 * @return string|null Sanitised length, or null when unrecognised.
	 */
	private static function sanitizeLength( string $value ): ?string {
		if ( preg_match( '/^-?(?:\d+|\d*\.\d+)(px|rem|em|%|vh|vw|ch)$/', $value ) ) {
			return $value;
		}

		if ( preg_match( '/^-?(?:\d+|\d*\.\d+)$/', $value ) ) {
			// Unitless is only meaningful as zero; anything else is a mistake.
			return ( 0 + $value ) === 0 ? '0' : null;
		}

		return null;
	}

	/**
	 * Accept a font stack made only of names, quotes and generic families.
	 *
	 * @param string $value Raw font stack.
	 * @return string|null Sanitised stack, or null when unrecognised.
	 */
	private static function sanitizeFontStack( string $value ): ?string {
		if ( $value === 'inherit' ) {
			return $value;
		}

		if ( strlen( $value ) > 300 ) {
			return null;
		}

		// Letters, digits, spaces, hyphens, commas, quotes and dots only: no
		// parentheses, so url() and other functions cannot appear.
		if ( preg_match( '/^[A-Za-z0-9 ,\'"._-]+$/', $value ) ) {
			return $value;
		}

		return null;
	}
}
