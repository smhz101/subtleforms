<?php
/**
 * Discount coupons for payment forms.
 *
 * A coupon takes a percentage or a fixed amount off the order subtotal, before
 * tax. It can be limited to some forms, a date range, a minimum order and a
 * number of uses. Usage is counted only once a payment succeeds (or the coupon
 * brings the total to zero), so abandoned checkouts never burn a use.
 *
 * @package SubtleForms\Payments
 * @since   2.1.0
 */

declare(strict_types=1);

namespace SubtleForms\Payments;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CouponsRepository {

	const DB_VERSION = '1';
	const DB_OPTION  = 'subtleforms_coupons_db';

	/**
	 * Create or upgrade the coupons table when needed. Cheap on every request:
	 * a single autoloaded option comparison.
	 */
	public static function maybeInstall(): void {
		if ( get_option( self::DB_OPTION ) === self::DB_VERSION ) {
			return;
		}
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();
		$table   = $wpdb->prefix . 'subtleforms_coupons';

		dbDelta(
			"CREATE TABLE {$table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  code varchar(64) NOT NULL,
  description varchar(255) NOT NULL DEFAULT '',
  type varchar(10) NOT NULL DEFAULT 'percent',
  amount decimal(12,2) NOT NULL DEFAULT 0,
  min_total decimal(12,2) NOT NULL DEFAULT 0,
  max_uses int(11) unsigned NOT NULL DEFAULT 0,
  used int(11) unsigned NOT NULL DEFAULT 0,
  form_ids varchar(255) NOT NULL DEFAULT '',
  starts_at datetime NULL DEFAULT NULL,
  expires_at datetime NULL DEFAULT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY code (code)
) {$charset};"
		);

		update_option( self::DB_OPTION, self::DB_VERSION );
	}

	/**
	 * @return array<int, array>
	 */
	public static function all(): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$rows = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}subtleforms_coupons ORDER BY id DESC", ARRAY_A );
		return array_map( array( self::class, 'shape' ), (array) $rows );
	}

	public static function find( int $id ): ?array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}subtleforms_coupons WHERE id = %d", $id ), ARRAY_A );
		return $row ? self::shape( $row ) : null;
	}

	public static function findByCode( string $code ): ?array {
		global $wpdb;
		$code = self::normalizeCode( $code );
		if ( '' === $code ) {
			return null;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}subtleforms_coupons WHERE code = %s", $code ), ARRAY_A );
		return $row ? self::shape( $row ) : null;
	}

	/**
	 * @param array $data Coupon fields.
	 * @return array|\WP_Error Stored coupon.
	 */
	public static function save( array $data, int $id = 0 ) {
		global $wpdb;
		$row = self::clean( $data );
		if ( '' === $row['code'] ) {
			return new \WP_Error( 'subtleforms_coupon_code', __( 'Enter a coupon code.', 'subtleforms' ), array( 'status' => 400 ) );
		}
		if ( $row['amount'] <= 0 ) {
			return new \WP_Error( 'subtleforms_coupon_amount', __( 'Enter a discount greater than zero.', 'subtleforms' ), array( 'status' => 400 ) );
		}
		if ( 'percent' === $row['type'] && $row['amount'] > 100 ) {
			return new \WP_Error( 'subtleforms_coupon_amount', __( 'A percentage discount cannot be more than 100.', 'subtleforms' ), array( 'status' => 400 ) );
		}
		$existing = self::findByCode( $row['code'] );
		if ( $existing && (int) $existing['id'] !== $id ) {
			return new \WP_Error( 'subtleforms_coupon_exists', __( 'Another coupon already uses this code.', 'subtleforms' ), array( 'status' => 409 ) );
		}

		$now               = current_time( 'mysql', true );
		$row['updated_at'] = $now;
		if ( $id > 0 ) {
			$wpdb->update( $wpdb->prefix . 'subtleforms_coupons', $row, array( 'id' => $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		} else {
			$row['created_at'] = $now;
			$wpdb->insert( $wpdb->prefix . 'subtleforms_coupons', $row ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
			$id = (int) $wpdb->insert_id;
		}
		return self::find( $id ) ?? new \WP_Error( 'subtleforms_coupon_save', __( 'The coupon could not be saved.', 'subtleforms' ), array( 'status' => 500 ) );
	}

	public static function delete( int $id ): void {
		global $wpdb;
		$wpdb->delete( $wpdb->prefix . 'subtleforms_coupons', array( 'id' => $id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	/**
	 * Count one use. Atomic, and never past max_uses.
	 */
	public static function recordUse( int $id ): void {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}subtleforms_coupons SET used = used + 1 WHERE id = %d AND (max_uses = 0 OR used < max_uses)", $id ) );
	}

	/**
	 * Check a code for a form and order subtotal.
	 *
	 * @return array|\WP_Error The coupon, or why it cannot be used.
	 */
	public static function validate( string $code, int $formId, float $subtotal ) {
		$coupon = self::findByCode( $code );
		$fail   = static fn( string $msg ) => new \WP_Error( 'subtleforms_coupon_invalid', $msg, array( 'status' => 422 ) );

		if ( ! $coupon || 'active' !== $coupon['status'] ) {
			return $fail( __( 'This coupon code is not valid.', 'subtleforms' ) );
		}
		$now = time();
		if ( $coupon['starts_at'] && strtotime( $coupon['starts_at'] . ' UTC' ) > $now ) {
			return $fail( __( 'This coupon is not active yet.', 'subtleforms' ) );
		}
		if ( $coupon['expires_at'] && strtotime( $coupon['expires_at'] . ' UTC' ) < $now ) {
			return $fail( __( 'This coupon has expired.', 'subtleforms' ) );
		}
		if ( $coupon['max_uses'] > 0 && $coupon['used'] >= $coupon['max_uses'] ) {
			return $fail( __( 'This coupon has reached its usage limit.', 'subtleforms' ) );
		}
		if ( ! empty( $coupon['form_ids'] ) && ! in_array( $formId, $coupon['form_ids'], true ) ) {
			return $fail( __( 'This coupon cannot be used on this form.', 'subtleforms' ) );
		}
		if ( $coupon['min_total'] > 0 && $subtotal < $coupon['min_total'] ) {
			return $fail(
				sprintf(
					/* translators: %s: minimum order amount */
					__( 'This coupon needs an order of at least %s.', 'subtleforms' ),
					number_format_i18n( $coupon['min_total'], 2 )
				)
			);
		}

		/**
		 * Last word on whether a coupon applies.
		 *
		 * @param array|\WP_Error $coupon   Coupon or error.
		 * @param int             $formId   Form ID.
		 * @param float           $subtotal Order subtotal.
		 */
		return apply_filters( 'subtleforms/payments/validate_coupon', $coupon, $formId, $subtotal );
	}

	/**
	 * The amount a coupon takes off a subtotal.
	 */
	public static function discountFor( array $coupon, float $subtotal ): float {
		$amount = (float) $coupon['amount'];
		$off    = 'percent' === $coupon['type'] ? $subtotal * $amount / 100 : $amount;
		return round( min( $subtotal, max( 0.0, $off ) ), 2 );
	}

	public static function normalizeCode( string $code ): string {
		return strtoupper( substr( preg_replace( '/[^A-Za-z0-9_-]/', '', trim( $code ) ), 0, 64 ) );
	}

	/**
	 * Public, safe description of a coupon for the browser.
	 */
	public static function publicView( array $coupon ): array {
		return array(
			'code'   => $coupon['code'],
			'type'   => $coupon['type'],
			'amount' => $coupon['amount'],
		);
	}

	private static function clean( array $data ): array {
		$date = static function ( $v ) {
			$v = trim( (string) $v );
			if ( '' === $v ) {
				return null;
			}
			$ts = strtotime( $v );
			return $ts ? gmdate( 'Y-m-d H:i:s', $ts ) : null;
		};
		$forms = $data['form_ids'] ?? array();
		if ( is_string( $forms ) ) {
			$forms = explode( ',', $forms );
		}
		$forms = array_values( array_filter( array_map( 'absint', (array) $forms ) ) );

		return array(
			'code'        => self::normalizeCode( (string) ( $data['code'] ?? '' ) ),
			'description' => sanitize_text_field( (string) ( $data['description'] ?? '' ) ),
			'type'        => 'fixed' === ( $data['type'] ?? '' ) ? 'fixed' : 'percent',
			'amount'      => Pricing::money( $data['amount'] ?? 0 ),
			'min_total'   => Pricing::money( $data['min_total'] ?? 0 ),
			'max_uses'    => max( 0, (int) ( $data['max_uses'] ?? 0 ) ),
			'form_ids'    => implode( ',', $forms ),
			'starts_at'   => $date( $data['starts_at'] ?? '' ),
			'expires_at'  => $date( $data['expires_at'] ?? '' ),
			'status'      => 'disabled' === ( $data['status'] ?? '' ) ? 'disabled' : 'active',
		);
	}

	private static function shape( array $row ): array {
		return array(
			'id'          => (int) $row['id'],
			'code'        => (string) $row['code'],
			'description' => (string) $row['description'],
			'type'        => (string) $row['type'],
			'amount'      => (float) $row['amount'],
			'min_total'   => (float) $row['min_total'],
			'max_uses'    => (int) $row['max_uses'],
			'used'        => (int) $row['used'],
			'form_ids'    => array_values( array_filter( array_map( 'intval', explode( ',', (string) $row['form_ids'] ) ) ) ),
			'starts_at'   => $row['starts_at'] ?: null,
			'expires_at'  => $row['expires_at'] ?: null,
			'status'      => (string) $row['status'],
			'created_at'  => (string) $row['created_at'],
		);
	}
}
