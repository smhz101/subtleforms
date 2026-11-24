<?php
/**
 * LIKE patterns for a search typed by an admin.
 *
 * @package SubtleForms
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Entries are stored as JSON. Rows saved before 2.9.2 hold non-ASCII text as
 * \uXXXX escapes, newer rows hold it as written, so a search for such text has
 * to look for both spellings.
 */
final class SearchTerms {

	/**
	 * The spellings of a query that can appear in a stored JSON column.
	 *
	 * The query as typed comes first. When it has a non-ASCII character, the
	 * form wp_json_encode() writes without flags follows (no surrounding
	 * quotes).
	 *
	 * @param string $query Search text as typed.
	 * @return string[] Raw (not LIKE-escaped) spellings.
	 */
	public static function variants( string $query ): array {
		$variants = array( $query );

		if ( 1 === preg_match( '/[^\x00-\x7F]/', $query ) ) {
			$encoded = wp_json_encode( $query );
			if ( is_string( $encoded ) && strlen( $encoded ) >= 2 ) {
				$escaped = substr( $encoded, 1, -1 );
				if ( $escaped !== $query ) {
					$variants[] = $escaped;
				}
			}
		}

		return $variants;
	}

	/**
	 * LIKE patterns for a query, each escaped and wrapped in %.
	 *
	 * @param string $query Search text as typed.
	 * @return string[] One pattern per spelling.
	 */
	public static function likePatterns( string $query ): array {
		global $wpdb;

		$patterns = array();
		foreach ( self::variants( $query ) as $variant ) {
			$patterns[] = '%' . $wpdb->esc_like( $variant ) . '%';
		}
		return $patterns;
	}
}
