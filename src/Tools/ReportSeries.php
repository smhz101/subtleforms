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
	public static function start( int $days, ?int $now = null ): string {
		$days = max( 1, min( 90, $days ) );
		$now  = $now ?? time();
		$today = gmdate( 'Y-m-d', $now );
		$end   = strtotime( $today . ' 00:00:00 UTC' );
		if ( ! $end ) {
			$end = $now;
		}
		$day    = defined( 'DAY_IN_SECONDS' ) ? DAY_IN_SECONDS : 86400;
		$oldest = gmdate( 'Y-m-d', $end - ( ( $days - 1 ) * $day ) );
		return $oldest . ' 00:00:00';
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
