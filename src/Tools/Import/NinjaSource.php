<?php
/**
 * Ninja Forms forms and entries on this site, read from the database.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.8.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Ninja Forms 3 tables (`nf3_forms`, `nf3_fields`, `nf3_actions` and their
 * meta tables); entries are `nf_sub` posts with `_field_{id}` post meta.
 * Works whether or not Ninja Forms is active.
 */
final class NinjaSource implements Source, EntrySource {

	/** @var array<string, string>|null|false Tables, false when absent. */
	private $tables = null;

	/** @inheritDoc */
	public function id(): string {
		return 'ninja';
	}

	/** @inheritDoc */
	public function label(): string {
		return __( 'Ninja Forms', 'subtleforms' );
	}

	/** @inheritDoc */
	public function active(): bool {
		return class_exists( 'Ninja_Forms', false ) || function_exists( 'Ninja_Forms' );
	}

	/**
	 * @return array<string, string>|null
	 */
	private function tables(): ?array {
		if ( null === $this->tables ) {
			$this->tables = false;
			$forms        = Importer::table( 'nf3_forms' );
			if ( '' !== $forms ) {
				$this->tables = array(
					'forms'       => $forms,
					'form_meta'   => Importer::table( 'nf3_form_meta' ),
					'fields'      => Importer::table( 'nf3_fields' ),
					'field_meta'  => Importer::table( 'nf3_field_meta' ),
					'actions'     => Importer::table( 'nf3_actions' ),
					'action_meta' => Importer::table( 'nf3_action_meta' ),
				);
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
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM %i', $tables['forms'] ) );
	}

	/** @inheritDoc */
	public function forms(): array {
		$tables = $this->tables();
		if ( ! $tables ) {
			return array();
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT id, title FROM %i ORDER BY title ASC, id ASC LIMIT 500', $tables['forms'] ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $row ) {
			$out[] = array(
				'id'    => (string) $row['id'],
				'title' => (string) $row['title'],
			);
		}
		return $out;
	}

	/**
	 * A stored value: serialized arrays are read without creating objects.
	 *
	 * @param mixed $value Column value.
	 * @return mixed
	 */
	public static function value( $value ) {
		if ( ! is_string( $value ) || ! is_serialized( $value ) ) {
			return $value;
		}
		// Plain arrays only: no objects are created from stored data.
		$un = @unserialize( trim( $value ), array( 'allowed_classes' => false ) ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.PHP.DiscouragedPHPFunctions.serialize_unserialize
		return false === $un && 'b:0;' !== trim( $value ) ? $value : $un;
	}

	/**
	 * Rows of a parent table with their meta folded in, meta winning.
	 *
	 * @param string $table     Parent table.
	 * @param string $metaTable Meta table.
	 * @param string $where     Column of the parent holding the form id.
	 * @param int    $formId    Form id.
	 * @return array<int, array>
	 */
	private function withMeta( string $table, string $metaTable, string $where, int $formId ): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
		$rows = (array) $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i WHERE %i = %d ORDER BY id ASC', $table, $where, $formId ), ARRAY_A );
		$out  = array();
		foreach ( $rows as $row ) {
			$item = array();
			foreach ( $row as $column => $value ) {
				$item[ $column ] = self::value( $value );
			}
			if ( '' !== $metaTable ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
				$metas = (array) $wpdb->get_results( $wpdb->prepare( 'SELECT `key`, value FROM %i WHERE parent_id = %d ORDER BY id ASC', $metaTable, (int) $row['id'] ), ARRAY_A );
				foreach ( $metas as $meta ) {
					$item[ (string) $meta['key'] ] = self::value( $meta['value'] );
				}
			}
			$item['id'] = (string) $row['id'];
			$out[]      = $item;
		}
		return $out;
	}

	/** @inheritDoc */
	public function read( string $id ): ?array {
		$tables = $this->tables();
		if ( ! $tables || '' === $tables['fields'] ) {
			return null;
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
		$form = $wpdb->get_row( $wpdb->prepare( 'SELECT id, title FROM %i WHERE id = %d', $tables['forms'], (int) $id ), ARRAY_A );
		if ( ! $form ) {
			return null;
		}
		$settings = array();
		if ( '' !== $tables['form_meta'] ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
			$metas = (array) $wpdb->get_results( $wpdb->prepare( 'SELECT `key`, value FROM %i WHERE parent_id = %d ORDER BY id ASC', $tables['form_meta'], (int) $id ), ARRAY_A );
			foreach ( $metas as $meta ) {
				$settings[ (string) $meta['key'] ] = self::value( $meta['value'] );
			}
		}
		return array(
			'id'       => (string) $form['id'],
			'title'    => (string) $form['title'],
			'settings' => $settings,
			'fields'   => $this->withMeta( $tables['fields'], $tables['field_meta'], 'parent_id', (int) $id ),
			'actions'  => '' !== $tables['actions'] ? $this->withMeta( $tables['actions'], $tables['action_meta'], 'parent_id', (int) $id ) : array(),
		);
	}

	/** @inheritDoc */
	public function map( array $raw, array $context ): array {
		return NinjaMapper::map( $raw, $context );
	}

	/** @inheritDoc */
	public function entryCount( string $id ): int {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's posts.
		return (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM %i p INNER JOIN %i m ON m.post_id = p.ID AND m.meta_key = '_form_id' WHERE p.post_type = 'nf_sub' AND p.post_status NOT IN ('trash','auto-draft') AND m.meta_value = %s",
				$wpdb->posts,
				$wpdb->postmeta,
				(string) (int) $id
			)
		);
	}

	/** @inheritDoc */
	public function entries( string $id, int $after, int $limit ): array {
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's posts.
		$posts = (array) $wpdb->get_results(
			$wpdb->prepare(
				"SELECT p.ID, p.post_date, p.post_date_gmt FROM %i p INNER JOIN %i m ON m.post_id = p.ID AND m.meta_key = '_form_id' WHERE p.post_type = 'nf_sub' AND p.post_status NOT IN ('trash','auto-draft') AND m.meta_value = %s AND p.ID > %d ORDER BY p.ID ASC LIMIT %d",
				$wpdb->posts,
				$wpdb->postmeta,
				(string) (int) $id,
				$after,
				$limit
			),
			ARRAY_A
		);
		if ( ! $posts ) {
			return array();
		}
		$ids    = array_map( 'intval', array_column( $posts, 'ID' ) );
		$marks  = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$metas  = (array) $wpdb->get_results(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared -- Placeholders only.
			$wpdb->prepare( "SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta} WHERE meta_key LIKE '\\_field\\_%' AND post_id IN ($marks)", $ids ),
			ARRAY_A
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$byPost = array();
		foreach ( $metas as $meta ) {
			$byPost[ (int) $meta['post_id'] ][ substr( (string) $meta['meta_key'], 7 ) ] = self::value( $meta['meta_value'] );
		}
		$out = array();
		foreach ( $posts as $post ) {
			$gmt = (string) $post['post_date_gmt'];
			if ( '' === $gmt || 0 === strpos( $gmt, '0000' ) ) {
				$gmt = function_exists( 'get_gmt_from_date' ) ? get_gmt_from_date( (string) $post['post_date'] ) : (string) $post['post_date'];
			}
			$out[] = array(
				'id'         => (int) $post['ID'],
				'created_at' => preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $gmt ) ? $gmt : '',
				'ip'         => '',
				'user_agent' => '',
				'values'     => $byPost[ (int) $post['ID'] ] ?? array(),
			);
		}
		return $out;
	}

	/** @inheritDoc */
	public function payload( array $entryMap, array $entry, int &$files ): array {
		return NinjaMapper::payload( $entryMap, (array) $entry['values'], $files );
	}
}
