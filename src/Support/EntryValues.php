<?php
/**
 * How answers are stored and shown, by field type.
 *
 * One place for the per-type rules that the save step, the entry screen, the
 * CSV export and the notification emails all need to agree on:
 *
 * - Paragraph (textarea) answers keep their line breaks.
 * - Rich text answers keep a small set of formatting tags.
 * - Password answers are never stored as typed. By default only the fact that
 *   one was given is kept; a field can opt in to storing a one-way hash.
 *   Passwords are left out of emails and CSV exports.
 *
 * @package SubtleForms\Support
 * @since   2.2.1
 */

namespace SubtleForms\Support;

use SubtleForms\Validation\Sanitizer;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Per-type storage and display rules for entry values.
 */
final class EntryValues {

	/**
	 * Stored value for a password that was given but not kept.
	 */
	public const PASSWORD_PROVIDED = true;

	/**
	 * Field types whose answers must never leave the site in emails or exports.
	 */
	public const SECRET_TYPES = array( 'password' );

	/**
	 * Read a setting from a field, flat or under `config`.
	 *
	 * @param array  $field Field node.
	 * @param string $name  Setting name.
	 * @return mixed|null
	 */
	public static function attr( array $field, string $name ) {
		if ( isset( $field['config'] ) && is_array( $field['config'] ) && array_key_exists( $name, $field['config'] ) ) {
			return $field['config'][ $name ];
		}
		return $field[ $name ] ?? null;
	}

	/**
	 * Whether a field's answers are secret (left out of emails and exports).
	 *
	 * @param array $field Field node.
	 * @return bool
	 */
	public static function isSecret( array $field ): bool {
		return in_array( (string) ( $field['type'] ?? '' ), self::SECRET_TYPES, true );
	}

	/**
	 * The value to store for a password answer.
	 *
	 * @param mixed $value Submitted password.
	 * @param array $field Field node.
	 * @return string|bool '' when empty, a hash when the field stores one,
	 *                     otherwise true ("a password was provided").
	 */
	public static function passwordForStorage( $value, array $field ) {
		if ( is_array( $value ) || is_object( $value ) ) {
			return '';
		}
		$value = (string) $value;
		if ( $value === '' ) {
			return '';
		}
		if ( ! empty( self::attr( $field, 'storeHash' ) ) && function_exists( 'wp_hash_password' ) ) {
			return wp_hash_password( $value );
		}
		return self::PASSWORD_PROVIDED;
	}

	/**
	 * Sanitize a paragraph answer, keeping its line breaks.
	 *
	 * @param mixed $value Submitted value.
	 * @return string
	 */
	public static function textarea( $value ): string {
		if ( is_array( $value ) || is_object( $value ) ) {
			return '';
		}
		$value = str_replace( array( "\r\n", "\r" ), "\n", (string) $value );
		return function_exists( 'sanitize_textarea_field' ) ? sanitize_textarea_field( $value ) : trim( wp_strip_all_tags( $value ) );
	}

	/**
	 * Sanitize a stored answer by field type.
	 *
	 * @param mixed $value Submitted value (scalar).
	 * @param array $field Field node.
	 * @return mixed
	 */
	public static function sanitizeScalar( $value, array $field ) {
		$type = (string) ( $field['type'] ?? '' );
		switch ( $type ) {
			case 'textarea':
				return self::textarea( $value );
			case 'rich_text':
				return Sanitizer::sanitizeRichText( $value );
			case 'password':
				return self::passwordForStorage( $value, $field );
		}
		return null;
	}

	/**
	 * A readable label for a stored password value.
	 *
	 * @param mixed $value Stored value.
	 * @return string
	 */
	public static function passwordLabel( $value ): string {
		if ( $value === '' || $value === null || $value === false ) {
			return '';
		}
		if ( is_string( $value ) && preg_match( '/^\$(P|wp|2y|argon)/', $value ) ) {
			return __( 'Password provided (stored as a hash)', 'subtleforms' );
		}
		return __( 'Password provided', 'subtleforms' );
	}

	/**
	 * Keys of secret fields in a schema.
	 *
	 * @param array $schema Form schema.
	 * @return string[]
	 */
	public static function secretKeys( array $schema ): array {
		$keys = array();
		foreach ( FieldMapper::fields( $schema ) as $entry ) {
			if ( self::isSecret( $entry['field'] ) ) {
				$keys[] = $entry['key'];
			}
		}
		return $keys;
	}

	/**
	 * Format a stored answer as plain text for display, keeping line breaks.
	 *
	 * @param mixed $value Stored value.
	 * @param array $field Field node.
	 * @return string
	 */
	public static function toText( $value, array $field ): string {
		$type = (string) ( $field['type'] ?? '' );
		if ( self::isSignatureImage( $value ) ) {
			return __( 'Signed (the signature image is in the entry)', 'subtleforms' );
		}
		if ( $type === 'password' ) {
			return self::passwordLabel( $value );
		}
		if ( $type === Repeater::TYPE ) {
			return Repeater::toText( $value, $field );
		}
		if ( $type === 'rich_text' && is_string( $value ) ) {
			$text = preg_replace( '#<\s*(br|/p|/li)\s*/?>#i', "\n", $value );
			return trim( html_entity_decode( wp_strip_all_tags( (string) $text ), ENT_QUOTES, 'UTF-8' ) );
		}
		return FieldMapper::toText( $value );
	}

	/**
	 * Format a stored answer as HTML for an HTML email or screen.
	 *
	 * Line breaks become <br>, rich text keeps its allowed tags, everything
	 * else is escaped.
	 *
	 * @param mixed $value Stored value.
	 * @param array $field Field node.
	 * @return string
	 */
	public static function toHtml( $value, array $field ): string {
		$type = (string) ( $field['type'] ?? '' );
		if ( self::isSignatureImage( $value ) ) {
			return '<img src="' . esc_attr( (string) $value ) . '" alt="' . esc_attr__( 'Signature', 'subtleforms' ) . '" width="240" style="max-width:240px;height:auto;border:1px solid #e5e7eb;background:#fff;" />';
		}
		if ( $type === 'rich_text' && is_string( $value ) ) {
			return Sanitizer::sanitizeRichText( $value );
		}
		if ( $type === Repeater::TYPE ) {
			return Repeater::toHtml( $value, $field );
		}
		return nl2br( esc_html( self::toText( $value, $field ) ) );
	}

	/**
	 * Whether a stored answer is a drawn signature (a PNG or JPEG data URI).
	 *
	 * @param mixed $value Stored value.
	 * @return bool
	 */
	public static function isSignatureImage( $value ): bool {
		return is_string( $value ) && 1 === preg_match( '#^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$#', $value );
	}
}
