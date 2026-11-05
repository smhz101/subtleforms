<?php
/**
 * Read a Ninja Forms export file (.nff).
 *
 * Ninja Forms has written these files three ways over the years: plain JSON,
 * JSON in base64, and a PHP serialized array (also in base64). All are read
 * here without creating objects. Anything else is refused with a plain message.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.8.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Decode the text of an export file.
 */
final class NinjaExport {

	/**
	 * @param string $raw File contents.
	 * @return array|null A form, or a list of forms; null when the text is not a Ninja Forms export.
	 */
	public static function decode( string $raw ): ?array {
		$raw = trim( preg_replace( '/^\xEF\xBB\xBF/', '', $raw ) );
		if ( '' === $raw || strlen( $raw ) > 8 * 1048576 ) {
			return null;
		}
		$candidates = array( $raw );
		if ( preg_match( '/^[A-Za-z0-9+\/=\s]+$/', $raw ) ) {
			$decoded = base64_decode( preg_replace( '/\s+/', '', $raw ), true );
			if ( false !== $decoded && '' !== $decoded ) {
				$candidates[] = trim( $decoded );
			}
		}
		foreach ( $candidates as $text ) {
			$json = json_decode( $text, true );
			if ( is_array( $json ) ) {
				return $json;
			}
			if ( preg_match( '/^[aOs]:\d+/', $text ) ) {
				// Plain arrays only: no objects are created from file data.
				$un = @unserialize( $text, array( 'allowed_classes' => false ) ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.PHP.DiscouragedPHPFunctions.serialize_unserialize
				if ( is_array( $un ) ) {
					return $un;
				}
			}
		}
		return null;
	}
}
