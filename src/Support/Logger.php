<?php
/**
 * SubtleForms Logger
 *
 * Centralized logging utility. All debug output is gated behind WP_DEBUG
 * and optionally SUBTLEFORMS_DEBUG. Error-level messages always log when
 * WP_DEBUG is on; debug/info messages additionally require SUBTLEFORMS_DEBUG.
 *
 * Usage:
 *   Logger::error( 'Something went wrong: ' . $e->getMessage() );
 *   Logger::debug( 'Schema loaded for form %d', $formId );
 *   Logger::info( 'Submissions cleaned: %d', $count );
 *
 * @package SubtleForms\Support
 * @since   1.9.0
 */

namespace SubtleForms\Support;

/**
 * Gated logger — respects WP_DEBUG and SUBTLEFORMS_DEBUG constants.
 */
final class Logger {

	/**
	 * Log levels that always output when WP_DEBUG is on.
	 */
	private const ALWAYS_LOG_LEVELS = array( 'error', 'warning' );

	/**
	 * Log an error message (when WP_DEBUG is on).
	 *
	 * @param string $message  Message (supports sprintf placeholders).
	 * @param mixed  ...$args  Optional sprintf arguments.
	 */
	public static function error( string $message, ...$args ): void {
		self::log( 'error', $message, $args );
	}

	/**
	 * Log a warning message (when WP_DEBUG is on).
	 *
	 * @param string $message  Message (supports sprintf placeholders).
	 * @param mixed  ...$args  Optional sprintf arguments.
	 */
	public static function warning( string $message, ...$args ): void {
		self::log( 'warning', $message, $args );
	}

	/**
	 * Log an info message (when WP_DEBUG + SUBTLEFORMS_DEBUG are on).
	 *
	 * @param string $message  Message (supports sprintf placeholders).
	 * @param mixed  ...$args  Optional sprintf arguments.
	 */
	public static function info( string $message, ...$args ): void {
		self::log( 'info', $message, $args );
	}

	/**
	 * Log a debug message (when WP_DEBUG + SUBTLEFORMS_DEBUG are on).
	 *
	 * @param string $message  Message (supports sprintf placeholders).
	 * @param mixed  ...$args  Optional sprintf arguments.
	 */
	public static function debug( string $message, ...$args ): void {
		self::log( 'debug', $message, $args );
	}

	/**
	 * Internal log handler.
	 *
	 * @param string $level   Log level.
	 * @param string $message Message template.
	 * @param array  $args    sprintf arguments.
	 */
	private static function log( string $level, string $message, array $args ): void {
		// Gate: WP_DEBUG must be on for any logging.
		if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
			return;
		}

		// For info/debug levels, also require SUBTLEFORMS_DEBUG.
		if ( ! in_array( $level, self::ALWAYS_LOG_LEVELS, true ) ) {
			if ( ! defined( 'SUBTLEFORMS_DEBUG' ) || ! SUBTLEFORMS_DEBUG ) {
				return;
			}
		}

		// Format message with sprintf if args provided.
		if ( ! empty( $args ) ) {
			$message = vsprintf( $message, $args );
		}

		$tag = strtoupper( $level );
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( "[SubtleForms][{$tag}] {$message}" );
	}
}
