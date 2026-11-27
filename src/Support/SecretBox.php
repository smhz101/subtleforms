<?php
/**
 * Authenticated encryption for secrets kept in the database.
 *
 * Uses libsodium secretbox with a key derived from the site's salts, so a
 * copy of the database alone does not reveal API keys or secrets. The format
 * and the key are the same as in SubtleForms Pro, so each plugin reads what
 * the other sealed. Values that are not encrypted yet are returned as
 * they are, which lets callers migrate them the first time they are read.
 *
 * @package SubtleForms\Support
 * @since   2.12.0
 */

declare(strict_types=1);

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class SecretBox {

	/** Prefix of a sealed value. */
	const PREFIX = 'sfs1:';

	/**
	 * Whether libsodium is usable here.
	 */
	public static function available(): bool {
		return function_exists( 'sodium_crypto_secretbox' ) && function_exists( 'random_bytes' );
	}

	/**
	 * Whether a stored value is sealed.
	 *
	 * @param mixed $value Stored value.
	 */
	public static function isSealed( $value ): bool {
		return is_string( $value ) && 0 === strpos( $value, self::PREFIX );
	}

	/**
	 * Seal a value. Empty and already sealed values are returned as they are;
	 * without libsodium the plain value is kept.
	 *
	 * @param string $plain Plain text.
	 */
	public static function seal( string $plain ): string {
		if ( '' === $plain || self::isSealed( $plain ) || ! self::available() ) {
			return $plain;
		}
		$nonce  = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		$cipher = sodium_crypto_secretbox( $plain, $nonce, self::key() );
		return self::PREFIX . base64_encode( $nonce . $cipher ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- Binary to text for storage.
	}

	/**
	 * Open a value. Plain (not yet migrated) values are returned as they are;
	 * a sealed value that cannot be opened gives an empty string.
	 *
	 * @param string $stored Stored value.
	 */
	public static function open( string $stored ): string {
		if ( ! self::isSealed( $stored ) ) {
			return $stored;
		}
		if ( ! self::available() ) {
			return '';
		}
		$raw = base64_decode( substr( $stored, strlen( self::PREFIX ) ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Reading back sealed storage.
		if ( false === $raw || strlen( $raw ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ) {
			return '';
		}
		$nonce  = substr( $raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		$cipher = substr( $raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		$plain  = sodium_crypto_secretbox_open( $cipher, $nonce, self::key() );
		return false === $plain ? '' : $plain;
	}

	/**
	 * 32-byte key from the site's salts.
	 */
	private static function key(): string {
		return sodium_crypto_generichash( 'subtleforms-pro|' . wp_salt( 'auth' ) . wp_salt( 'secure_auth' ), '', SODIUM_CRYPTO_SECRETBOX_KEYBYTES );
	}
}
