<?php
/**
 * Blocked spam counter.
 *
 * One row per form, day (UTC) and reason in `{prefix}subtleforms_spam_stats`,
 * holding how many submissions were blocked. Nothing about the visitor is
 * stored: no IP address, no answers, no user agent. Rows older than a year
 * are removed every day, and uninstall drops the table with the others.
 *
 * Anything that blocks a submission fires `subtleforms/spam/blocked` with the
 * form ID and a reason; this class counts it. Add-ons (an Akismet check, a
 * spam rule) fire the same action to appear in the same counts.
 *
 * @package SubtleForms\Analytics
 * @since   2.6.0
 */

namespace SubtleForms\Analytics;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Spam counter store and hooks.
 */
final class SpamStats {

	/** Option holding the installed table version. */
	const DB_OPTION = 'subtleforms_spam_stats_db';

	/** Current table version. */
	const DB_VERSION = '1';

	/** Daily prune event. */
	const PRUNE_HOOK = 'subtleforms_spam_stats_prune';

	/** Action fired when a submission is blocked: ( int $formId, string $reason ). */
	const BLOCKED_ACTION = 'subtleforms/spam/blocked';

	/** Days a row is kept. */
	const RETENTION_DAYS = 365;

	/** Longest window a report may ask for. */
	const MAX_DAYS = 365;

	/**
	 * Reasons that are counted. Anything else is counted as "other".
	 */
	const REASONS = array( 'honeypot', 'time_trap', 'rate_limit', 'captcha_failed', 'spam_rule', 'other' );

	/**
	 * Register hooks. Called once from Plugin::init().
	 */
	public static function register(): void {
		add_action( 'init', array( __CLASS__, 'maybeInstall' ), 5 );
		add_action( self::BLOCKED_ACTION, array( __CLASS__, 'record' ), 10, 2 );
		add_action( self::PRUNE_HOOK, array( __CLASS__, 'prune' ) );
		add_action( 'subtleforms/form/deleted', array( __CLASS__, 'deleteForm' ) );
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
	 * Remove the blocked counts of a form that was deleted for good.
	 *
	 * @param int $formId Form ID.
	 */
	public static function deleteForm( $formId ): void {
		global $wpdb;
		$table = self::table();
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; value is prepared.
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE form_id = %d", (int) $formId ) );
	}

	/**
	 * Count a blocked submission: fires the action this class listens to.
	 *
	 * @param int    $formId Form ID.
	 * @param string $reason One of REASONS, or a detailed reason that maps to one.
	 */
	public static function blocked( int $formId, string $reason ): void {
		/**
		 * A submission was blocked as spam. Nothing about the visitor is passed.
		 *
		 * @param int    $formId Form ID.
		 * @param string $reason honeypot, time_trap, rate_limit, captcha_failed, spam_rule or other.
		 * @since 2.6.0
		 */
		do_action( 'subtleforms/spam/blocked', $formId, self::normalizeReason( $reason ) );
	}

	/**
	 * The counted reason for a detailed reason.
	 *
	 * @param string $reason Reason, for example honeypot_filled or submission_too_fast.
	 * @return string One of REASONS.
	 */
	public static function normalizeReason( string $reason ): string {
		$map = array(
			'honeypot_filled'     => 'honeypot',
			'submission_too_fast' => 'time_trap',
			'time_token_missing'  => 'time_trap',
		);
		$reason = $map[ $reason ] ?? $reason;
		return in_array( $reason, self::REASONS, true ) ? $reason : 'other';
	}

	/**
	 * Table name.
	 */
	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'subtleforms_spam_stats';
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
  reason varchar(32) NOT NULL,
  blocked int(11) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY  (form_id,day,reason),
  KEY day (day)
) {$charset};"
		);

		// Autoloaded: it is read on every request, and a tiny value.
		update_option( self::DB_OPTION, self::DB_VERSION, true );
	}

	/**
	 * Add one to today's count for a form and reason.
	 *
	 * Written as UPDATE, then INSERT IGNORE + UPDATE when the row does not
	 * exist yet, like Stats::increment(), which works on MySQL and SQLite.
	 *
	 * @param mixed  $formId Form ID.
	 * @param mixed  $reason Reason.
	 * @param string $day    Y-m-d (UTC). Defaults to today.
	 * @return bool Whether a count was added.
	 */
	public static function record( $formId, $reason = 'other', string $day = '' ): bool {
		$formId = (int) $formId;
		if ( $formId <= 0 ) {
			return false;
		}
		$reason = self::normalizeReason( is_string( $reason ) ? $reason : '' );
		$day    = 1 === preg_match( '/^\d{4}-\d{2}-\d{2}$/', $day ) ? $day : gmdate( 'Y-m-d' );

		self::maybeInstall();

		global $wpdb;
		$table = self::table();

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; values are prepared. Counters must not be cached.
		$updated = $wpdb->query( $wpdb->prepare( "UPDATE {$table} SET blocked = blocked + 1 WHERE form_id = %d AND day = %s AND reason = %s", $formId, $day, $reason ) );
		if ( ! $updated ) {
			$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$table} (form_id, day, reason, blocked) VALUES (%d, %s, %s, 0)", $formId, $day, $reason ) );
			$updated = $wpdb->query( $wpdb->prepare( "UPDATE {$table} SET blocked = blocked + 1 WHERE form_id = %d AND day = %s AND reason = %s", $formId, $day, $reason ) );
		}
		// phpcs:enable

		return (bool) $updated;
	}

	/**
	 * Totals over the last N days (today included), for one form or all.
	 *
	 * @param int      $days   Number of days.
	 * @param int|null $formId One form, or null for every form.
	 * @return array{total:int, days:array<int,array{date:string,count:int}>, reasons:array<string,int>, since:string}
	 */
	public static function summary( int $days, ?int $formId = null ): array {
		$days  = max( 1, min( self::MAX_DAYS, $days ) );
		$since = self::since( $days );

		self::maybeInstall();

		global $wpdb;
		$table = self::table();

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared values; counts change every request.
		if ( $formId ) {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT day, reason, SUM(blocked) AS total FROM {$table} WHERE day >= %s AND form_id = %d GROUP BY day, reason", $since, $formId ), ARRAY_A );
		} else {
			$rows = $wpdb->get_results( $wpdb->prepare( "SELECT day, reason, SUM(blocked) AS total FROM {$table} WHERE day >= %s GROUP BY day, reason", $since ), ARRAY_A );
		}
		// phpcs:enable

		$byDay   = array();
		$reasons = array_fill_keys( self::REASONS, 0 );
		$total   = 0;
		foreach ( (array) $rows as $row ) {
			$count  = (int) $row['total'];
			$date   = substr( (string) $row['day'], 0, 10 );
			$reason = self::normalizeReason( (string) $row['reason'] );

			$byDay[ $date ]      = ( $byDay[ $date ] ?? 0 ) + $count;
			$reasons[ $reason ] += $count;
			$total              += $count;
		}

		$series = array();
		$start  = strtotime( $since . ' 00:00:00 UTC' );
		for ( $i = 0; $i < $days; $i++ ) {
			$date     = gmdate( 'Y-m-d', $start + $i * DAY_IN_SECONDS );
			$series[] = array(
				'date'  => $date,
				'count' => (int) ( $byDay[ $date ] ?? 0 ),
			);
		}

		return array(
			'total'   => $total,
			'days'    => $series,
			'reasons' => $reasons,
			'since'   => $since,
		);
	}

	/**
	 * Delete rows older than RETENTION_DAYS.
	 *
	 * @param int|null $now Unix time. Defaults to now.
	 * @return int Rows removed.
	 */
	public static function prune( $now = null ): int {
		$now = is_int( $now ) ? $now : time();
		self::maybeInstall();

		global $wpdb;
		$table  = self::table();
		$cutoff = gmdate( 'Y-m-d', $now - ( self::RETENTION_DAYS - 1 ) * DAY_IN_SECONDS );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; prepared value; maintenance query.
		return (int) $wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE day < %s", $cutoff ) );
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
