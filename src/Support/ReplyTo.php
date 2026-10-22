<?php
/**
 * Reply-To from a merge tag, safely.
 *
 * Reply-To is the only email header that may hold a merge tag (for example
 * `{field:email}`, so a reply goes to the person who sent the form). The
 * answer is accepted only when it is exactly one valid email address; line
 * breaks are removed first, so an answer can never add a header of its own.
 * From never takes a merge tag.
 *
 * @package SubtleForms\Support
 * @since   2.6.0
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve and check a Reply-To value.
 */
final class ReplyTo {

	/**
	 * Whether a value holds a merge tag.
	 *
	 * @param string $value Value.
	 * @return bool
	 */
	public static function hasTag( string $value ): bool {
		return (bool) preg_match( '/\{\{?\s*[a-zA-Z0-9_:.\-]+\s*\}?\}/', $value );
	}

	/**
	 * The address a Reply-To setting gives, or null when it is not one valid
	 * email address.
	 *
	 * @param string   $raw    Setting, with or without merge tags.
	 * @param callable $render Renders merge tags: fn( string ): string.
	 * @return string|null
	 */
	public static function resolve( string $raw, callable $render ): ?string {
		$raw = trim( $raw );
		if ( '' === $raw ) {
			return null;
		}
		$value = self::hasTag( $raw ) ? (string) $render( $raw ) : $raw;
		$value = trim( (string) preg_replace( '/[\r\n]+/', ' ', $value ) );
		// One address only: no spaces, lists, display names or headers.
		if ( '' === $value || preg_match( '/[\s,;<>"\'()]/', $value ) ) {
			return null;
		}
		$email = sanitize_email( $value );
		return ( $email === $value && is_email( $email ) ) ? $email : null;
	}

	/**
	 * Apply the Reply-To rules to an email's header lines.
	 *
	 * A Reply-To line with a merge tag is resolved (and dropped when the
	 * answer is not one address). A From line with a merge tag is dropped, so
	 * the site sender is used. The `replyTo` setting, when set, replaces any
	 * Reply-To line.
	 *
	 * @param string[] $headers Header lines, line breaks already removed.
	 * @param string   $setting The action's `replyTo` setting.
	 * @param callable $render  Renders merge tags.
	 * @return array{headers: string[], dropped: string[]} Lines kept, and the raw values dropped.
	 */
	public static function apply( array $headers, string $setting, callable $render ): array {
		$out     = array();
		$dropped = array();
		$setting = trim( $setting );
		foreach ( $headers as $header ) {
			if ( ! is_string( $header ) ) {
				$out[] = $header;
				continue;
			}
			if ( preg_match( '/^\s*from\s*:(.*)$/i', $header, $m ) && self::hasTag( $m[1] ) ) {
				$dropped[] = trim( $header );
				continue;
			}
			if ( preg_match( '/^\s*reply-to\s*:(.*)$/i', $header, $m ) ) {
				if ( '' !== $setting ) {
					continue;
				}
				if ( self::hasTag( $m[1] ) ) {
					$address = self::resolve( $m[1], $render );
					if ( null === $address ) {
						$dropped[] = trim( $header );
						continue;
					}
					$out[] = 'Reply-To: ' . $address;
					continue;
				}
			}
			$out[] = $header;
		}
		if ( '' !== $setting ) {
			$address = self::resolve( $setting, $render );
			if ( null === $address ) {
				$dropped[] = 'Reply-To: ' . $setting;
			} else {
				$out[] = 'Reply-To: ' . $address;
			}
		}
		return array(
			'headers' => $out,
			'dropped' => $dropped,
		);
	}
}
