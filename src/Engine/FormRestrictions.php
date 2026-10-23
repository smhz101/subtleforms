<?php
/**
 * Form availability rules (2.0).
 *
 * A form can require visitors to be logged in, open and close on a schedule,
 * and stop accepting entries after a total limit. The rules live in the form
 * schema under metadata.restrictions and are enforced in two places: when the
 * form is rendered (the visitor sees a message instead of the form) and when
 * a submission arrives (so the rules cannot be bypassed by posting directly).
 *
 * @package SubtleForms\Engine
 * @since   2.0.0
 */

namespace SubtleForms\Engine;

defined( 'ABSPATH' ) || exit;

final class FormRestrictions {

	/**
	 * Return the reason a form is unavailable right now, or null if open.
	 *
	 * @param int        $formId Form ID.
	 * @param array|null $schema Resolved schema (the `schema` part of a schema version row).
	 * @return string|null Message to show the visitor, or null.
	 */
	public static function blockedReason( int $formId, $schema ): ?string {
		if ( ! is_array( $schema ) ) {
			return null;
		}

		// A form with a payment field and no plugin that takes payments
		// would store entries nobody paid for. Visitors get the generic
		// message; the builder banner tells the admin what is needed.
		if ( \SubtleForms\Fields\AddonFieldTypes::needsMissingPayment( $schema ) ) {
			return __( 'This form is not available right now.', 'subtleforms' );
		}

		$rules = $schema['metadata']['restrictions'] ?? array();
		if ( ! is_array( $rules ) || empty( $rules ) ) {
			return null;
		}

		// Logged-in users only.
		if ( ! empty( $rules['requireLogin'] ) && ! is_user_logged_in() ) {
			return self::message(
				$rules['loginMessage'] ?? '',
				__( 'Please log in to fill in this form.', 'subtleforms' )
			);
		}

		// Schedule. Stored as site-local "Y-m-d\TH:i" strings from a datetime input.
		$now = current_time( 'timestamp' ); // phpcs:ignore WordPress.DateTime.CurrentTimeTimestamp.Requested -- Compared against site-local times entered in the admin.

		$opens = self::toTimestamp( $rules['openAt'] ?? '' );
		if ( $opens && $now < $opens ) {
			return self::message(
				$rules['notOpenMessage'] ?? '',
				sprintf(
					/* translators: %s: opening date and time */
					__( 'This form opens on %s.', 'subtleforms' ),
					wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $opens - ( (int) ( get_option( 'gmt_offset' ) * HOUR_IN_SECONDS ) ) )
				)
			);
		}

		$closes = self::toTimestamp( $rules['closeAt'] ?? '' );
		if ( $closes && $now >= $closes ) {
			return self::message(
				$rules['closedMessage'] ?? '',
				__( 'This form is closed and no longer accepts entries.', 'subtleforms' )
			);
		}

		// Total entry limit.
		$limit = isset( $rules['entryLimit'] ) ? (int) $rules['entryLimit'] : 0;
		if ( $limit > 0 && self::countEntries( $formId ) >= $limit ) {
			return self::message(
				$rules['limitMessage'] ?? '',
				__( 'This form has reached its maximum number of entries.', 'subtleforms' )
			);
		}

		return null;
	}

	/**
	 * Markup shown in place of a blocked form.
	 *
	 * @param string $message Plain-text message.
	 */
	public static function render( string $message ): string {
		return sprintf(
			'<div class="subtleforms-unavailable" role="status"><p>%s</p></div>',
			esc_html( $message )
		);
	}

	/**
	 * Load the active schema for a form through the container.
	 *
	 * @param int $formId Form ID.
	 * @return array|null
	 */
	public static function activeSchema( int $formId ): ?array {
		try {
			$repo = \SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Repositories\FormsRepository::class );
			$row  = $repo->loadSchemaVersion( $formId );
		} catch ( \Throwable $e ) {
			return null;
		}
		if ( ! is_array( $row ) ) {
			return null;
		}
		return is_array( $row['schema'] ?? null ) ? $row['schema'] : $row;
	}

	private static function message( $custom, string $fallback ): string {
		$custom = is_string( $custom ) ? trim( $custom ) : '';
		return $custom !== '' ? $custom : $fallback;
	}

	private static function toTimestamp( $value ): int {
		if ( ! is_string( $value ) || $value === '' ) {
			return 0;
		}
		$ts = strtotime( $value );
		return $ts ? (int) $ts : 0;
	}

	private static function countEntries( int $formId ): int {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_submissions';
		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix; the count must be live.
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE form_id = %d AND status != 'spam' AND status != 'trash' AND status != 'preview'", $formId ) );
	}
}
