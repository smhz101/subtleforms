<?php
/**
 * Atomic request counters for sites without a persistent object cache.
 *
 * @package SubtleForms\Security
 */

namespace SubtleForms\Security;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * One row per bucket and fixed window. A hit is a single INSERT ... ON
 * DUPLICATE KEY UPDATE, so two simultaneous requests are both counted.
 * Old windows are removed daily and the table is dropped on uninstall.
 */
final class RateLimitStore {

	/** Option holding "1" once the table exists. */
	public const DB_OPTION = 'subtleforms_rate_limits_db';

	/** Rows older than this many seconds are pruned. */
	private const KEEP_SECONDS = 86400;

	/** Whether the table is known to exist in this request. */
	private static $ready = null;

	/**
	 * Table name.
	 */
	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'subtleforms_rate_limits';
	}

	/**
	 * Hook the daily prune. Called once from Plugin::init().
	 */
	public static function register(): void {
		add_action( 'subtleforms_daily_cleanup', array( __CLASS__, 'prune' ) );
	}

	/**
	 * Create the table through dbDelta.
	 */
	public static function install(): void {
		global $wpdb;
		if ( ! function_exists( 'dbDelta' ) ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		}
		$table   = self::table();
		$charset = $wpdb->get_charset_collate();
		dbDelta(
			"CREATE TABLE {$table} (
  bucket char(32) NOT NULL,
  window_start int unsigned NOT NULL DEFAULT 0,
  hits int unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY  (bucket),
  KEY window_start (window_start)
) {$charset};"
		);
		update_option( self::DB_OPTION, '1', false );
		self::$ready = null;
	}

	/**
	 * Create the table when it is missing (sites that were already running).
	 */
	public static function ensure(): bool {
		if ( null !== self::$ready ) {
			return self::$ready;
		}
		if ( '1' !== get_option( self::DB_OPTION ) ) {
			self::install();
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		self::$ready = self::table() === $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( self::table() ) ) );
		return self::$ready;
	}

	/**
	 * Count one request in the current window of a bucket.
	 *
	 * @param string $key           Bucket name.
	 * @param int    $windowSeconds Window length.
	 * @param int    $now           Unix time.
	 * @return array{hits:int, reset_in:int}|null Null when the table cannot be used.
	 */
	public static function hit( string $key, int $windowSeconds, int $now ): ?array {
		if ( $windowSeconds < 1 || ! self::ensure() ) {
			return null;
		}
		global $wpdb;
		$table  = self::table();
		$bucket = md5( $key );
		$start  = $now - ( $now % $windowSeconds );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; values are prepared.
		$ok = $wpdb->query(
			$wpdb->prepare(
				"INSERT INTO {$table} (bucket, window_start, hits) VALUES (%s, %d, 1)
				ON DUPLICATE KEY UPDATE hits = CASE WHEN window_start = %d THEN hits + 1 ELSE 1 END, window_start = %d",
				$bucket,
				$start,
				$start,
				$start
			)
		);
		if ( false === $ok ) {
			return null;
		}
		$hits = (int) $wpdb->get_var( $wpdb->prepare( "SELECT hits FROM {$table} WHERE bucket = %s", $bucket ) );
		// phpcs:enable

		return array(
			'hits'     => max( 1, $hits ),
			'reset_in' => max( 1, $start + $windowSeconds - $now ),
		);
	}

	/**
	 * Remove windows that ended long ago.
	 */
	public static function prune(): void {
		global $wpdb;
		if ( '1' !== get_option( self::DB_OPTION ) ) {
			return;
		}
		$table = self::table();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; value is prepared.
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE window_start < %d", time() - self::KEEP_SECONDS ) );
	}
}
