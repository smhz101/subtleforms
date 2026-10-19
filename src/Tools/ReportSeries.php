<?php
/**
 * Fill a daily submission series so every day has a bar.
 *
 * @package SubtleForms\Tools
 */

namespace SubtleForms\Tools;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Day buckets for the free reports chart.
 */
final class ReportSeries {

	/**
	 * Midnight, UTC, of the oldest day in a window that includes today.
	 *
	 * Seven days is today and the six days before it, the same window the
	 * reports chart draws. Counting back seven midnights includes an eighth day.
	 *
	 * @param int      $days How many days, including today.
	 * @param int|null $now  Unix time. Defaults to now.
	 * @return string Y-m-d H:i:s.
	 */
	public static function start( int $days, ?int $now = null, ?\DateTimeZone $timezone = null ): string {
		$days = max( 1, min( 90, $days ) );
		$now  = $now ?? time();
		$zone = $timezone ?? new \DateTimeZone( 'UTC' );
		$local = ( new \DateTimeImmutable( '@' . $now ) )->setTimezone( $zone );
		$midnight = $local->setTime( 0, 0 );
		if ( $days > 1 ) {
			$midnight = $midnight->modify( '-' . ( $days - 1 ) . ' days' );
		}
		return $midnight->setTimezone( new \DateTimeZone( 'UTC' ) )->format( 'Y-m-d H:i:s' );
	}

	/**
	 * The site timezone when WordPress provides one, otherwise UTC.
	 *
	 * @return \DateTimeZone
	 */
	public static function siteZone(): \DateTimeZone {
		if ( function_exists( 'wp_timezone' ) ) {
			$zone = wp_timezone();
			if ( $zone instanceof \DateTimeZone ) {
				return $zone;
			}
		}
		return new \DateTimeZone( 'UTC' );
	}

	/**
	 * Seconds to add to a UTC timestamp to land on the site's calendar day.
	 *
	 * @param \DateTimeZone|null $timezone Zone.
	 * @param int|null            $now Unix time.
	 * @return int
	 */
	/**
	 * Count UTC timestamps on the local calendar day. A daylight-saving
	 * change in the window uses the offset that applied at each time.
	 *
	 * @param array               $timestamps UTC Y-m-d H:i:s values.
	 * @param \DateTimeZone|null $zone Local zone. UTC when omitted.
	 * @return array<string, int>
	 */
	public static function countByLocalDay( array $timestamps, ?\DateTimeZone $zone = null ): array {
		$zone   = $zone ?? new \DateTimeZone( 'UTC' );
		$counts = array();
		foreach ( $timestamps as $stamp ) {
			$stamp = (string) $stamp;
			if ( ! preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $stamp ) ) {
				continue;
			}
			$utc = new \DateTimeImmutable( $stamp, new \DateTimeZone( 'UTC' ) );
			$day = $utc->setTimezone( $zone )->format( 'Y-m-d' );
			$counts[ $day ] = ( $counts[ $day ] ?? 0 ) + 1;
		}
		return $counts;
	}

	public static function offsetSeconds( ?\DateTimeZone $timezone = null, ?int $now = null ): int {
		$zone = $timezone ?? new \DateTimeZone( 'UTC' );
		$now  = $now ?? time();
		return $zone->getOffset( new \DateTimeImmutable( '@' . $now ) );
	}

	/**
	 * Today's date in a timezone.
	 *
	 * @param \DateTimeZone|null $timezone Zone.
	 * @param int|null            $now Unix time.
	 * @return string Y-m-d.
	 */
	public static function today( ?\DateTimeZone $timezone = null, ?int $now = null ): string {
		$zone = $timezone ?? new \DateTimeZone( 'UTC' );
		$now  = $now ?? time();
		return ( new \DateTimeImmutable( '@' . $now ) )->setTimezone( $zone )->format( 'Y-m-d' );
	}

	/**
	 * One row per day, oldest first. Days missing from $counts are zero.
	 *
	 * @param array<string, int> $counts Day (Y-m-d) to count.
	 * @param int                $days How many days, including today.
	 * @param string             $today Y-m-d.
	 * @return array<int, array{date: string, count: int}>
	 */
	public static function fillDays( array $counts, int $days, string $today ): array {
		$days = max( 1, min( 90, $days ) );
		$end  = strtotime( $today . ' 00:00:00 UTC' );
		if ( ! $end ) {
			$end = time();
		}
		$series = array();
		for ( $i = $days - 1; $i >= 0; $i-- ) {
			$day      = defined( 'DAY_IN_SECONDS' ) ? DAY_IN_SECONDS : 86400;
			$date     = gmdate( 'Y-m-d', $end - ( $i * $day ) );
			$series[] = array(
				'date'  => $date,
				'count' => (int) ( $counts[ $date ] ?? 0 ),
			);
		}
		return $series;
	}
}
