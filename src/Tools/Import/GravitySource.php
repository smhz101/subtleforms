<?php
/**
 * Gravity Forms forms on this site, read from its own tables.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * `{prefix}gf_form` and `{prefix}gf_form_meta` (or the `rg_` tables of
 * Gravity Forms before 2.3). Works whether or not Gravity Forms is active.
 */
final class GravitySource implements Source {

	/** @var array{form: string, meta: string}|null|false Tables, false when absent. */
	private $tables = null;

	/** @inheritDoc */
	public function id(): string {
		return 'gravity';
	}

	/** @inheritDoc */
	public function label(): string {
		return __( 'Gravity Forms', 'subtleforms' );
	}

	/** @inheritDoc */
	public function active(): bool {
		return class_exists( 'GFForms', false ) || class_exists( 'GFAPI', false );
	}

	/**
	 * The form and meta tables, or null when Gravity Forms left none.
	 *
	 * @return array{form: string, meta: string}|null
	 */
	private function tables(): ?array {
		if ( null === $this->tables ) {
			$this->tables = false;
			foreach ( array( 'gf_', 'rg_' ) as $prefix ) {
				$form = Importer::table( $prefix . 'form' );
				$meta = Importer::table( $prefix . 'form_meta' );
				if ( '' !== $form && '' !== $meta ) {
					$this->tables = array(
						'form' => $form,
						'meta' => $meta,
					);
					break;
				}
			}
		}
		return $this->tables ? $this->tables : null;
	}

	/** @inheritDoc */
	public function count(): int {
		$tables = $this->tables();
		if ( ! $tables ) {
			return 0;
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table; the name comes from $wpdb->prefix.
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM %i WHERE is_trash = 0', $tables['form'] ) );
	}

	/** @inheritDoc */
	public function forms(): array {
		$tables = $this->tables();
		if ( ! $tables ) {
			return array();
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT id, title FROM %i WHERE is_trash = 0 ORDER BY title ASC, id ASC LIMIT 500', $tables['form'] ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $row ) {
			$out[] = array(
				'id'    => (string) $row['id'],
				'title' => (string) $row['title'],
			);
		}
		return $out;
	}

	/** @inheritDoc */
	public function read( string $id ): ?array {
		$tables = $this->tables();
		if ( ! $tables ) {
			return null;
		}
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's tables.
		$form = $wpdb->get_row( $wpdb->prepare( 'SELECT id, title FROM %i WHERE id = %d AND is_trash = 0', $tables['form'], (int) $id ), ARRAY_A );
		$meta = $wpdb->get_row( $wpdb->prepare( 'SELECT display_meta, notifications, confirmations FROM %i WHERE form_id = %d', $tables['meta'], (int) $id ), ARRAY_A );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		if ( ! $form || ! $meta ) {
			return null;
		}
		$display = self::decode( $meta['display_meta'] ?? '' );
		if ( ! is_array( $display ) ) {
			return null;
		}
		$display['id']            = (string) $form['id'];
		$display['title']         = (string) ( $display['title'] ?? $form['title'] );
		$display['notifications'] = self::decode( $meta['notifications'] ?? '' ) ?: ( $display['notifications'] ?? array() );
		$display['confirmations'] = self::decode( $meta['confirmations'] ?? '' ) ?: ( $display['confirmations'] ?? array() );
		return $display;
	}

	/**
	 * Gravity Forms stores JSON; versions before 1.7 stored serialized arrays.
	 *
	 * @param mixed $value Column value.
	 * @return array|null
	 */
	private static function decode( $value ): ?array {
		if ( ! is_string( $value ) || '' === $value ) {
			return null;
		}
		$decoded = json_decode( $value, true );
		if ( is_array( $decoded ) ) {
			return $decoded;
		}
		if ( ! is_serialized( $value ) ) {
			return null;
		}
		// Plain arrays only: no objects are created from stored data.
		$unserialized = @unserialize( trim( $value ), array( 'allowed_classes' => false ) ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.PHP.DiscouragedPHPFunctions.serialize_unserialize
		return is_array( $unserialized ) ? $unserialized : null;
	}

	/** @inheritDoc */
	public function map( array $raw, array $context ): array {
		return GravityMapper::map( $raw, $context );
	}
}
