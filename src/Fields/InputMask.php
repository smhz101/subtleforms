<?php
/**
 * Input masks for Text, Number and Phone fields (2.8.0).
 *
 * A mask is a pattern where 9 is a digit, A is a letter and * is a letter or
 * digit; any other character is a literal. The browser formats the answer as
 * it is typed (resources/shared/inputMask.js). This class holds the same
 * presets and checks the answer on the server, so both agree.
 *
 * @package SubtleForms
 */

namespace SubtleForms\Fields;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Presets, pattern checks and messages for input masks.
 */
final class InputMask {

	/** Longest custom pattern. */
	public const MAX_PATTERN_LENGTH = 64;

	/** Most digits in a phone number (E.164). */
	public const PHONE_MAX_DIGITS = 15;

	/**
	 * Presets. Mirrors PRESETS in resources/shared/inputMask.js.
	 *
	 * @return array<string, array{patterns: string[], kind: string, order?: string, example: string}>
	 */
	public static function presets(): array {
		return array(
			'phone'    => array( 'patterns' => array(), 'kind' => 'phone', 'example' => '+1 555 010 1234' ),
			'date_dmy' => array( 'patterns' => array( '99/99/9999' ), 'kind' => 'date', 'order' => 'dmy', 'example' => 'DD/MM/YYYY' ),
			'date_mdy' => array( 'patterns' => array( '99/99/9999' ), 'kind' => 'date', 'order' => 'mdy', 'example' => 'MM/DD/YYYY' ),
			'date_ymd' => array( 'patterns' => array( '9999-99-99' ), 'kind' => 'date', 'order' => 'ymd', 'example' => 'YYYY-MM-DD' ),
			'time_24'  => array( 'patterns' => array( '99:99' ), 'kind' => 'time', 'example' => 'HH:MM' ),
			'zip_us'   => array( 'patterns' => array( '99999', '99999-9999' ), 'kind' => 'zip', 'example' => '12345' ),
			'custom'   => array( 'patterns' => array(), 'kind' => 'custom', 'example' => '' ),
		);
	}

	/**
	 * Options of the "Input mask" setting, by field type.
	 *
	 * @param string $type Field type.
	 * @return array<int, array{value: string, label: string}>
	 */
	public static function options( string $type ): array {
		$labels = array(
			''         => __( 'None', 'subtleforms' ),
			'phone'    => __( 'Phone', 'subtleforms' ),
			'date_dmy' => __( 'Date DD/MM/YYYY', 'subtleforms' ),
			'date_mdy' => __( 'Date MM/DD/YYYY', 'subtleforms' ),
			'date_ymd' => __( 'Date YYYY-MM-DD', 'subtleforms' ),
			'time_24'  => __( 'Time HH:MM (24-hour)', 'subtleforms' ),
			'zip_us'   => __( 'Postcode or ZIP (US)', 'subtleforms' ),
			'custom'   => __( 'Custom', 'subtleforms' ),
		);
		// A Phone field takes the phone mask only: its country list already
		// supplies the dial code.
		$keys = in_array( $type, array( 'phone', 'tel' ), true ) ? array( '', 'phone' ) : array_keys( $labels );
		$out = array();
		foreach ( $keys as $key ) {
			$out[] = array( 'value' => $key, 'label' => $labels[ $key ] );
		}
		return $out;
	}

	/**
	 * Keys a saved field may hold for `inputMask` ('' means none).
	 *
	 * @return string[]
	 */
	public static function keys(): array {
		return array_merge( array( '' ), array_keys( self::presets() ) );
	}

	/**
	 * Clean the three mask settings of a field.
	 *
	 * An unknown mask is dropped, a custom pattern is trimmed to plain text of
	 * a sane length, and the storage choice is "typed" or "digits".
	 *
	 * @param array<string, mixed> $field Field node (flat), changed in place.
	 * @return array<string, mixed>
	 */
	public static function sanitizeSettings( array $field ): array {
		if ( array_key_exists( 'inputMask', $field ) ) {
			$key = is_string( $field['inputMask'] ) ? $field['inputMask'] : '';
			if ( ! in_array( $key, self::keys(), true ) ) {
				$key = '';
			}
			$field['inputMask'] = $key;
		}
		if ( array_key_exists( 'maskPattern', $field ) ) {
			$pattern              = is_string( $field['maskPattern'] ) ? sanitize_text_field( $field['maskPattern'] ) : '';
			$field['maskPattern'] = mb_substr( $pattern, 0, self::MAX_PATTERN_LENGTH );
		}
		if ( array_key_exists( 'maskStore', $field ) ) {
			$field['maskStore'] = 'digits' === $field['maskStore'] ? 'digits' : 'typed';
		}
		return $field;
	}

	/**
	 * The mask a field asks for, or null.
	 *
	 * @param string $key     Preset key.
	 * @param string $custom  Custom pattern.
	 * @param string $store   'typed' or 'digits'.
	 * @return array<string, mixed>|null
	 */
	public static function resolve( string $key, string $custom = '', string $store = 'typed' ): ?array {
		$presets = self::presets();
		if ( ! isset( $presets[ $key ] ) ) {
			return null;
		}
		$preset   = $presets[ $key ];
		$patterns = $preset['patterns'];
		if ( 'custom' === $key ) {
			$custom = mb_substr( $custom, 0, self::MAX_PATTERN_LENGTH );
			if ( 0 === self::tokenCount( $custom ) ) {
				return null;
			}
			$patterns = array( $custom );
		}
		$strips = ! in_array( $preset['kind'], array( 'date', 'time' ), true );
		return array(
			'key'      => $key,
			'kind'     => $preset['kind'],
			'order'    => $preset['order'] ?? '',
			'patterns' => $patterns,
			'pattern'  => $patterns ? end( $patterns ) : '',
			'example'  => 'custom' === $key ? $custom : $preset['example'],
			'store'    => ( 'digits' === $store && $strips ) ? 'digits' : 'typed',
		);
	}

	/**
	 * Characters of a pattern as slots: array( token|null, literal|null ).
	 *
	 * @param string $pattern Pattern.
	 * @return array<int, array{0: ?string, 1: ?string}>
	 */
	private static function slots( string $pattern ): array {
		$chars = preg_split( '//u', mb_substr( $pattern, 0, self::MAX_PATTERN_LENGTH ), -1, PREG_SPLIT_NO_EMPTY );
		$slots = array();
		foreach ( (array) $chars as $ch ) {
			$slots[] = in_array( $ch, array( '9', 'A', '*' ), true ) ? array( $ch, null ) : array( null, $ch );
		}
		return $slots;
	}

	/**
	 * How many characters the visitor types for a pattern.
	 *
	 * @param string $pattern Pattern.
	 */
	public static function tokenCount( string $pattern ): int {
		return count( array_filter( self::slots( $pattern ), static fn( $slot ) => null !== $slot[0] ) );
	}

	/**
	 * Whether a character fits a token.
	 *
	 * @param string $token 9, A or *.
	 * @param string $ch    One character.
	 */
	private static function fits( string $token, string $ch ): bool {
		if ( '9' === $token ) {
			return 1 === preg_match( '/^[0-9]$/', $ch );
		}
		if ( 'A' === $token ) {
			return 1 === preg_match( '/^\p{L}$/u', $ch );
		}
		return 1 === preg_match( '/^[\p{L}0-9]$/u', $ch );
	}

	/**
	 * Run text through a pattern the way the browser does.
	 *
	 * @param string $input   Text.
	 * @param string $pattern Pattern.
	 * @return array{value: string, raw: string}
	 */
	public static function format( string $input, string $pattern ): array {
		$slots   = self::slots( $pattern );
		$value   = '';
		$raw     = '';
		$pending = '';
		$index   = 0;
		foreach ( (array) preg_split( '//u', $input, -1, PREG_SPLIT_NO_EMPTY ) as $ch ) {
			if ( $index >= count( $slots ) ) {
				break;
			}
			$used = false;
			while ( ! $used && $index < count( $slots ) ) {
				list( $token, $literal ) = $slots[ $index ];
				if ( null !== $literal ) {
					$pending .= $literal;
					++$index;
					$used = $ch === $literal;
				} else {
					if ( self::fits( $token, $ch ) ) {
						$value  .= $pending . $ch;
						$raw    .= $ch;
						$pending = '';
						++$index;
					}
					$used = true;
				}
			}
		}
		return array( 'value' => $value, 'raw' => $raw );
	}

	/**
	 * Answer to store: a typed answer is cut down to its typed characters
	 * when the field saves digits only. An answer that does not fit the
	 * pattern is returned as it came, so it fails the check.
	 *
	 * @param array<string, mixed> $mask  From resolve().
	 * @param string               $value Submitted value.
	 */
	public static function normalize( array $mask, string $value ): string {
		if ( 'digits' !== $mask['store'] ) {
			return $value;
		}
		if ( 'phone' === $mask['kind'] ) {
			$value = trim( $value );
			// "+44 20 7946 0958" keeps its calling code apart: "+44 2079460958".
			if ( preg_match( '/^\+(\d{1,3}) (.+)$/', $value, $m ) ) {
				return '+' . $m[1] . ' ' . preg_replace( '/\D/', '', $m[2] );
			}
			return ( str_starts_with( $value, '+' ) ? '+' : '' ) . preg_replace( '/\D/', '', $value );
		}
		$parsed = self::format( $value, $mask['pattern'] );
		return $parsed['value'] === $value ? $parsed['raw'] : $value;
	}

	/**
	 * Whether eight digits make a real day.
	 *
	 * @param string $raw   Eight digits.
	 * @param string $order dmy, mdy or ymd.
	 */
	public static function isRealDate( string $raw, string $order ): bool {
		if ( ! preg_match( '/^\d{8}$/', $raw ) ) {
			return false;
		}
		if ( 'ymd' === $order ) {
			list( $y, $m, $d ) = array( (int) substr( $raw, 0, 4 ), (int) substr( $raw, 4, 2 ), (int) substr( $raw, 6, 2 ) );
		} elseif ( 'mdy' === $order ) {
			list( $m, $d, $y ) = array( (int) substr( $raw, 0, 2 ), (int) substr( $raw, 2, 2 ), (int) substr( $raw, 4, 4 ) );
		} else {
			list( $d, $m, $y ) = array( (int) substr( $raw, 0, 2 ), (int) substr( $raw, 2, 2 ), (int) substr( $raw, 4, 4 ) );
		}
		return $y >= 1 && checkdate( $m, $d, $y );
	}

	/**
	 * Error for an answer that does not fit the mask, or null.
	 *
	 * @param array<string, mixed> $mask  From resolve().
	 * @param string               $value Answer after normalize().
	 */
	public static function error( array $mask, string $value ): ?string {
		if ( '' === $value ) {
			return null;
		}
		$kind = $mask['kind'];
		if ( 'phone' === $kind ) {
			$digits = strlen( (string) preg_replace( '/\D/', '', $value ) );
			$clean  = 1 === preg_match( '/^\+?[\d\s()\-]+$/', $value ) && strpos( $value, '+', 1 ) === false;
			return ( $clean && $digits >= 4 && $digits <= self::PHONE_MAX_DIGITS ) ? null : __( 'Invalid phone number.', 'subtleforms' );
		}

		$parsed  = self::format( $value, $mask['pattern'] );
		$shown   = 'digits' === $mask['store'] ? $parsed['raw'] : $parsed['value'];
		$lengths = array_map( array( self::class, 'tokenCount' ), $mask['patterns'] );
		$fits    = $shown === $value && in_array( mb_strlen( $parsed['raw'] ), $lengths, true );

		if ( 'date' === $kind ) {
			/* translators: %s: format such as DD/MM/YYYY */
			$format = sprintf( __( 'Enter the date as %s.', 'subtleforms' ), $mask['example'] );
			if ( ! $fits ) {
				return $format;
			}
			return self::isRealDate( $parsed['raw'], $mask['order'] )
				? null
				/* translators: %s: sentence such as "Enter the date as DD/MM/YYYY." */
				: sprintf( __( 'That date does not exist. %s', 'subtleforms' ), $format );
		}
		if ( 'time' === $kind ) {
			if ( $fits && 1 === preg_match( '/^([01]\d|2[0-3])[0-5]\d$/', $parsed['raw'] ) ) {
				return null;
			}
			/* translators: %s: format such as HH:MM */
			return sprintf( __( 'Enter the time as %s (24-hour).', 'subtleforms' ), $mask['example'] );
		}
		if ( $fits ) {
			return null;
		}
		if ( 'zip' === $kind ) {
			return __( 'Enter a US ZIP code, such as 12345 or 12345-6789.', 'subtleforms' );
		}
		/* translators: %s: format such as AA-9999 */
		return sprintf( __( 'Enter this in the format %s.', 'subtleforms' ), $mask['example'] );
	}
}
