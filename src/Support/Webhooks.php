<?php
/**
 * Shared rules for webhook actions and the Settings test request (2.4.1).
 *
 * The address rules every webhook delivery uses.
 *
 * @package SubtleForms
 * @since   2.4.1
 */

declare(strict_types=1);

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Webhook address.
 */
final class Webhooks {

	/**
	 * Trim an address and add https:// when no scheme was typed, so
	 * "hooks.example.com/abc" works like "https://hooks.example.com/abc".
	 *
	 * @param string $url Address as typed.
	 * @return string
	 */
	public static function normalizeUrl( string $url ): string {
		$url = trim( $url );
		if ( '' === $url || preg_match( '#^[a-z][a-z0-9+.-]*://#i', $url ) ) {
			return $url;
		}
		return 'https://' . ltrim( $url, '/' );
	}

	/**
	 * Why an address cannot be used, or null when it can.
	 *
	 * The address must be a full http or https URL, and it must pass
	 * WordPress's own safety check for outgoing requests
	 * (wp_http_validate_url): local and private addresses and ports other
	 * than 80, 443 and 8080 are refused unless the site allows them with the
	 * http_request_host_is_external or http_allowed_safe_ports filters.
	 *
	 * @param string $url Address (already normalized).
	 * @return \WP_Error|null
	 */
	public static function urlProblem( string $url ): ?\WP_Error {
		$parts = wp_parse_url( $url );
		if ( '' === $url || ! is_array( $parts ) || empty( $parts['host'] ) || ! in_array( strtolower( (string) ( $parts['scheme'] ?? '' ) ), array( 'http', 'https' ), true ) ) {
			return new \WP_Error(
				'invalid_url',
				__( 'Enter the full webhook address, for example https://hooks.example.com/abc.', 'subtleforms' )
			);
		}
		if ( ! wp_http_validate_url( $url ) ) {
			return new \WP_Error(
				'blocked_url',
				sprintf(
					/* translators: %s: host name of the webhook address */
					__( 'WordPress blocks requests to %s. Local and private addresses, and ports other than 80, 443 and 8080, are refused for safety. Use a public address, or ask your developer to allow it with the http_request_host_is_external and http_allowed_safe_ports filters.', 'subtleforms' ),
					(string) $parts['host'] . ( isset( $parts['port'] ) ? ':' . (int) $parts['port'] : '' )
				)
			);
		}
		return null;
	}
}
