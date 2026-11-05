<?php
/**
 * WPForms forms and entries on this site, read from the database.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.8.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Forms are `wpforms` posts whose content is JSON; Pro keeps entries in
 * `{prefix}wpforms_entries`. Works whether or not WPForms is active.
 */
final class WPFormsSource implements Source, EntrySource {

	/** Entry statuses that are not real submissions. */
	private const SKIP_STATUS = "'spam','trash','abandoned','partial'";

	/** @var string|null|false Entry table, false when absent. */
	private $entries = null;

	/** @var bool|null Whether the entry table has a `type` column. */
	private $hasType = null;

	/** @inheritDoc */
	public function id(): string {
		return 'wpforms';
	}

	/** @inheritDoc */
	public function label(): string {
		return __( 'WPForms', 'subtleforms' );
	}

	/** @inheritDoc */
	public function active(): bool {
		return class_exists( 'WPForms', false ) || defined( 'WPFORMS_VERSION' ) || function_exists( 'wpforms' );
	}

	/** @inheritDoc */
	public function count(): int {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's posts.
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM %i WHERE post_type = 'wpforms' AND post_status NOT IN ('trash','auto-draft')", $wpdb->posts ) );
	}

	/** @inheritDoc */
	public function forms(): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's posts.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT ID, post_title FROM %i WHERE post_type = 'wpforms' AND post_status NOT IN ('trash','auto-draft') ORDER BY post_title ASC, ID ASC LIMIT 500", $wpdb->posts ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $row ) {
			$out[] = array(
				'id'    => (string) $row['ID'],
				'title' => (string) $row['post_title'],
			);
		}
		return $out;
	}

	/** @inheritDoc */
	public function read( string $id ): ?array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's posts.
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT ID, post_title, post_content FROM %i WHERE ID = %d AND post_type = 'wpforms' AND post_status NOT IN ('trash','auto-draft')", $wpdb->posts, (int) $id ), ARRAY_A );
		if ( ! $row ) {
			return null;
		}
		$data = json_decode( (string) $row['post_content'], true );
		if ( ! is_array( $data ) ) {
			return null;
		}
		$data['id']    = (string) $row['ID'];
		$data['title'] = (string) $row['post_title'];
		return $data;
	}

	/** @inheritDoc */
	public function map( array $raw, array $context ): array {
		return WPFormsMapper::map( $raw, $context );
	}

	/**
	 * The entry table, or an empty string when WPForms Lite never made one.
	 *
	 * @return string
	 */
	private function table(): string {
		if ( null === $this->entries ) {
			$table         = Importer::table( 'wpforms_entries' );
			$this->entries = '' !== $table ? $table : false;
		}
		return $this->entries ? $this->entries : '';
	}

	/**
	 * Extra WHERE for real entries.
	 *
	 * @param string $table Table.
	 * @return string
	 */
	private function realEntries( string $table ): string {
		global $wpdb;
		if ( null === $this->hasType ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Column check of another plugin's table.
			$this->hasType = (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW COLUMNS FROM %i LIKE %s', $table, 'type' ) );
		}
		$where = ' AND ( status IS NULL OR status NOT IN (' . self::SKIP_STATUS . ') )';
		if ( $this->hasType ) {
			$where .= " AND ( type IS NULL OR type NOT IN ('partial','payment') )";
		}
		return $where;
	}

	/** @inheritDoc */
	public function entryCount( string $id ): int {
		$table = $this->table();
		if ( '' === $table ) {
			return 0;
		}
		global $wpdb;
		$where = $this->realEntries( $table );
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Read of another plugin's table; $where holds fixed strings.
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM %i WHERE form_id = %d' . $where, $table, (int) $id ) );
	}

	/** @inheritDoc */
	public function entries( string $id, int $after, int $limit ): array {
		$table = $this->table();
		if ( '' === $table ) {
			return array();
		}
		global $wpdb;
		$where = $this->realEntries( $table );
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Read of another plugin's table; $where holds fixed strings.
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM %i WHERE form_id = %d AND entry_id > %d' . $where . ' ORDER BY entry_id ASC LIMIT %d', $table, (int) $id, $after, $limit ), ARRAY_A );
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$out = array();
		foreach ( (array) $rows as $row ) {
			$values = json_decode( (string) ( $row['fields'] ?? '' ), true );
			if ( ! is_array( $values ) || ! $values ) {
				$values = $this->fieldRows( (int) $row['entry_id'] );
			}
			$date  = (string) ( $row['date'] ?? '' );
			$out[] = array(
				'id'         => (int) $row['entry_id'],
				'created_at' => preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $date ) ? $date : '',
				'ip'         => (string) ( $row['ip_address'] ?? '' ),
				'user_agent' => (string) ( $row['user_agent'] ?? '' ),
				'values'     => $values,
			);
		}
		return $out;
	}

	/**
	 * Answers from `wpforms_entry_fields`, for entries whose JSON column is empty.
	 *
	 * @param int $entryId Entry id.
	 * @return array<string, array{value: string}>
	 */
	private function fieldRows( int $entryId ): array {
		$table = Importer::table( 'wpforms_entry_fields' );
		if ( '' === $table ) {
			return array();
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Read of another plugin's table.
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT field_id, value FROM %i WHERE entry_id = %d ORDER BY id ASC', $table, $entryId ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $row ) {
			$out[ (string) $row['field_id'] ] = array( 'value' => (string) $row['value'] );
		}
		return $out;
	}

	/** @inheritDoc */
	public function payload( array $entryMap, array $entry, int &$files ): array {
		return WPFormsMapper::payload( $entryMap, (array) $entry['values'], $files );
	}
}
