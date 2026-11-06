<?php
/**
 * The numbers the Dashboard screen and the WordPress dashboard widget show.
 *
 * One call builds all of them from a handful of grouped queries and keeps the
 * result for a minute. The cache key carries the entries generation that the
 * submissions repository bumps on every change, so a new entry shows at once.
 *
 * @package SubtleForms\Admin
 * @since   2.7.5
 */

namespace SubtleForms\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Analytics\SpamStats;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\Settings;
use SubtleForms\Support\SpamDefaults;
use SubtleForms\Tools\ReportQueries;
use SubtleForms\Tools\ReportSeries;

/**
 * Dashboard figures.
 */
final class OverviewData {

	/** Days of daily counts sent to the chart (the chart offers 7, 30 and 90). */
	public const TREND_DAYS = 90;

	/** Seconds the figures are kept. */
	public const TTL = 60;

	/**
	 * Cache key for the current state of the entries.
	 *
	 * @param string $name Part name.
	 * @return string
	 */
	public static function cacheKey( string $name ): string {
		return 'subtleforms_ov_' . $name . '_' . (int) get_option( 'subtleforms_counts_generation', 1 );
	}

	/**
	 * Everything the Dashboard shows.
	 *
	 * @param FormsRepository|null       $forms       Forms.
	 * @param SubmissionsRepository|null $submissions Entries.
	 * @return array
	 */
	public static function snapshot( ?FormsRepository $forms = null, ?SubmissionsRepository $submissions = null ): array {
		$key    = self::cacheKey( 'snapshot' );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$forms       = $forms ?? new FormsRepository();
		$submissions = $submissions ?? new SubmissionsRepository();

		$zone     = ReportSeries::siteZone();
		$today    = ReportSeries::today( $zone );
		$now      = time();
		$tomorrow = ReportQueries::dayStartUtc( ReportQueries::addDays( $today, 1 ), $zone );
		$start30  = ReportQueries::dayStartUtc( ReportQueries::addDays( $today, -29 ), $zone );
		$startN   = ReportQueries::dayStartUtc( ReportQueries::addDays( $today, -( self::TREND_DAYS - 1 ) ), $zone );

		// One grouped read covers the chart, today, the week and the week before.
		$daily = ReportQueries::dailyCounts( $startN, $tomorrow, 0, $zone );
		$trend = ReportSeries::fillDays( $daily, self::TREND_DAYS, $today );

		$sumFrom = static function ( int $fromDaysAgo, int $toDaysAgo ) use ( $daily, $today ): int {
			$sum = 0;
			for ( $i = $fromDaysAgo; $i >= $toDaysAgo; $i-- ) {
				$sum += (int) ( $daily[ ReportQueries::addDays( $today, -$i ) ] ?? 0 );
			}
			return $sum;
		};

		$total_forms     = $forms->count();
		$published       = $forms->count( array( 'status' => 'published' ) );
		$draft           = $forms->count( array( 'status' => 'draft' ) );
		$total_entries   = $submissions->count();
		$unread          = $submissions->count( array( 'is_read' => 0 ) );
		$spam            = SpamStats::summary( 7 );
		$week            = $sumFrom( 6, 0 );

		$stats = array(
			'total_forms'              => $total_forms,
			'published_forms'          => $published,
			'draft_forms'              => $draft,
			'total_submissions'        => $total_entries,
			'submissions_today'        => $sumFrom( 0, 0 ),
			'submissions_this_week'    => $week,
			'submissions_prev_week'    => $sumFrom( 13, 7 ),
			'avg_submissions_per_form' => $published > 0 ? round( $total_entries / $published, 1 ) : 0,
			'unread_submissions'       => $unread,
			'spam_blocked_week'        => (int) $spam['total'],
		);

		$since7 = gmdate( 'Y-m-d H:i:s', $now - 7 * DAY_IN_SECONDS );

		$data = array(
			'stats'              => $stats,
			'trend'              => $trend,
			'recent_submissions' => self::recentEntries( 8 ),
			'recent_forms'       => array(),
			'top_forms'          => self::topForms( $forms, $start30, $tomorrow, $zone ),
			'attention'          => array(
				'unread'               => $unread,
				'idle_forms'           => ReportQueries::formsWithoutEntries( $start30, 5 ),
				'integration_failures' => ReportQueries::integrationFailures( $since7 ),
			),
			'checklist'          => self::checklist( $total_forms, $total_entries ),
		);

		set_transient( $key, $data, self::TTL );
		return $data;
	}

	/**
	 * Name and email of an entry, for a list row.
	 *
	 * @param array $payload Entry values.
	 * @return array{name:string,email:string}
	 */
	public static function who( array $payload ): array {
		$name  = '';
		$email = '';
		$first = '';
		$last  = '';
		foreach ( $payload as $key => $value ) {
			if ( ! is_string( $value ) || '' === trim( $value ) ) {
				continue;
			}
			$k = strtolower( (string) $key );
			if ( '' === $email && false !== strpos( $k, 'email' ) && is_email( trim( $value ) ) ) {
				$email = trim( $value );
			} elseif ( '' === $name && in_array( $k, array( 'name', 'full_name', 'your_name', 'fullname' ), true ) ) {
				$name = trim( $value );
			} elseif ( '' === $first && in_array( $k, array( 'first_name', 'firstname' ), true ) ) {
				$first = trim( $value );
			} elseif ( '' === $last && in_array( $k, array( 'last_name', 'lastname' ), true ) ) {
				$last = trim( $value );
			}
		}
		if ( '' === $name ) {
			$name = trim( $first . ' ' . $last );
		}
		return array(
			'name'  => wp_strip_all_tags( $name ),
			'email' => $email,
		);
	}

	/**
	 * The latest real entries.
	 *
	 * @param int $limit How many.
	 * @return array
	 */
	public static function recentEntries( int $limit ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_submissions';
		$forms = $wpdb->prefix . 'subtleforms_forms';
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Fixed table names; value is a placeholder.
		$rows = (array) $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.id, s.form_id, s.status, s.is_read, s.created_at, s.payload, f.title AS form_title FROM {$table} s LEFT JOIN {$forms} f ON s.form_id = f.id WHERE ( s.status IS NULL OR s.status NOT IN ( 'trash', 'preview', 'spam' ) ) ORDER BY s.created_at DESC, s.id DESC LIMIT %d",
				$limit
			),
			ARRAY_A
		);
		// phpcs:enable

		$out = array();
		foreach ( $rows as $row ) {
			$payload = json_decode( (string) $row['payload'], true );
			$who     = self::who( is_array( $payload ) ? $payload : array() );
			$out[]   = array(
				'id'         => (int) $row['id'],
				'form_id'    => (int) $row['form_id'],
				'form_title' => (string) ( $row['form_title'] ?? '' ) !== '' ? (string) $row['form_title'] : __( 'Unknown form', 'subtleforms' ),
				'status'     => $row['status'],
				'is_read'    => ! empty( $row['is_read'] ),
				'created_at' => $row['created_at'],
				'time_ago'   => human_time_diff( strtotime( $row['created_at'] . ' UTC' ), time() ),
				'name'       => $who['name'],
				'email'      => $who['email'],
			);
		}
		return $out;
	}

	/**
	 * Forms with the most entries in the last 30 days.
	 *
	 * @param FormsRepository $forms   Forms.
	 * @param string          $fromUtc Window start.
	 * @param string          $toUtc   Window end.
	 * @param \DateTimeZone   $zone    Site zone.
	 * @return array<int,array{id:int,title:string,entries:int}>
	 */
	public static function topForms( FormsRepository $forms, string $fromUtc, string $toUtc, \DateTimeZone $zone ): array {
		$per = ReportQueries::perForm( $fromUtc, $toUtc, $zone );
		uasort(
			$per,
			static function ( array $a, array $b ): int {
				return $b['entries'] <=> $a['entries'];
			}
		);
		$out = array();
		foreach ( array_slice( $per, 0, 5, true ) as $id => $row ) {
			$form  = $forms->find( (int) $id );
			$out[] = array(
				'id'      => (int) $id,
				'title'   => $form ? (string) ( $form['title'] ?? '' ) : __( 'Unknown form', 'subtleforms' ),
				'entries' => $row['entries'],
			);
		}
		return $out;
	}

	/**
	 * The Getting started list: shown while the site has no form or no entry.
	 * It is a property of the site, not of the user, and goes away by itself.
	 *
	 * @param int $forms   Forms.
	 * @param int $entries Entries.
	 * @return array{show:bool,steps:array}
	 */
	public static function checklist( int $forms, int $entries ): array {
		if ( $forms >= 1 && $entries >= 1 ) {
			return array(
				'show'  => false,
				'steps' => array(),
			);
		}
		global $wpdb;
		$placed = false;
		if ( $forms >= 1 ) {
			$like_a = '%' . $wpdb->esc_like( '[subtleforms' ) . '%';
			$like_b = '%' . $wpdb->esc_like( 'wp:subtleforms/form' ) . '%';
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Core table name; the result is kept with the dashboard snapshot.
			$placed = (bool) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_status = 'publish' AND ( post_content LIKE %s OR post_content LIKE %s ) LIMIT 1", $like_a, $like_b ) );
		}
		$email = (string) ( new Settings() )->get( 'admin_email', '' );
		$spam  = $forms >= 1 && array() === SpamDefaults::formsWithProtectionOff();
		return array(
			'show'  => true,
			'steps' => array(
				array(
					'id'   => 'create_form',
					'done' => $forms >= 1,
				),
				array(
					'id'   => 'add_to_page',
					'done' => $placed,
				),
				array(
					'id'   => 'notification_email',
					'done' => '' !== trim( $email ),
				),
				array(
					'id'   => 'spam_protection',
					'done' => $spam,
				),
			),
		);
	}
}
