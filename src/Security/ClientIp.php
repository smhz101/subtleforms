<?php
/**
 * The visitor's IP address, resolved in one place.
 *
 * The rate limiter, the CAPTCHA check and the stored entry IP all use this
 * helper, so they always agree. By default it returns REMOTE_ADDR and nothing
 * else: forwarding headers are client-controlled and are only believed when
 * the connection comes from a proxy the site owner has named.
 *
 * Settings (in the subtleforms_settings option):
 * - trusted_proxy_cidrs: proxy addresses or CIDR ranges, one per line or comma separated.
 * - trust_cloudflare: when on, Cloudflare's published ranges are trusted and
 *   the CF-Connecting-IP header is used.
 *
 * @package SubtleForms
 * @subpackage Security
 */

namespace SubtleForms\Security;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Trusted-proxy aware client IP lookup.
 */
final class ClientIp {

	/**
	 * Cloudflare's published IPv4 and IPv6 ranges.
	 *
	 * @var string[]
	 */
	const CLOUDFLARE_RANGES = array(
		'173.245.48.0/20',
		'103.21.244.0/22',
		'103.22.200.0/22',
		'103.31.4.0/22',
		'141.101.64.0/18',
		'108.162.192.0/18',
		'190.93.240.0/20',
		'188.114.96.0/20',
		'197.234.240.0/22',
		'198.41.128.0/17',
		'162.158.0.0/15',
		'104.16.0.0/13',
		'104.24.0.0/14',
		'172.64.0.0/13',
		'131.0.72.0/22',
		'2400:cb00::/32',
		'2606:4700::/32',
		'2803:f800::/32',
		'2405:b500::/32',
		'2405:8100::/32',
		'2a06:98c0::/29',
		'2c0f:f248::/32',
	);

	/**
	 * The client IP, or an empty string when none is known.
	 *
	 * @return string
	 */
	public static function get(): string {
		$remote = self::server_value( 'REMOTE_ADDR' );
		$remote = self::valid( $remote ) ? $remote : '';
		if ( '' === $remote ) {
			return '';
		}

		$settings   = get_option( 'subtleforms_settings', array() );
		$settings   = is_array( $settings ) ? $settings : array();
		$cloudflare = ! empty( $settings['trust_cloudflare'] );

		$trusted = self::parse_list( $settings['trusted_proxy_cidrs'] ?? array() );
		if ( $cloudflare ) {
			$trusted = array_merge( $trusted, self::CLOUDFLARE_RANGES );
		}
		/**
		 * Filter the proxy addresses and CIDR ranges whose forwarding headers are believed.
		 *
		 * @param string[] $trusted Addresses and CIDR ranges.
		 */
		$trusted = (array) apply_filters( 'subtleforms/client_ip/trusted_proxies', $trusted );

		if ( ! self::in_ranges( $remote, $trusted ) ) {
			return $remote;
		}

		if ( $cloudflare ) {
			$cf = self::server_value( 'HTTP_CF_CONNECTING_IP' );
			if ( self::valid( $cf ) ) {
				return $cf;
			}
		}

		// X-Forwarded-For lists the client first and each proxy after it. Read
		// from the right and skip our own proxies; the first address that is not
		// one of them is the nearest hop we did not put there ourselves.
		$forwarded = self::server_value( 'HTTP_X_FORWARDED_FOR' );
		if ( '' !== $forwarded ) {
			$hops = array_reverse( array_map( 'trim', explode( ',', $forwarded ) ) );
			foreach ( $hops as $hop ) {
				if ( ! self::valid( $hop ) ) {
					return $remote;
				}
				if ( ! self::in_ranges( $hop, $trusted ) ) {
					return $hop;
				}
			}
		}

		return $remote;
	}

	/**
	 * Whether a string is an IPv4 or IPv6 address.
	 *
	 * @param string $ip Candidate.
	 * @return bool
	 */
	public static function valid( string $ip ): bool {
		return '' !== $ip && false !== filter_var( $ip, FILTER_VALIDATE_IP );
	}

	/**
	 * Whether a string is an IP address or a CIDR range with a sensible prefix length.
	 *
	 * @param string $range Address or "address/bits".
	 * @return bool
	 */
	public static function valid_range( string $range ): bool {
		$parts = explode( '/', trim( $range ), 2 );
		if ( ! self::valid( $parts[0] ) ) {
			return false;
		}
		if ( ! isset( $parts[1] ) ) {
			return true;
		}
		$bits = false !== strpos( $parts[0], ':' ) ? 128 : 32;
		return ctype_digit( $parts[1] ) && (int) $parts[1] <= $bits;
	}

	/**
	 * Whether an address is inside any of the given addresses or CIDR ranges.
	 *
	 * @param string   $ip     Address.
	 * @param string[] $ranges Addresses and CIDR ranges.
	 * @return bool
	 */
	public static function in_ranges( string $ip, array $ranges ): bool {
		foreach ( $ranges as $range ) {
			if ( is_string( $range ) && self::in_range( $ip, trim( $range ) ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Whether an address is inside one address or CIDR range.
	 *
	 * @param string $ip    Address.
	 * @param string $range Address or CIDR range.
	 * @return bool
	 */
	public static function in_range( string $ip, string $range ): bool {
		if ( '' === $range ) {
			return false;
		}
		$parts  = explode( '/', $range, 2 );
		$subnet = @inet_pton( $parts[0] ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- Invalid input is handled below.
		$addr   = @inet_pton( $ip ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- Invalid input is handled below.
		if ( false === $subnet || false === $addr || strlen( $subnet ) !== strlen( $addr ) ) {
			return false;
		}
		$bits = strlen( $subnet ) * 8;
		$mask = isset( $parts[1] ) && ctype_digit( $parts[1] ) ? (int) $parts[1] : $bits;
		if ( $mask > $bits ) {
			return false;
		}

		$full = intdiv( $mask, 8 );
		if ( $full > 0 && substr( $subnet, 0, $full ) !== substr( $addr, 0, $full ) ) {
			return false;
		}
		$rest = $mask % 8;
		if ( 0 === $rest ) {
			return true;
		}
		$byte_mask = ( 0xFF << ( 8 - $rest ) ) & 0xFF;
		return ( ord( $subnet[ $full ] ) & $byte_mask ) === ( ord( $addr[ $full ] ) & $byte_mask );
	}

	/**
	 * Turn the setting (a string or an array) into a clean list.
	 *
	 * @param mixed $value Setting value.
	 * @return string[]
	 */
	public static function parse_list( $value ): array {
		if ( is_string( $value ) ) {
			$value = preg_split( '/[\s,]+/', $value ) ?: array();
		}
		if ( ! is_array( $value ) ) {
			return array();
		}
		$out = array();
		foreach ( $value as $item ) {
			if ( is_string( $item ) && '' !== trim( $item ) ) {
				$out[] = trim( $item );
			}
		}
		return $out;
	}

	/**
	 * One $_SERVER value, sanitized, or an empty string.
	 *
	 * @param string $key Server key.
	 * @return string
	 */
	private static function server_value( string $key ): string {
		return isset( $_SERVER[ $key ] ) ? trim( sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) ) ) : '';
	}
}
