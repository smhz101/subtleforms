<?php
/**
 * Queries behind the Dashboard, the Reports screen and the WordPress dashboard
 * widget: entries per day, per form and per option.
 *
 * Every query reads the indexed `created_at`, `form_id` and `status` columns
 * and groups in SQL, so the work does not grow with the number of entries in
 * the window. Only real entries count (spam, failed, preview and trashed ones
 * do not), the same rule the first Reports chart used.
 *
 * @package SubtleForms\Tools
 * @since   2.7.5
 */

namespace SubtleForms\Tools;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read-only report queries.
 */
final class ReportQueries {

	/**
	 * UTC start of a local calendar day.
	 *
	 * @param string        $date Y-m-d in the site's zone.
	 * @param \DateTimeZone $zone Site zone.
	 * @return string Y-m-d H:i:s in UTC.
	 */
	public static function dayStartUtc( string $date, \DateTimeZone $zone ): string {
		$local = \DateTimeImmutable::createFromFormat( '!Y-m-d', $date, $zone );
		if ( ! $local ) {
			$local = new \DateTimeImmutable( 'today', $zone );
		}
		return $local->setTimezone( new \DateTimeZone( 'UTC' ) )->format( 'Y-m-d H:i:s' );
	}

	/**
	 * Local date n days after (or before, when negative) another local date.
	 *
	 * @param string $date Y-m-d.
	 * @param int    $days Days to add.
	 * @return string Y-m-d.
	 */
	public static function addDays( string $date, int $days ): string {
		$base = \DateTimeImmutable::createFromFormat( '!Y-m-d', $date, new \DateTimeZone( 'UTC' ) );
		if ( ! $base ) {
			return $date;
		}
		return $base->modify( ( $days >= 0 ? '+' : '' ) . $days . ' days' )->format( 'Y-m-d' );
	}

	/**
	 * Whether every hour in the zone starts on a whole UTC hour now and half
	 * a year ago. Then entries can be grouped by UTC hour in SQL and each
	 * group still falls on one local day.
	 *
	 * @param \DateTimeZone $zone Site zone.
	 * @return bool
	 */
	private static function wholeHourZone( \DateTimeZone $zone ): bool {
		$now = time();
		return 0 === $zone->getOffset( new \DateTimeImmutable( '@' . $now ) ) % 3600
			&& 0 === $zone->getOffset( new \DateTimeImmutable( '@' . ( $now - 15552000 ) ) ) % 3600;
	}

	/**
	 * SQL for the statuses that count, with placeholders.
	 *
	 * @return array{0:string,1:string[]} Condition and its values.
	 */
	private static function countedCondition(): array {
		$counted = ReportSeries::COUNTED_STATUSES;
		$in      = implode( ',', array_fill( 0, count( $counted ), '%s' ) );
		return array( "( status IS NULL OR status IN ({$in}) )", $counted );
	}

	/**
	 * Entries per local day.
	 *
	 * @param string        $fromUtc First instant, Y-m-d H:i:s UTC (inclusive).
	 * @param string        $toUtc   End, Y-m-d H:i:s UTC (exclusive).
	 * @param int           $formId  One form, or 0 for every form.
	 * @param \DateTimeZone $zone    Site zone.
	 * @return array<string,int> Local date to count; days without entries are missing.
	 */
	public static function dailyCounts( string $fromUtc, string $toUtc, int $formId, \DateTimeZone $zone ): array {
		global $wpdb;
		$table                 = $wpdb->prefix . 'subtleforms_submissions';
		list( $cond, $values ) = self::countedCondition();
		$args                  = array_merge( array( $fromUtc, $toUtc ), $values );
		$form                  = '';
		if ( $formId > 0 ) {
			$form   = ' AND form_id = %d';
			$args[] = $formId;
		}

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Fixed table name; conditions are built here; every value is a placeholder.
		if ( self::wholeHourZone( $zone ) ) {
			$rows = (array) $wpdb->get_results(
				$wpdb->prepare(
					"SELECT SUBSTR( created_at, 1, 13 ) AS bucket, COUNT(*) AS total FROM {$table} WHERE created_at >= %s AND created_at < %s AND {$cond}{$form} GROUP BY bucket",
					$args
				),
				ARRAY_A
			);
			$out = array();
			foreach ( $rows as $row ) {
				$stamp = $row['bucket'] . ':00:00';
				$day   = array_key_first( ReportSeries::countByLocalDay( array( $stamp ), $zone ) );
				if ( null !== $day ) {
					$out[ $day ] = ( $out[ $day ] ?? 0 ) + (int) $row['total'];
				}
			}
			return $out;
		}

		// A zone with a 30 or 45 minute offset: an hour can span two local days.
		$stamps = (array) $wpdb->get_col(
			$wpdb->prepare(
				"SELECT created_at FROM {$table} WHERE created_at >= %s AND created_at < %s AND {$cond}{$form}",
				$args
			)
		);
		// phpcs:enable
		return ReportSeries::countByLocalDay( $stamps, $zone );
	}

	/**
	 * Entries in a window, in total.
	 *
	 * @param string $fromUtc First instant (inclusive).
	 * @param string $toUtc   End (exclusive).
	 * @param int    $formId  One form, or 0 for every form.
	 * @return int
	 */
	public static function total( string $fromUtc, string $toUtc, int $formId = 0 ): int {
		global $wpdb;
		$table                 = $wpdb->prefix . 'subtleforms_submissions';
		list( $cond, $values ) = self::countedCondition();
		$args                  = array_merge( array( $fromUtc, $toUtc ), $values );
		$form                  = '';
		if ( $formId > 0 ) {
			$form   = ' AND form_id = %d';
			$args[] = $formId;
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Fixed table name; every value is a placeholder.
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE created_at >= %s AND created_at < %s AND {$cond}{$form}", $args ) );
	}

	/**
	 * Entries per form in a window: how many, how many are unread and (per day)
	 * how they are spread, for the sparkline.
	 *
	 * @param string        $fromUtc First instant (inclusive).
	 * @param string        $toUtc   End (exclusive).
	 * @param \DateTimeZone $zone    Site zone.
	 * @return array<int,array{entries:int,unread:int,days:array<string,int>}> Keyed by form id.
	 */
	public static function perForm( string $fromUtc, string $toUtc, \DateTimeZone $zone ): array {
		global $wpdb;
		$table                 = $wpdb->prefix . 'subtleforms_submissions';
		list( $cond, $values ) = self::countedCondition();
		$args                  = array_merge( array( $fromUtc, $toUtc ), $values );
		$out                   = array();

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Fixed table name; conditions are built here; every value is a placeholder.
		$totals = (array) $wpdb->get_results(
			$wpdb->prepare(
				"SELECT form_id, COUNT(*) AS entries, SUM( CASE WHEN is_read = 0 THEN 1 ELSE 0 END ) AS unread FROM {$table} WHERE created_at >= %s AND created_at < %s AND {$cond} GROUP BY form_id",
				$args
			),
			ARRAY_A
		);
		foreach ( $totals as $row ) {
			$out[ (int) $row['form_id'] ] = array(
				'entries' => (int) $row['entries'],
				'unread'  => (int) $row['unread'],
				'days'    => array(),
			);
		}
		if ( ! $out ) {
			return $out;
		}

		if ( self::wholeHourZone( $zone ) ) {
			$buckets = (array) $wpdb->get_results(
				$wpdb->prepare(
					"SELECT form_id, SUBSTR( created_at, 1, 13 ) AS bucket, COUNT(*) AS total FROM {$table} WHERE created_at >= %s AND created_at < %s AND {$cond} GROUP BY form_id, bucket",
					$args
				),
				ARRAY_A
			);
			foreach ( $buckets as $row ) {
				$form = (int) $row['form_id'];
				$day  = array_key_first( ReportSeries::countByLocalDay( array( $row['bucket'] . ':00:00' ), $zone ) );
				if ( null !== $day && isset( $out[ $form ] ) ) {
					$out[ $form ]['days'][ $day ] = ( $out[ $form ]['days'][ $day ] ?? 0 ) + (int) $row['total'];
				}
			}
		} else {
			$rows = (array) $wpdb->get_results(
				$wpdb->prepare(
					"SELECT form_id, created_at FROM {$table} WHERE created_at >= %s AND created_at < %s AND {$cond}",
					$args
				),
				ARRAY_A
			);
			foreach ( $rows as $row ) {
				$form = (int) $row['form_id'];
				$day  = array_key_first( ReportSeries::countByLocalDay( array( $row['created_at'] ), $zone ) );
				if ( null !== $day && isset( $out[ $form ] ) ) {
					$out[ $form ]['days'][ $day ] = ( $out[ $form ]['days'][ $day ] ?? 0 ) + 1;
				}
			}
		}
		// phpcs:enable
		return $out;
	}

	/**
	 * Published forms that received no entry since a moment.
	 *
	 * @param string $sinceUtc Y-m-d H:i:s UTC.
	 * @param int    $limit    Most forms to return.
	 * @return array{count:int,forms:array<int,array{id:int,title:string}>}
	 */
	public static function formsWithoutEntries( string $sinceUtc, int $limit = 5 ): array {
		global $wpdb;
		$forms                 = $wpdb->prefix . 'subtleforms_forms';
		$table                 = $wpdb->prefix . 'subtleforms_submissions';
		list( $cond, $values ) = self::countedCondition();
		$sub                   = str_replace( array( 'status' ), array( 's.status' ), $cond );
		$args                  = array_merge( array( $sinceUtc ), $values );

		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber -- Fixed table names; conditions are built here; every value is a placeholder.
		$from  = "FROM {$forms} f WHERE f.status = 'published' AND NOT EXISTS ( SELECT 1 FROM {$table} s WHERE s.form_id = f.id AND s.created_at >= %s AND {$sub} )";
		$count = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) {$from}", $args ) );
		$rows  = array();
		if ( $count > 0 ) {
			$rows = (array) $wpdb->get_results(
				$wpdb->prepare( "SELECT f.id, f.title {$from} ORDER BY f.updated_at DESC LIMIT %d", array_merge( $args, array( max( 1, $limit ) ) ) ),
				ARRAY_A
			);
		}
		// phpcs:enable

		$list = array();
		foreach ( $rows as $row ) {
			$list[] = array(
				'id'    => (int) $row['id'],
				'title' => (string) $row['title'],
			);
		}
		return array(
			'count' => $count,
			'forms' => $list,
		);
	}

	/**
	 * Number of failures the integrations logged since a moment: webhooks,
	 * email marketing and the actions of add-ons write them as error rows.
	 *
	 * @param string $sinceUtc Y-m-d H:i:s UTC.
	 * @return int
	 */
	public static function integrationFailures( string $sinceUtc ): int {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_logs';
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table name; every value is a placeholder.
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE level = %s AND created_at >= %s", 'error', $sinceUtc ) );
	}

	/**
	 * The label and slot of a choice-like field type, or null when a report
	 * does not summarise it.
	 *
	 * @param array $field Schema field.
	 * @return string|null `choice`, `rating` or null.
	 */
	public static function summaryKind( array $field ): ?string {
		$type = (string) ( $field['type'] ?? '' );
		if ( in_array( $type, array( 'select', 'radio', 'checkbox', 'checkboxes', 'multiselect', 'multi_select', 'dropdown', 'choice', 'picture_choice', 'image_choice' ), true ) ) {
			return 'choice';
		}
		if ( in_array( $type, array( 'rating', 'nps', 'scale', 'opinion_scale', 'star_rating', 'slider' ), true ) ) {
			return 'rating';
		}
		return null;
	}
}
