<?php
/**
 * Database feature detection.
 *
 * @package SubtleForms
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Detects optional database engine capabilities.
 *
 * WordPress still supports MySQL 5.5 and MariaDB 10.0, neither of which has the
 * native JSON functions (JSON_EXTRACT / JSON_UNQUOTE) introduced in MySQL 5.7
 * and MariaDB 10.2. Queries that use them must degrade rather than fatal.
 */
final class DatabaseFeatures {

	/**
	 * Cached result for the current request.
	 *
	 * @var bool|null
	 */
	private static $supports_json = null;

	/**
	 * Option key used to persist detection between requests.
	 */
	private const OPTION_KEY = 'subtleforms_db_supports_json';

	/**
	 * Whether the database engine provides JSON_EXTRACT / JSON_UNQUOTE.
	 *
	 * @return bool
	 */
	public static function supportsJson(): bool {
		if ( self::$supports_json !== null ) {
			return self::$supports_json;
		}

		$cached = get_option( self::OPTION_KEY, null );
		if ( $cached !== null && $cached !== '' ) {
			self::$supports_json = (bool) $cached;
			return self::$supports_json;
		}

		self::$supports_json = self::detect();
		update_option( self::OPTION_KEY, self::$supports_json ? '1' : '0', false );

		return self::$supports_json;
	}

	/**
	 * Reset the cached value. Called on activation and upgrade.
	 */
	public static function flush(): void {
		self::$supports_json = null;
		delete_option( self::OPTION_KEY );
	}

	/**
	 * Probe the server version for JSON function support.
	 *
	 * @return bool
	 */
	private static function detect(): bool {
		global $wpdb;

		$version = '';
		if ( isset( $wpdb ) && method_exists( $wpdb, 'db_server_info' ) ) {
			$version = (string) $wpdb->db_server_info();
		}

		if ( $version === '' ) {
			return false;
		}

		$is_mariadb = stripos( $version, 'mariadb' ) !== false;

		if ( ! preg_match( '/(\d+)\.(\d+)(?:\.(\d+))?/', $version, $matches ) ) {
			return false;
		}

		$major = (int) $matches[1];
		$minor = (int) $matches[2];

		// MariaDB gained JSON_EXTRACT in 10.2; MySQL in 5.7.
		if ( $is_mariadb ) {
			return ( $major > 10 ) || ( $major === 10 && $minor >= 2 );
		}

		return ( $major > 5 ) || ( $major === 5 && $minor >= 7 );
	}
}
