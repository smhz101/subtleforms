<?php
/**
 * Fluent Forms forms on this site, read from its own tables.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * `{prefix}fluentform_forms` and `{prefix}fluentform_form_meta`. Works
 * whether or not Fluent Forms is active.
 */
final class FluentSource implements Source {

	/** @var array{form: string, meta: string}|null|false */
	private $tables = null;

	/** @inheritDoc */
	public function id(): string {
		return 'fluent';
	}

	/** @inheritDoc */
	public function label(): string {
		return __( 'Fluent Forms', 'subtleforms' );
	}

	/** @inheritDoc */
	public function active(): bool {
		return defined( 'FLUENTFORM' ) || defined( 'FLUENTFORM_VERSION' );
	}

	/**
	 * @return array{form: string, meta: string}|null
	 */
	private function tables(): ?array {
		if ( null === $this->tables ) {
			$form         = Importer::table( 'fluentform_forms' );
			$meta         = Importer::table( 'fluentform_form_meta' );
			$this->tables = '' !== $form ? array(
				'form' => $form,
				'meta' => $meta,
			) : false;
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
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM %i WHERE status <> 'trashed'", $tables['form'] ) );
	}

	/** @inheritDoc */
	public function forms(): array {
		$tables = $this->tables();
		if ( ! $tables ) {
			return array();
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, title FROM %i WHERE status <> 'trashed' ORDER BY title ASC, id ASC LIMIT 500", $tables['form'] ), ARRAY_A );
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
		$form = $wpdb->get_row( $wpdb->prepare( "SELECT id, title, form_fields FROM %i WHERE id = %d AND status <> 'trashed'", $tables['form'], (int) $id ), ARRAY_A );
		$meta = '' !== $tables['meta']
			? $wpdb->get_results( $wpdb->prepare( "SELECT meta_key, value FROM %i WHERE form_id = %d AND meta_key IN ('formSettings','notifications') ORDER BY id ASC", $tables['meta'], (int) $id ), ARRAY_A )
			: array();
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		if ( ! $form ) {
			return null;
		}
		return array(
			'id'          => (string) $form['id'],
			'title'       => (string) $form['title'],
			'form_fields' => (string) $form['form_fields'],
			'metas'       => (array) $meta,
		);
	}

	/** @inheritDoc */
	public function map( array $raw, array $context ): array {
		return FluentMapper::map( $raw, $context );
	}
}
