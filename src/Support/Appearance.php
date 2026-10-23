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
		// 2.7.2 tokens: placeholder, button hover text, success, link, focus
		// ring, help text and the accent of radios and checkboxes.
		'colorPlaceholder',
		'colorButtonHoverText',
		'colorSuccess',
		'colorLink',
		'colorFocusRing',
		'colorHelp',
		'choiceAccent',
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
	 * Tokens added in 2.7.2 that hold a number, with the range they accept.
	 */
	private const RANGED_NUMBER_TOKENS = array(
		'labelLineHeight' => array( 0.8, 3.0 ),
	);

	/**
	 * Tokens added in 2.7.2 that hold a length, with the range they accept
	 * in pixels (rem and em count as 16 pixels) and whether a percentage
	 * is allowed. The older length tokens keep the looser check above, so a
	 * saved form never loses a value it already had.
	 */
	private const RANGED_SIZE_TOKENS = array(
		'labelSize'          => array( 8, 48, false ),
		'inputSize'          => array( 8, 48, false ),
		'helpSize'           => array( 8, 40, false ),
		'titleSize'          => array( 10, 96, false ),
		'buttonSize'         => array( 8, 48, false ),
		'labelLetterSpacing' => array( -4, 12, false ),
		'inputPaddingX'      => array( 0, 64, false ),
		'labelGap'           => array( 0, 48, false ),
		'buttonPaddingY'     => array( 0, 48, false ),
		'buttonPaddingX'     => array( 0, 96, false ),
		'columnGap'          => array( 0, 96, false ),
		'formMaxWidth'       => array( 240, 1920, true ),
		'choiceSize'         => array( 12, 40, false ),
	);

	/**
	 * Size tokens that may name one of the theme's font sizes.
	 */
	private const THEME_SIZE_TOKENS = array( 'fontSize', 'labelSize', 'inputSize', 'helpSize', 'titleSize', 'buttonSize' );

	/**
	 * Token keys restricted to a fixed set of values.
	 */
	private const ENUM_TOKENS = array(
		'labelWeight' => array( '300', '400', '500', '600', '700', '800' ),
		'width'       => array( '100', '75', '66', '50', '33', '25' ),
		'align'       => array( 'left', 'center', 'right' ),
		// 2.7.2.
		'inputWeight'     => array( '300', '400', '500', '600', '700' ),
		'buttonWeight'    => array( '400', '500', '600', '700', '800' ),
		'titleWeight'     => array( '400', '500', '600', '700', '800' ),
		'labelTransform'  => array( 'none', 'uppercase', 'capitalize', 'lowercase' ),
		'buttonTransform' => array( 'none', 'uppercase', 'capitalize', 'lowercase' ),
		'borderStyle'     => array( 'solid', 'dashed', 'dotted' ),
		'fieldShadow'     => array( 'none', 'subtle', 'medium' ),
		'buttonShadow'    => array( 'none', 'subtle', 'medium' ),
		'focusStyle'      => array( 'ring', 'border' ),
		'formAlign'       => array( 'left', 'center' ),
	);

	/**
	 * Font stacks the builder offers. Free-form font names are not accepted:
	 * the value lands in a custom property, and an allow-list is cheaper to
	 * reason about than escaping one.
	 */
	private const FONT_TOKENS = array( 'fontFamily', 'labelFont', 'inputFont' );

	/** Longest custom CSS a form can store, in bytes. */
	public const CUSTOM_CSS_MAX = 20000;

	/**
	 * Variant keys and their permitted values.
	 */
	private const VARIANTS = array(
		'input'       => array( 'outlined', 'filled', 'underlined' ),
		'button'      => array( 'solid', 'outline', 'ghost' ),
		'buttonAlign' => array( 'left', 'center', 'right', 'full' ),
		'width'       => array( 'narrow', 'standard', 'wide', 'full', 'theme' ),
		'layout'      => array( 'stacked', 'inline', 'inherit' ),
	);

	/**
	 * Sanitise a form's appearance object.
	 *
	 * @param mixed $appearance Raw appearance value from the request.
	 * @return array Sanitised appearance, or an empty array.
	 */
	public static function sanitizeForm( $appearance, ?string $previousCss = null, ?bool $canEditCss = null ): array {
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

		// Custom CSS (2.7.2). Only a person who may post unfiltered HTML can
		// write it. Everyone else keeps what is already stored: it comes back
		// unchanged and nothing they send replaces it.
		$canEditCss = $canEditCss ?? self::canEditCustomCss();
		$css        = $canEditCss ? self::sanitizeCustomCss( $appearance['customCss'] ?? '' ) : (string) $previousCss;
		if ( '' !== $css ) {
			$clean['customCss'] = $css;
		}

		return $clean;
	}

	/**
	 * Whether the current user may write a form's custom CSS.
	 */
	public static function canEditCustomCss(): bool {
		return function_exists( 'current_user_can' ) && current_user_can( 'unfiltered_html' );
	}

	/**
	 * Make a form's custom CSS safe to store and to print inside a style tag.
	 *
	 * Rules are kept as written. What is removed: markup (every angle
	 * bracket), comments, `@import` of anything but an https address,
	 * `@charset` and `@namespace`, and `url()` that is not https or a path on
	 * this site. CSS that holds `expression(`, `javascript:`, `vbscript:`,
	 * `behavior:` or `-moz-binding`, even hidden behind CSS escapes, or whose
	 * braces do not match, or that is longer than 20,000 bytes, is rejected as
	 * a whole (an empty string), so a half-cut rule never reaches a page.
	 *
	 * The rules are scoped to the form at output time (scopeCustomCss in
	 * resources/shared/appearance.js), so the preview, the block editor and
	 * the page apply them to that form only.
	 *
	 * @param mixed $css Raw CSS.
	 * @return string Safe CSS, or ''.
	 */
	public static function sanitizeCustomCss( $css ): string {
		if ( ! is_string( $css ) ) {
			return '';
		}
		$css = str_replace( "\0", '', $css );
		$css = (string) preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $css );
		if ( strlen( $css ) > self::CUSTOM_CSS_MAX ) {
			return '';
		}
		$css = (string) preg_replace( '#/\*.*?\*/#s', '', $css );
		// No markup can end the style element: whole tags go, then any stray bracket.
		$css = (string) preg_replace( '#<\s*/?\s*[a-z!][^>]*>?#i', '', $css );
		$css = str_replace( '<', '', $css );
		$css = trim( $css );
		if ( '' === $css ) {
			return '';
		}

		// Look at the CSS the way a browser reads it: escapes decoded.
		$decoded = (string) preg_replace_callback(
			'/\\\\([0-9a-fA-F]{1,6})\s?|\\\\(.)/s',
			static function ( $m ) {
				if ( isset( $m[2] ) && '' !== $m[2] ) {
					return $m[2];
				}
				$code = hexdec( $m[1] );
				return ( $code > 0 && $code < 0x110000 ) ? html_entity_decode( '&#' . $code . ';', ENT_QUOTES, 'UTF-8' ) : '';
			},
			$css
		);
		$check   = strtolower( (string) preg_replace( '/\s+/', '', $decoded ) );
		foreach ( array( 'expression(', 'javascript:', 'vbscript:', 'behavior:', '-moz-binding', 'livescript:' ) as $bad ) {
			if ( false !== strpos( $check, $bad ) ) {
				return '';
			}
		}

		// Braces must match outside strings.
		$depth  = 0;
		$quote  = '';
		$length = strlen( $css );
		for ( $i = 0; $i < $length; $i++ ) {
			$ch = $css[ $i ];
			if ( '' !== $quote ) {
				if ( '\\' === $ch ) {
					++$i;
				} elseif ( $ch === $quote ) {
					$quote = '';
				}
				continue;
			}
			if ( '"' === $ch || "'" === $ch ) {
				$quote = $ch;
			} elseif ( '{' === $ch ) {
				++$depth;
			} elseif ( '}' === $ch ) {
				--$depth;
				if ( $depth < 0 ) {
					return '';
				}
			}
		}
		if ( 0 !== $depth || '' !== $quote ) {
			return '';
		}

		// An imported stylesheet cannot be limited to the form, so it is dropped.
		$css = (string) preg_replace( '/@import\b[^;{}]*;?/i', '', $css );
		$css = (string) preg_replace( '/@(?:charset|namespace)\b[^;{}]*;?/i', '', $css );
		$css = (string) preg_replace_callback(
			'/url\(\s*(["\']?)([^"\')]*)\1\s*\)/i',
			static function ( $m ) {
				$url = trim( $m[2] );
				if ( preg_match( '#^https://[^\s"\'()<>\\\\]+$#i', $url ) || preg_match( '#^/(?!/)[^\s"\'()<>\\\\:]*$#', $url ) ) {
					return 'url("' . $url . '")';
				}
				return 'none';
			},
			$css
		);

		return trim( $css );
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
			} elseif ( isset( self::RANGED_SIZE_TOKENS[ $key ] ) ) {
				$sanitized = ( in_array( $key, self::THEME_SIZE_TOKENS, true ) && self::isThemeVar( $value, 'font-size' ) ) ? $value : self::sanitizeRangedLength( $value, self::RANGED_SIZE_TOKENS[ $key ] );
			} elseif ( isset( self::RANGED_NUMBER_TOKENS[ $key ] ) ) {
				$sanitized = ( is_numeric( $value ) && (float) $value >= self::RANGED_NUMBER_TOKENS[ $key ][0] && (float) $value <= self::RANGED_NUMBER_TOKENS[ $key ][1] ) ? (string) ( 0 + $value ) : null;
			} elseif ( in_array( $key, self::SIZE_TOKENS, true ) ) {
				$sanitized = ( in_array( $key, self::THEME_SIZE_TOKENS, true ) && self::isThemeVar( $value, 'font-size' ) ) ? $value : self::sanitizeLength( $value );
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

		// A colour of the theme, stored by name so it follows the theme.
		if ( self::isThemeVar( $value, 'color' ) ) {
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
	 * Whether a value is exactly one of the theme's preset variables of a kind
	 * (color, font-family or font-size), such as var(--wp--preset--color--primary).
	 *
	 * @param string $value Raw value.
	 * @param string $kind  Preset kind.
	 * @return bool
	 */
	public static function isThemeVar( string $value, string $kind ): bool {
		return 1 === preg_match( '/^var\(--wp--preset--' . preg_quote( $kind, '/' ) . '--[a-z0-9]+(?:-[a-z0-9]+)*\)$/', $value );
	}

	/**
	 * Accept a length inside a range. Units: px, rem, em, and % when allowed.
	 *
	 * @param string $value Raw length.
	 * @param array  $range { min px, max px, percent allowed }.
	 * @return string|null Sanitised length, or null.
	 */
	private static function sanitizeRangedLength( string $value, array $range ): ?string {
		if ( ! preg_match( '/^(-?(?:\d+|\d*\.\d+))(px|rem|em|%)$/', $value, $m ) ) {
			if ( preg_match( '/^-?(?:\d+|\d*\.\d+)$/', $value ) && 0.0 === (float) $value && $range[0] <= 0 ) {
				return '0';
			}
			return null;
		}
		$number = (float) $m[1];
		if ( '%' === $m[2] ) {
			return ( $range[2] && $number >= 10 && $number <= 100 ) ? $value : null;
		}
		$px = 'px' === $m[2] ? $number : $number * 16;
		return ( $px >= $range[0] && $px <= $range[1] ) ? $value : null;
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
		if ( $value === 'inherit' || self::isThemeVar( $value, 'font-family' ) ) {
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

	/**
	 * Preview widths for desktop, tablet and mobile.
	 *
	 * A theme may name them, in pixels, under settings.custom.breakpoints
	 * (or breakpoint) in theme.json. settings.layout.wideSize fills in
	 * desktop and contentSize fills in tablet when those names are absent.
	 * Missing sizes use 1280, 768 and 390, and the three stay in order.
	 *
	 * @param array $settings theme.json settings.
	 * @return array{desktop: int, tablet: int, mobile: int}
	 */
	public static function previewBreakpoints( array $settings = array() ): array {
		$standard = array(
			'desktop' => 1280,
			'tablet'  => 768,
			'mobile'  => 390,
		);
		$custom   = isset( $settings['custom'] ) && is_array( $settings['custom'] ) ? $settings['custom'] : array();
		$layout   = isset( $settings['layout'] ) && is_array( $settings['layout'] ) ? $settings['layout'] : array();
		$found    = array();

		foreach ( array( 'breakpoint', 'breakpoints' ) as $key ) {
			if ( empty( $custom[ $key ] ) || ! is_array( $custom[ $key ] ) ) {
				continue;
			}
			foreach ( array( 'desktop', 'tablet', 'mobile' ) as $name ) {
				if ( isset( $found[ $name ] ) || ! isset( $custom[ $key ][ $name ] ) ) {
					continue;
				}
				$px = self::previewPx( $custom[ $key ][ $name ] );
				if ( null !== $px ) {
					$found[ $name ] = $px;
				}
			}
		}

		if ( ! isset( $found['desktop'] ) && isset( $layout['wideSize'] ) ) {
			$wide = self::previewPx( $layout['wideSize'] );
			if ( null !== $wide ) {
				$found['desktop'] = $wide;
			}
		}
		if ( ! isset( $found['tablet'] ) && isset( $layout['contentSize'] ) ) {
			$content = self::previewPx( $layout['contentSize'] );
			if ( null !== $content ) {
				$found['tablet'] = $content;
			}
		}

		$widths = array(
			'desktop' => $found['desktop'] ?? $standard['desktop'],
			'tablet'  => $found['tablet'] ?? $standard['tablet'],
			'mobile'  => $found['mobile'] ?? $standard['mobile'],
		);

		// Tablet first. Raising it afterwards can put it above desktop.
		if ( $widths['tablet'] <= $widths['mobile'] ) {
			$widths['tablet'] = max( $widths['mobile'] + 200, $standard['tablet'] );
		}
		if ( $widths['desktop'] <= $widths['tablet'] ) {
			$widths['desktop'] = max( $widths['tablet'] + 240, $standard['desktop'] );
		}

		return $widths;
	}

	/**
	 * A pixel length from a theme.json size, or null.
	 *
	 * @param mixed $value Raw size.
	 * @return int|null
	 */
	private static function previewPx( $value ): ?int {
		if ( is_int( $value ) || is_float( $value ) ) {
			$px = (int) round( (float) $value );
		} elseif ( is_string( $value ) && preg_match( '/^(\d+(?:\.\d+)?)px$/', trim( $value ), $match ) ) {
			$px = (int) round( (float) $match[1] );
		} else {
			return null;
		}

		return ( $px >= 280 && $px <= 2400 ) ? $px : null;
	}

}
