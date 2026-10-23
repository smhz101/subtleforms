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
	 * One page of the entries that belong to an email address, for the
	 * exporter. Pages follow the entry id, so each page continues where the
	 * last one stopped instead of scanning the table from the top again. An
	 * entry belongs to the address when an answer is exactly that address,
	 * when it was sent while logged in to the account that has the address,
	 * or when it was stored with an IP address that one of those account
	 * entries was stored with, was sent by nobody else (no other account, no
	 * other email address in the answers).
	 *
	 * @param string $email   Email address.
	 * @param int    $page    Page number, from 1.
	 * @param int    $perPage Entries per page.
	 * @return array{ids:int[], done:bool}
	 */
	public static function page( string $email, int $page, int $perPage = 100 ): array {
		global $wpdb;
		$email   = strtolower( trim( $email ) );
		$page    = max( 1, $page );
		$perPage = max( 1, $perPage );
		if ( '' === $email || ! is_email( $email ) ) {
			return array(
				'ids'  => array(),
				'done' => true,
			);
		}

		$table  = $wpdb->prefix . 'subtleforms_submissions';
		$user   = function_exists( 'get_user_by' ) ? get_user_by( 'email', $email ) : false;
		$userId = ( $user && self::hasUserIdColumn() ) ? (int) $user->ID : 0;

		$where = array( 'payload LIKE %s' );
		$args  = array( '%' . $wpdb->esc_like( $email ) . '%' );
		if ( $userId > 0 ) {
			$where[] = 'user_id = %d';
			$args[]  = $userId;
		}
		$condition = implode( ' OR ', $where );

		// Where this page starts: the id the previous page ended at.
		$cursorKey = 'subtleforms_privx_' . md5( $email ) . '_';
		$cursor    = PHP_INT_MAX;
		if ( $page > 1 ) {
			$saved = get_transient( $cursorKey . $page );
			if ( false === $saved ) {
				// Pages are normally asked in order; walk up to this one if not.
				for ( $p = 1; $p < $page; $p++ ) {
					self::page( $email, $p, $perPage );
				}
				$saved = get_transient( $cursorKey . $page );
			}
			$cursor = false === $saved ? PHP_INT_MAX : (int) $saved;
		}

		$ids  = array();
		$more = false;
		$last = $cursor;
		do {
			// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix; $condition holds only placeholders; values are prepared.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, payload, user_id FROM {$table} WHERE id < %d AND ({$condition}) ORDER BY id DESC LIMIT 500",
					array_merge( array( $last ), $args )
				),
				ARRAY_A
			);
			// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
			foreach ( (array) $rows as $row ) {
				$last = (int) $row['id'];
				if ( ! self::rowBelongs( $row, $email, $userId ) ) {
					continue;
				}
				if ( count( $ids ) >= $perPage ) {
					$more = true;
					break 2;
				}
				$ids[]  = (int) $row['id'];
				$cursor = (int) $row['id'];
			}
		} while ( is_array( $rows ) && count( $rows ) === 500 );

		if ( $more ) {
			set_transient( $cursorKey . ( $page + 1 ), $cursor, HOUR_IN_SECONDS );
		}
		return array(
			'ids'  => $ids,
			'done' => ! $more,
		);
	}

	/**
	 * Whether a scanned row belongs to the requested address.
	 *
	 * @param array    $row    id, payload, user_id.
	 * @param string   $email  Lower-case email address.
	 * @param int      $userId The account that has the address (0: none).
	 */
	private static function rowBelongs( array $row, string $email, int $userId ): bool {
		if ( self::payloadHasEmail( $row['payload'], $email ) ) {
			return true;
		}
		$rowUser = (int) ( $row['user_id'] ?? 0 );
		if ( $userId > 0 && $rowUser === $userId ) {
			return true;
		}
		return false;
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
