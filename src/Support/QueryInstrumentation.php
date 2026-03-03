<?php
/**
 * SubtleForms Query Instrumentation
 *
 * Logs slow database queries for performance debugging.
 * Enable with: define('SUBTLEFORMS_DB_DEBUG', true); in wp-config.php
 *
 * @package   SubtleForms\Support
 * @version   1.8.2
 * @since     Phase B3 - Query Optimization
 */

namespace SubtleForms\Support;

/**
 * Query performance instrumentation.
 */
final class QueryInstrumentation {

	/**
	 * Slow query threshold in milliseconds.
	 */
	private const SLOW_QUERY_THRESHOLD_MS = 200;

	/**
	 * Start timing a query.
	 *
	 * @param string $context Context identifier (e.g., "FormsRepository::all").
	 * @return float Microtime timestamp.
	 */
	public static function start( string $context ): float {
		return microtime( true );
	}

	/**
	 * End timing and log if slow.
	 *
	 * @param float  $start_time Start timestamp from start().
	 * @param string $context    Context identifier.
	 * @param string $query      SQL query executed (optional).
	 * @return void
	 */
	public static function end( float $start_time, string $context, string $query = '' ): void {
		if ( ! defined( 'SUBTLEFORMS_DB_DEBUG' ) || ! SUBTLEFORMS_DB_DEBUG ) {
			return;
		}

		$elapsed_ms = ( microtime( true ) - $start_time ) * 1000;

		if ( $elapsed_ms >= self::SLOW_QUERY_THRESHOLD_MS ) {
			error_log(
				sprintf(
					'[SubtleForms Query] SLOW: %s took %.2fms | Query: %s',
					$context,
					$elapsed_ms,
					$query ? substr( $query, 0, 200 ) : 'N/A'
				)
			);
		}
	}

	/**
	 * Log a query execution for debugging.
	 *
	 * @param string $context Context identifier.
	 * @param string $query   SQL query.
	 * @param float  $time_ms Execution time in milliseconds.
	 * @return void
	 */
	public static function log( string $context, string $query, float $time_ms ): void {
		if ( ! defined( 'SUBTLEFORMS_DB_DEBUG' ) || ! SUBTLEFORMS_DB_DEBUG ) {
			return;
		}

		$level = $time_ms >= self::SLOW_QUERY_THRESHOLD_MS ? 'SLOW' : 'OK';

		error_log(
			sprintf(
				'[SubtleForms Query] %s: %s | %.2fms | Query: %s',
				$level,
				$context,
				$time_ms,
				substr( $query, 0, 200 )
			)
		);
	}
}
