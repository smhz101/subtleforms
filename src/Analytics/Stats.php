<?php
/**
 * Form analytics: daily view and submission counters.
 *
 * One row per form per day (UTC) in `{prefix}subtleforms_stats`. Nothing that
 * identifies a visitor is stored: a view is a counter increment, and the
 * beacon that triggers it sets no cookies.
 *
 * Counting is part of the free plugin so history is there from day one; the
 * reports that read it are gated by the `extensions.analytics` capability
 * (see Api\AnalyticsApi).
 *
 * @package SubtleForms\Analytics
 * @since   2.1.0
 */

namespace SubtleForms\Analytics;

use SubtleForms\Support\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Stats store and hooks.
 */
final class Stats {

	/** Option holding the installed table version. */
	const DB_OPTION = 'subtleforms_stats_db';

	/** Current table version. */
	const DB_VERSION = '1';

	/** Daily prune event. */
	const PRUNE_HOOK = 'subtleforms_stats_prune';

	/** Maximum days a report may span. */
	const MAX_DAYS = 365;

	/**
	 * Register hooks. Called once from Plugin::init().
	 */
	public static function register(): void {
		add_action( 'init', array( __CLASS__, 'maybeInstall' ), 5 );
		add_action( 'subtleforms/submission/completed', array( __CLASS__, 'onSubmission' ), 5, 2 );
		// Entries in the Trash do not count (2.3.1).
		add_action( 'subtleforms/submission/trashed', array( __CLASS__, 'onTrashed' ), 10, 2 );
		add_action( 'subtleforms/submission/untrashed', array( __CLASS__, 'onUntrashed' ), 10, 3 );
		add_action( self::PRUNE_HOOK, array( __CLASS__, 'prune' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'registerRoutes' ) );

		add_action(
			'init',
			static function () {
				if ( ! wp_next_scheduled( self::PRUNE_HOOK ) ) {
					wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::PRUNE_HOOK );
				}
			},
			30
		);
	}

	/**
	 * Register the REST routes.
	 */
	public static function registerRoutes(): void {
		( new \SubtleForms\Api\AnalyticsApi() )->registerRoutes();
	}

	/**
	 * Table name.
	 */
	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'subtleforms_stats';
	}

	/**
	 * Create or upgrade the table.
	 */
	public static function maybeInstall(): void {
		if ( get_option( self::DB_OPTION ) === self::DB_VERSION ) {
			return;
		}

		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$table   = self::table();
		$charset = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$table} (
  form_id bigint(20) unsigned NOT NULL,
  day date NOT NULL,
  views int(11) unsigned NOT NULL DEFAULT 0,
  submissions int(11) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY  (form_id,day),
  KEY day (day)
) {$charset};"
		);

		update_option( self::DB_OPTION, self::DB_VERSION, false );
	}

	/**
	 * Whether view counting is switched on.
	 *
	 * @param Settings|null $settings Settings instance.
	 */
	public static function tracksViews( ?Settings $settings = null ): bool {
		$settings = $settings ?? new Settings();
		$enabled  = (bool) $settings->get( 'ext_analytics_enabled' ) && (bool) $settings->get( 'ext_analytics_view_tracking' );

		/**
		 * Filter whether SubtleForms counts form views.
		 *
		 * @param bool $enabled Whether views are counted.
		 * @since 2.1.0
		 */
		return (bool) apply_filters( 'subtleforms/analytics/track_views', $enabled );
	}

	/**
	 * Whether analytics is collected for a form (per-form opt-out in
	 * metadata.integrations.analytics.enabled).
	 *
	 * @param array|null $schema Active schema.
	 */
	public static function formAllows( $schema ): bool {
		if ( ! is_array( $schema ) ) {
			return true;
		}
		$flag = $schema['metadata']['integrations']['analytics']['enabled'] ?? null;
		return false !== $flag && 'false' !== $flag && 0 !== $flag;
	}

	/**
	 * Count a submission (hooked to subtleforms/submission/completed).
	 *
	 * @param int $submissionId Entry ID (unused).
	 * @param int $formId       Form ID.
	 */
	public static function onSubmission( $submissionId, $formId ): void {
		$settings = new Settings();
		if ( ! (bool) $settings->get( 'ext_analytics_enabled' ) ) {
			return;
		}
		self::increment( (int) $formId, 'submissions' );
	}

	/**
	 * Statuses of entries that were counted as submissions.
	 */
	const COUNTED_STATUSES = array( 'completed', 'saved', 'unread', 'read', 'flagged', 'payment_pending' );

	/**
	 * Take a trashed entry out of its day's submission count.
	 *
	 * @param int   $id         Entry ID.
	 * @param array $submission Entry row before it was trashed.
	 */
	public static function onTrashed( $id, $submission ): void {
		if ( is_array( $submission ) && in_array( (string) ( $submission['status'] ?? '' ), self::COUNTED_STATUSES, true ) ) {
			self::adjustSubmissions( (int) ( $submission['form_id'] ?? 0 ), (string) ( $submission['created_at'] ?? '' ), -1 );
		}
	}

	/**
	 * Count a restored entry again.
	 *
	 * @param int    $id         Entry ID.
	 * @param string $status     Restored status.
	 * @param array  $submission Entry row while it was in the Trash.
	 */
	public static function onUntrashed( $id, $status, $submission ): void {
		if ( is_array( $submission ) && in_array( (string) $status, self::COUNTED_STATUSES, true ) ) {
			self::adjustSubmissions( (int) ( $submission['form_id'] ?? 0 ), (string) ( $submission['created_at'] ?? '' ), 1 );
		}
	}

	/**
	 * Change the submission count of the day an entry was sent.
	 *
	 * @param int    $formId    Form ID.
	 * @param string $createdAt Entry time (UTC, Y-m-d H:i:s).
	 * @param int    $delta     +1 or -1.
	 */
	public static function adjustSubmissions( int $formId, string $createdAt, int $delta ): void {
		if ( $formId <= 0 || 0 === $delta ) {
			return;
		}
		$day = '' !== $createdAt ? substr( $createdAt, 0, 10 ) : gmdate( 'Y-m-d' );
		if ( $delta > 0 ) {
			self::increment( $formId, 'submissions', $day );
			return;
		}
		global $wpdb;
		$table = self::table();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared values; counters must not be cached.
		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET submissions = submissions - 1 WHERE form_id = %d AND day = %s AND submissions > 0", $formId, $day ) );
	}

	/**
	 * Add one to a counter for today.
	 *
	 * Written as UPDATE, then INSERT IGNORE + UPDATE when the row does not
	 * exist yet, which is atomic on MySQL and works on SQLite.
	 *
	 * @param int    $formId Form ID.
	 * @param string $column 'views' or 'submissions'.
	 * @param string $day    Y-m-d (UTC). Defaults to today.
	 */
	public static function increment( int $formId, string $column, string $day = '' ): bool {
		if ( $formId <= 0 || ! in_array( $column, array( 'views', 'submissions' ), true ) ) {
			return false;
		}

		self::maybeInstall();

		global $wpdb;
		$table = self::table();
		$day   = '' !== $day ? $day : gmdate( 'Y-m-d' );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Table and column names are fixed; values are prepared. Counters must not be cached.
		$updated = $wpdb->query( $wpdb->prepare( "UPDATE {$table} SET {$column} = {$column} + 1 WHERE form_id = %d AND day = %s", $formId, $day ) );

		if ( ! $updated ) {
			$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$table} (form_id, day, views, submissions) VALUES (%d, %s, 0, 0)", $formId, $day ) );
			$updated = $wpdb->query( $wpdb->prepare( "UPDATE {$table} SET {$column} = {$column} + 1 WHERE form_id = %d AND day = %s", $formId, $day ) );
		}
		// phpcs:enable

		return (bool) $updated;
	}

	/**
	 * Totals per form over the last N days (today included).
	 *
	 * @param int $days Number of days.
	 * @return array<int,array{views:int,submissions:int}> Keyed by form ID.
	 */
	public static function totalsByForm( int $days ): array {
		global $wpdb;
		$table = self::table();
		$since = self::since( $days );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared values; report data changes every request.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT form_id, SUM(views) AS views, SUM(submissions) AS submissions FROM {$table} WHERE day >= %s GROUP BY form_id", $since ), ARRAY_A );

		$out = array();
		foreach ( (array) $rows as $row ) {
			$out[ (int) $row['form_id'] ] = array(
				'views'       => (int) $row['views'],
				'submissions' => (int) $row['submissions'],
			);
		}
		return $out;
	}

	/**
	 * Daily series over the last N days, zero-filled, oldest first.
	 *
	 * @param int      $days   Number of days.
	 * @param int|null $formId One form, or null for all forms.
	 * @return array<int,array{date:string,views:int,submissions:int}>
	 */
	public static function series( int $days, ?int $formId = null ): array {
		global $wpdb;
		$table = self::table();
		$days  = max( 1, min( self::MAX_DAYS, $days ) );
		$since = self::since( $days );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared values; report data changes every request.
		if ( $formId ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT day, SUM(views) AS views, SUM(submissions) AS submissions FROM {$table} WHERE day >= %s AND form_id = %d GROUP BY day", $since, $formId ), ARRAY_A );
		} else {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT day, SUM(views) AS views, SUM(submissions) AS submissions FROM {$table} WHERE day >= %s GROUP BY day", $since ), ARRAY_A );
		}
		// phpcs:enable

		$byDay = array();
		foreach ( (array) $rows as $row ) {
			$byDay[ substr( (string) $row['day'], 0, 10 ) ] = $row;
		}

		$out   = array();
		$start = strtotime( $since . ' 00:00:00 UTC' );
		for ( $i = 0; $i < $days; $i++ ) {
			$date  = gmdate( 'Y-m-d', $start + $i * DAY_IN_SECONDS );
			$out[] = array(
				'date'        => $date,
				'views'       => isset( $byDay[ $date ] ) ? (int) $byDay[ $date ]['views'] : 0,
				'submissions' => isset( $byDay[ $date ] ) ? (int) $byDay[ $date ]['submissions'] : 0,
			);
		}
		return $out;
	}

	/**
	 * Conversion rate as a percentage with one decimal, or null without views.
	 *
	 * @param int $views       Views.
	 * @param int $submissions Submissions.
	 */
	public static function conversion( int $views, int $submissions ): ?float {
		if ( $views <= 0 ) {
			return null;
		}
		return round( min( 100, ( $submissions / $views ) * 100 ), 1 );
	}

	/**
	 * Delete rows older than the retention period.
	 */
	public static function prune(): void {
		$settings = new Settings();
		$days     = max( 1, (int) $settings->get( 'ext_analytics_retention_days' ) );

		global $wpdb;
		$table = self::table();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared value; maintenance query.
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE day < %s", gmdate( 'Y-m-d', time() - ( $days - 1 ) * DAY_IN_SECONDS ) ) );
	}

	/**
	 * First day (Y-m-d, UTC) of an N-day window ending today.
	 *
	 * @param int $days Number of days.
	 */
	public static function since( int $days ): string {
		$days = max( 1, min( self::MAX_DAYS, $days ) );
		return gmdate( 'Y-m-d', time() - ( $days - 1 ) * DAY_IN_SECONDS );
	}
}
