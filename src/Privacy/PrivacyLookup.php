<?php
/**
 * Find the entries that belong to an email address.
 *
 * Used by the personal data exporter and eraser. An entry belongs to the
 * address when one of its answers is exactly that address, letter case aside.
 * A partial match such as joann@example.com for ann@example.com never counts
 * (FF-21).
 *
 * @package SubtleForms\Privacy
 * @since   2.3.9
 */

namespace SubtleForms\Privacy;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class PrivacyLookup {

	/**
	 * Whether the submissions table has the user_id column (added in 2.7.1;
	 * a site that has not run the upgrade yet does not).
	 *
	 * @var bool|null
	 */
	private static $hasUserId = null;

	/**
	 * Whether the submissions table has the user_id column.
	 */
	public static function hasUserIdColumn(): bool {
		global $wpdb;
		if ( null === self::$hasUserId ) {
			$table = $wpdb->prefix . 'subtleforms_submissions';
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Fixed table name.
			self::$hasUserId = ! empty( $wpdb->get_results( "SHOW COLUMNS FROM {$table} LIKE 'user_id'" ) );
		}
		return self::$hasUserId;
	}

	/**
	 * Forget the remembered column check (used by tests and the upgrade).
	 */
	public static function resetColumnCheck(): void {
		self::$hasUserId = null;
	}

	/**
	 * IDs of the entries that belong to an email address, newest first.
	 *
	 * @param string $email     Email address.
	 * @param bool   $reuseScan Use the list found a moment ago (later pages of an export).
	 * @return int[]
	 */
	public static function submissionIds( string $email, bool $reuseScan = false ): array {
		global $wpdb;
		$email = strtolower( trim( $email ) );
		if ( '' === $email || ! is_email( $email ) ) {
			return array();
		}

		// The export and the eraser ask page after page. Scan once and keep the
		// list for a few minutes instead of rescanning the table every page.
		$cacheKey = 'subtleforms_priv_' . md5( $email );
		$cached   = $reuseScan ? get_transient( $cacheKey ) : false;
		if ( is_array( $cached ) ) {
			return array_map( 'intval', $cached );
		}

		$table = $wpdb->prefix . 'subtleforms_submissions';

		$where = 'payload LIKE %s';
		$args  = array( '%' . $wpdb->esc_like( $email ) . '%' );

		$ids    = array();
		$cursor = PHP_INT_MAX;
		do {
			// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix; $where holds only placeholders; values are prepared.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, payload FROM {$table} WHERE id < %d AND {$where} ORDER BY id DESC LIMIT 500",
					array_merge( array( $cursor ), $args )
				),
				ARRAY_A
			);
			// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			foreach ( (array) $rows as $row ) {
				$cursor = (int) $row['id'];
				if ( self::payloadHasEmail( $row['payload'], $email ) ) {
					$ids[] = (int) $row['id'];
				}
			}
		} while ( is_array( $rows ) && count( $rows ) === 500 );

		// Entries sent while logged in to the account that has this address.
		$user = function_exists( 'get_user_by' ) ? get_user_by( 'email', $email ) : false;
		if ( $user && self::hasUserIdColumn() ) {
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Fixed table name; value is prepared.
			$byUser = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$table} WHERE user_id = %d", (int) $user->ID ) );
			foreach ( (array) $byUser as $id ) {
				$ids[] = (int) $id;
			}
			$ids = array_values( array_unique( $ids ) );
			rsort( $ids );
		}

		set_transient( $cacheKey, $ids, 5 * MINUTE_IN_SECONDS );
		return $ids;
	}

	/**
	 * Drop the remembered list for an address (after an erase).
	 *
	 * @param string $email Email address.
	 */
	public static function forget( string $email ): void {
		delete_transient( 'subtleforms_priv_' . md5( strtolower( trim( $email ) ) ) );
	}

	/**
	 * Whether any answer in a payload is exactly the email address.
	 *
	 * @param mixed  $payload Stored payload (JSON string or array).
	 * @param string $email   Lower-case email address.
	 */
	public static function payloadHasEmail( $payload, string $email ): bool {
		$data = is_string( $payload ) ? json_decode( $payload, true ) : $payload;
		if ( ! is_array( $data ) ) {
			return false;
		}
		$found = false;
		array_walk_recursive(
			$data,
			static function ( $value ) use ( $email, &$found ) {
				if ( ! $found && is_string( $value ) && strtolower( trim( $value ) ) === $email ) {
					$found = true;
				}
			}
		);
		return $found;
	}
}
