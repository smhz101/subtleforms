<?php
/**
 * The limits of a Date, Time or Date & time field: earliest and latest date,
 * no past dates, unavailable weekdays and the allowed times.
 *
 * Stored values stay ISO (Y-m-d, H:i and Y-m-dTH:i). Relative limits such as
 * "today" or "+7 days" are read against the site's calendar day. The browser
 * applies the same rules (resources/frontend/utils/fieldValidation.js) with
 * the same messages.
 *
 * @package SubtleForms
 */

namespace SubtleForms\Engine;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class DateRules {

	private const DEFAULT_FORMATS = array(
		'date'     => 'Y-m-d',
		'time'     => 'H:i',
		'datetime' => 'Y-m-d H:i',
	);

	/**
	 * The site's current calendar day as Y-m-d (the site timezone).
	 */
	public static function today(): string {
		if ( function_exists( 'current_time' ) ) {
			return (string) current_time( 'Y-m-d' );
		}
		return gmdate( 'Y-m-d' );
	}

	/**
	 * A limit written as a date or a relative expression, as an ISO date.
	 * Empty when there is none or it cannot be read.
	 *
	 * @param mixed  $value Limit as saved.
	 * @param string $today Y-m-d of today, for tests.
	 */
	public static function resolveLimit( $value, string $today = '' ): string {
		if ( ! is_string( $value ) ) {
			return '';
		}
		$text = strtolower( trim( $value ) );
		if ( '' === $text ) {
			return '';
		}
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $text ) ) {
			return self::isRealDate( $text ) ? $text : '';
		}
		// The words and steps the editor offers: today, tomorrow, yesterday, +7 days, -1 month, 2 weeks ago.
		if ( ! preg_match( '/^(today|now|tomorrow|yesterday)?(\s*([+-]?\s*\d+)\s*(day|week|month|year)s?(\s+ago)?)*$/', $text ) ) {
			return '';
		}
		$day  = '' !== $today ? $today : self::today();
		$base = \DateTimeImmutable::createFromFormat( '!Y-m-d', $day, new \DateTimeZone( 'UTC' ) );
		if ( ! $base ) {
			return '';
		}
		$text = preg_replace( '/^now\b/', 'today', $text );
		$text = preg_replace( '/([+-])\s+/', '$1', (string) $text );
		$text = preg_replace( '/\s+/', ' ', (string) $text );
		$moved = @$base->modify( (string) $text ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- an unreadable limit is ignored.
		return $moved ? $moved->format( 'Y-m-d' ) : '';
	}

	/**
	 * Whether a Y-m-d string is a real calendar day.
	 *
	 * @param string $value Date.
	 */
	public static function isRealDate( string $value ): bool {
		$parsed = \DateTimeImmutable::createFromFormat( '!Y-m-d', $value, new \DateTimeZone( 'UTC' ) );
		return $parsed && $parsed->format( 'Y-m-d' ) === $value;
	}

	/**
	 * The PHP date format a field shows dates or times in.
	 *
	 * @param array  $config Field settings (format, customFormat).
	 * @param string $mode   date, time or datetime.
	 */
	public static function format( array $config, string $mode ): string {
		$fallback = self::DEFAULT_FORMATS[ $mode ] ?? self::DEFAULT_FORMATS['date'];
		$raw      = isset( $config['format'] ) && is_string( $config['format'] ) ? trim( $config['format'] ) : '';
		if ( 'custom' === $raw ) {
			$custom = isset( $config['customFormat'] ) && is_string( $config['customFormat'] ) ? trim( $config['customFormat'] ) : '';
			return '' !== $custom ? $custom : $fallback;
		}
		if ( 'site' === $raw ) {
			$date = (string) get_option( 'date_format', 'F j, Y' );
			$time = (string) get_option( 'time_format', 'g:i a' );
			if ( 'time' === $mode ) {
				return $time;
			}
			return 'datetime' === $mode ? $date . ', ' . $time : $date;
		}
		return '' !== $raw ? $raw : $fallback;
	}

	/**
	 * Split a date and time format in two. The separator belongs to neither.
	 *
	 * @param string $format Format.
	 * @return array{date: string, time: string}
	 */
	public static function splitFormat( string $format ): array {
		$length = strlen( $format );
		for ( $i = 0; $i < $length; $i++ ) {
			if ( '\\' === $format[ $i ] ) {
				++$i;
				continue;
			}
			if ( false !== strpos( 'gGhHisaAU', $format[ $i ] ) ) {
				$head = rtrim( substr( $format, 0, $i ), " \t\n\r\0\x0B,@-T" );
				return array(
					'date' => $head,
					'time' => ltrim( substr( $format, strlen( $head ) ), " \t\n\r\0\x0B,@-T" ),
				);
			}
		}
		return array(
			'date' => $format,
			'time' => '',
		);
	}

	/**
	 * A day written in the field's date format, in the site language.
	 *
	 * @param string $iso    Y-m-d.
	 * @param array  $config Field settings.
	 * @param string $mode   date or datetime.
	 */
	private static function showDate( string $iso, array $config, string $mode ): string {
		$format = self::format( $config, $mode );
		if ( 'datetime' === $mode ) {
			$format = self::splitFormat( $format )['date'];
		}
		return self::wpDate( '' !== $format ? $format : 'Y-m-d', $iso . ' 12:00:00' );
	}

	/**
	 * A clock time in the field's time format.
	 *
	 * @param string $clock H:i.
	 * @param array  $config Field settings.
	 * @param string $mode   time or datetime.
	 */
	private static function showTime( string $clock, array $config, string $mode ): string {
		$format = self::format( $config, $mode );
		if ( 'datetime' === $mode ) {
			$format = self::splitFormat( $format )['time'];
		}
		return self::wpDate( '' !== $format ? $format : 'H:i', '2000-01-01 ' . $clock . ':00' );
	}

	/**
	 * Format a wall clock text without any timezone shift.
	 *
	 * @param string $format PHP format.
	 * @param string $text   Y-m-d H:i:s.
	 */
	private static function wpDate( string $format, string $text ): string {
		$stamp = strtotime( $text . ' UTC' );
		if ( false === $stamp ) {
			return $text;
		}
		if ( function_exists( 'wp_date' ) ) {
			return (string) wp_date( $format, $stamp, new \DateTimeZone( 'UTC' ) );
		}
		return gmdate( $format, $stamp );
	}

	/**
	 * Minutes since midnight of an H:i or H:i:s value, or null.
	 *
	 * @param mixed $clock Time.
	 */
	private static function minutes( $clock ): ?int {
		if ( ! is_string( $clock ) || ! preg_match( '/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/', trim( $clock ), $m ) ) {
			return null;
		}
		return ( (int) $m[1] ) * 60 + (int) $m[2];
	}

	/**
	 * The message for a date outside the field's limits, or null.
	 *
	 * @param string $date   Y-m-d, already known to be real.
	 * @param array  $config Field settings: minDate, maxDate, disablePast, disabledWeekdays, format, customFormat.
	 * @param string $mode   date or datetime.
	 * @param string $today  Y-m-d of today, for tests.
	 */
	public static function dateMessage( string $date, array $config, string $mode = 'date', string $today = '' ): ?string {
		$min = self::resolveLimit( $config['minDate'] ?? '', $today );
		$max = self::resolveLimit( $config['maxDate'] ?? '', $today );

		if ( '' !== $min && $date < $min ) {
			/* translators: %s: earliest allowed date */
			return sprintf( __( 'Pick a date on or after %s.', 'subtleforms' ), self::showDate( $min, $config, $mode ) );
		}
		if ( '' !== $max && $date > $max ) {
			/* translators: %s: latest allowed date */
			return sprintf( __( 'Pick a date on or before %s.', 'subtleforms' ), self::showDate( $max, $config, $mode ) );
		}
		if ( ! empty( $config['disablePast'] ) && $date < ( '' !== $today ? $today : self::today() ) ) {
			return __( 'Pick a later date.', 'subtleforms' );
		}
		$blocked = isset( $config['disabledWeekdays'] ) && is_array( $config['disabledWeekdays'] ) ? array_map( 'intval', $config['disabledWeekdays'] ) : array();
		if ( $blocked ) {
			$weekday = (int) gmdate( 'w', (int) strtotime( $date . ' 12:00:00 UTC' ) );
			if ( in_array( $weekday, $blocked, true ) ) {
				/* translators: %s: weekday name, for example Monday. */
				return sprintf( __( '%ss are not available.', 'subtleforms' ), self::wpDate( 'l', $date . ' 12:00:00' ) );
			}
		}
		return null;
	}

	/**
	 * The message for a time outside the field's range, or null.
	 *
	 * @param string $clock  H:i or H:i:s.
	 * @param array  $config Field settings: minTime, maxTime, format, customFormat.
	 * @param string $mode   time or datetime.
	 */
	public static function timeMessage( string $clock, array $config, string $mode = 'time' ): ?string {
		$min   = self::minutes( $config['minTime'] ?? '' );
		$max   = self::minutes( $config['maxTime'] ?? '' );
		$value = self::minutes( $clock );
		if ( null === $value || ( null === $min && null === $max ) ) {
			return null;
		}
		if ( ( null !== $min && $value < $min ) || ( null !== $max && $value > $max ) ) {
			$low  = null !== $min ? substr( trim( (string) $config['minTime'] ), 0, 5 ) : '00:00';
			$high = null !== $max ? substr( trim( (string) $config['maxTime'] ), 0, 5 ) : '23:59';
			/* translators: 1: earliest time, 2: latest time */
			return sprintf( __( 'Pick a time between %1$s and %2$s.', 'subtleforms' ), self::showTime( $low, $config, $mode ), self::showTime( $high, $config, $mode ) );
		}
		return null;
	}
}
