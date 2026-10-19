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
	 * IDs of the entries that belong to an email address, newest first.
	 *
	 * @param string $email Email address.
	 * @return int[]
	 */
	public static function submissionIds( string $email ): array {
		global $wpdb;
		$email = strtolower( trim( $email ) );
		if ( '' === $email || ! is_email( $email ) ) {
			return array();
		}
		$table = $wpdb->prefix . 'subtleforms_submissions';

		$ids    = array();
		$cursor = PHP_INT_MAX;
		do {
			// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix; values are prepared.
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT id, payload FROM {$table} WHERE id < %d AND payload LIKE %s ORDER BY id DESC LIMIT 500",
					$cursor,
					'%' . $wpdb->esc_like( $email ) . '%'
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

		return $ids;
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
