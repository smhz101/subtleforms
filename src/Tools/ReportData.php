<?php
/**
 * The answer of GET /reports: the chart series, the per form breakdown and
 * the field summary of one form.
 *
 * @package SubtleForms\Tools
 * @since   2.7.5
 */

namespace SubtleForms\Tools;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Analytics\SpamStats;
use SubtleForms\Repositories\FormsRepository;

/**
 * Builds the Reports data.
 */
final class ReportData {

	/** Most days one report covers. */
	public const MAX_DAYS = 366;

	/** Most entries read to summarise the fields of one form. */
	public const FIELD_SAMPLE = 5000;

	/** Most fields summarised. */
	public const FIELD_LIMIT = 10;

	/** Seconds a report is kept. */
	public const TTL = 60;

	/**
	 * Whether a string is a real calendar date.
	 *
	 * @param mixed $date Value.
	 * @return bool
	 */
	public static function validDate( $date ): bool {
		if ( ! is_string( $date ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) ) {
			return false;
		}
		$parsed = \DateTimeImmutable::createFromFormat( '!Y-m-d', $date, new \DateTimeZone( 'UTC' ) );
		return $parsed && $parsed->format( 'Y-m-d' ) === $date;
	}

	/**
	 * Days from `from` to `to`, both included.
	 *
	 * @param string $from Y-m-d.
	 * @param string $to   Y-m-d.
	 * @return int
	 */
	public static function dayCount( string $from, string $to ): int {
		$a = new \DateTimeImmutable( $from, new \DateTimeZone( 'UTC' ) );
		$b = new \DateTimeImmutable( $to, new \DateTimeZone( 'UTC' ) );
		return (int) $a->diff( $b )->format( '%r%a' ) + 1;
	}

	/**
	 * Build a report.
	 *
	 * @param string          $from   First day, Y-m-d in the site's zone.
	 * @param string          $to     Last day, Y-m-d in the site's zone.
	 * @param int             $formId One form, or 0 for every form.
	 * @param FormsRepository $forms  Forms.
	 * @return array
	 */
	public static function build( string $from, string $to, int $formId, FormsRepository $forms ): array {
		$zone  = ReportSeries::siteZone();
		$days  = self::dayCount( $from, $to );
		$pFrom = ReportQueries::addDays( $from, -$days );
		$pTo   = ReportQueries::addDays( $from, -1 );

		$fromUtc  = ReportQueries::dayStartUtc( $from, $zone );
		$toUtc    = ReportQueries::dayStartUtc( ReportQueries::addDays( $to, 1 ), $zone );
		$pFromUtc = ReportQueries::dayStartUtc( $pFrom, $zone );

		$current  = ReportQueries::dailyCounts( $fromUtc, $toUtc, $formId, $zone );
		$previous = ReportQueries::dailyCounts( $pFromUtc, $fromUtc, $formId, $zone );

		$series = array();
		$sum    = 0;
		$pSum   = 0;
		for ( $i = 0; $i < $days; $i++ ) {
			$date  = ReportQueries::addDays( $from, $i );
			$pDate = ReportQueries::addDays( $pFrom, $i );
			$count = (int) ( $current[ $date ] ?? 0 );
			$prior = (int) ( $previous[ $pDate ] ?? 0 );
			$sum  += $count;
			$pSum += $prior;
			$series[] = array(
				'date'     => $date,
				'count'    => $count,
				'previous' => $prior,
			);
		}

		$per     = ReportQueries::perForm( $fromUtc, $toUtc, $zone );
		$blocked = SpamStats::blockedByForm( $from, $to );
		$titles  = array();
		$list    = array();
		foreach ( (array) $forms->all( array( 'limit' => 500, 'orderby' => 'title', 'order' => 'ASC' ) ) as $form ) {
			$id            = (int) ( $form['id'] ?? 0 );
			$titles[ $id ] = (string) ( $form['title'] ?? '' );
			$list[]        = array(
				'id'    => $id,
				'title' => $titles[ $id ],
			);
		}

		$ids = array_unique( array_merge( array_keys( $per ), array_keys( $blocked ) ) );
		if ( $formId > 0 ) {
			$ids = array_values( array_intersect( $ids, array( $formId ) ) );
		}
		$total     = 0;
		$breakdown = array();
		foreach ( $ids as $id ) {
			$total += (int) ( $per[ $id ]['entries'] ?? 0 );
		}
		foreach ( $ids as $id ) {
			$entries = (int) ( $per[ $id ]['entries'] ?? 0 );
			$spark   = array();
			for ( $i = 0; $i < $days; $i++ ) {
				$spark[] = (int) ( $per[ $id ]['days'][ ReportQueries::addDays( $from, $i ) ] ?? 0 );
			}
			$breakdown[] = array(
				'id'      => (int) $id,
				'title'   => $titles[ $id ] ?? __( 'Deleted form', 'subtleforms' ),
				'entries' => $entries,
				'unread'  => (int) ( $per[ $id ]['unread'] ?? 0 ),
				'spam'    => (int) ( $blocked[ $id ] ?? 0 ),
				'share'   => $total > 0 ? round( $entries / $total * 100, 1 ) : 0,
				'days'    => $spark,
			);
		}
		usort(
			$breakdown,
			static function ( array $a, array $b ): int {
				return $b['entries'] <=> $a['entries'] ?: strcmp( $a['title'], $b['title'] );
			}
		);

		$unread = 0;
		$spam   = 0;
		foreach ( $breakdown as $row ) {
			$unread += $row['unread'];
			$spam   += $row['spam'];
		}

		$report = array(
			'range'         => array(
				'from' => $from,
				'to'   => $to,
				'days' => $days,
			),
			'previous'      => array(
				'from' => $pFrom,
				'to'   => $pTo,
			),
			'form_id'       => $formId,
			'series'        => $series,
			'totals'        => array(
				'entries'          => $sum,
				'previous_entries' => $pSum,
				'unread'           => $unread,
				'spam'             => $spam,
			),
			'breakdown'     => $breakdown,
			'forms'         => $list,
			'field_summary' => array(),
		);

		if ( $formId > 0 ) {
			$report['field_summary'] = self::fieldSummary( $formId, $fromUtc, $toUtc, $forms );
		}

		/**
		 * Filter a report before it is sent. Add-ons add series (views and
		 * conversion) under `series_extra`.
		 *
		 * @param array $report Report.
		 * @since 2.7.5
		 */
		return (array) apply_filters( 'subtleforms/reports/data', $report );
	}

	/**
	 * Fields of a flat list, in order, with containers opened.
	 *
	 * @param array $fields Schema fields.
	 * @param array $out    Collected fields.
	 * @return array
	 */
	private static function flatten( array $fields, array &$out = array() ): array {
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			if ( ! empty( $field['key'] ) ) {
				$out[] = $field;
			}
			if ( ( $field['type'] ?? '' ) === \SubtleForms\Support\Repeater::TYPE ) {
				continue;
			}
			foreach ( array( 'fields', 'children' ) as $nested ) {
				if ( ! empty( $field[ $nested ] ) && is_array( $field[ $nested ] ) ) {
					self::flatten( $field[ $nested ], $out );
				}
			}
			if ( ! empty( $field['columns'] ) && is_array( $field['columns'] ) ) {
				foreach ( $field['columns'] as $column ) {
					if ( is_array( $column ) ) {
						self::flatten( isset( $column['fields'] ) ? (array) $column['fields'] : $column, $out );
					}
				}
			}
		}
		return $out;
	}

	/**
	 * How people answered the choice and rating fields of one form.
	 *
	 * @param int             $formId  Form.
	 * @param string          $fromUtc Window start.
	 * @param string          $toUtc   Window end.
	 * @param FormsRepository $forms   Forms.
	 * @return array
	 */
	public static function fieldSummary( int $formId, string $fromUtc, string $toUtc, FormsRepository $forms ): array {
		try {
			$loaded = $forms->loadSchemaVersion( $formId );
		} catch ( \Throwable $e ) {
			return array();
		}
		$schema = is_array( $loaded['schema'] ?? null ) ? $loaded['schema'] : array();
		$fields = self::flatten( (array) ( $schema['fields'] ?? array() ) );
		$picked = array();
		foreach ( $fields as $field ) {
			$kind = ReportQueries::summaryKind( $field );
			if ( null !== $kind ) {
				$picked[] = array( $field, $kind );
			}
			if ( count( $picked ) >= self::FIELD_LIMIT ) {
				break;
			}
		}
		if ( ! $picked ) {
			return array();
		}

		global $wpdb;
		$table   = $wpdb->prefix . 'subtleforms_submissions';
		$counted = ReportSeries::COUNTED_STATUSES;
		$in      = implode( ',', array_fill( 0, count( $counted ), '%s' ) );
		$args    = array_merge( array( $formId, $fromUtc, $toUtc ), $counted, array( self::FIELD_SAMPLE ) );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Fixed table name; every value is a placeholder.
		$payloads = (array) $wpdb->get_col( $wpdb->prepare( "SELECT payload FROM {$table} WHERE form_id = %d AND created_at >= %s AND created_at < %s AND ( status IS NULL OR status IN ({$in}) ) ORDER BY id DESC LIMIT %d", $args ) );
		$rows     = array();
		foreach ( $payloads as $json ) {
			$decoded = json_decode( (string) $json, true );
			$rows[]  = is_array( $decoded ) ? $decoded : array();
		}

		$out = array();
		foreach ( $picked as $pair ) {
			list( $field, $kind ) = $pair;
			$key     = (string) $field['key'];
			$labels  = array();
			$order   = array();
			foreach ( (array) ( $field['options'] ?? array() ) as $option ) {
				if ( is_array( $option ) && isset( $option['value'] ) ) {
					$value            = (string) $option['value'];
					$labels[ $value ] = (string) ( $option['label'] ?? $value );
					$order[]          = $value;
				}
			}
			$counts   = array();
			$answered = 0;
			$sum      = 0.0;
			foreach ( $rows as $payload ) {
				if ( ! array_key_exists( $key, $payload ) ) {
					continue;
				}
				$value  = $payload[ $key ];
				$values = is_array( $value ) ? $value : array( $value );
				$any    = false;
				foreach ( $values as $one ) {
					if ( ! is_scalar( $one ) || '' === trim( (string) $one ) ) {
						continue;
					}
					$one            = (string) $one;
					$counts[ $one ] = ( $counts[ $one ] ?? 0 ) + 1;
					$any            = true;
					if ( 'rating' === $kind && is_numeric( $one ) ) {
						$sum += (float) $one;
					}
				}
				if ( $any ) {
					++$answered;
				}
			}

			$options = array();
			if ( 'rating' === $kind ) {
				ksort( $counts, SORT_NUMERIC );
				foreach ( $counts as $value => $count ) {
					$options[] = array(
						'value' => (string) $value,
						'label' => (string) $value,
						'count' => $count,
					);
				}
			} else {
				foreach ( $order as $value ) {
					$options[] = array(
						'value' => $value,
						'label' => $labels[ $value ],
						'count' => (int) ( $counts[ $value ] ?? 0 ),
					);
					unset( $counts[ $value ] );
				}
				foreach ( $counts as $value => $count ) {
					$options[] = array(
						'value' => (string) $value,
						'label' => (string) $value,
						'count' => $count,
					);
				}
			}

			$out[] = array(
				'key'      => $key,
				'label'    => (string) ( '' !== (string) ( $field['label'] ?? '' ) ? $field['label'] : $key ),
				'type'     => (string) ( $field['type'] ?? '' ),
				'kind'     => $kind,
				'answered' => $answered,
				'average'  => ( 'rating' === $kind && $answered > 0 ) ? round( $sum / $answered, 2 ) : null,
				'options'  => $options,
				'sampled'  => count( $rows ) >= self::FIELD_SAMPLE,
			);
		}
		return $out;
	}
}
