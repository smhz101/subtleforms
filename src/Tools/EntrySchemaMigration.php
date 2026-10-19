<?php
/**
 * Drop the schema copy older entries keep in their meta (FF-30, 2.4.0).
 *
 * Before 2.4.0 every entry stored the whole form schema in its meta, about
 * 1 KB per entry. Entries already reference their schema by version, so the
 * copy is removed in small batches by a background job:
 *
 * - An entry whose schema version can be loaded loses the copy.
 * - An entry with no version, or whose version cannot be loaded, keeps the
 *   copy, so it stays readable.
 *
 * Each batch reads rows after the last ID it handled, so the job never scans
 * the table twice and is safe to run more than once.
 *
 * @package SubtleForms\Tools
 * @since   2.4.0
 */

namespace SubtleForms\Tools;

use SubtleForms\Support\EntrySchema;
use SubtleForms\Support\Logger;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Batched removal of entry schema copies.
 */
final class EntrySchemaMigration {

	/**
	 * Cron hook that runs one batch.
	 */
	public const HOOK = 'subtleforms_entry_schema_migration';

	/**
	 * Option holding the last entry ID handled, or 'done'.
	 */
	public const OPTION = 'subtleforms_entry_schema_cursor';

	/**
	 * Entries read per batch.
	 */
	public const BATCH = 200;

	/**
	 * Hook the job.
	 */
	public static function register(): void {
		add_action( self::HOOK, array( self::class, 'runScheduled' ) );
	}

	/**
	 * Start the job unless it has finished. Called on activation and upgrade.
	 */
	public static function schedule(): void {
		if ( 'done' === get_option( self::OPTION ) ) {
			return;
		}
		if ( false === get_option( self::OPTION ) ) {
			add_option( self::OPTION, '0', '', false );
		}
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_single_event( time() + 30, self::HOOK );
		}
	}

	/**
	 * Cron callback: one batch, then the next one if rows are left.
	 */
	public static function runScheduled(): void {
		$result = self::runBatch();
		if ( ! $result['done'] && ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_single_event( time() + 10, self::HOOK );
		}
	}

	/**
	 * Handle one batch of entries.
	 *
	 * @param int $limit Entries to read.
	 * @return array{scanned:int,cleaned:int,kept:int,done:bool}
	 */
	public static function runBatch( int $limit = self::BATCH ): array {
		global $wpdb;
		$table   = $wpdb->prefix . 'subtleforms_submissions';
		$schemas = $wpdb->prefix . 'subtleforms_form_schemas';
		$cursor  = get_option( self::OPTION, '0' );
		$result  = array(
			'scanned' => 0,
			'cleaned' => 0,
			'kept'    => 0,
			'done'    => 'done' === $cursor,
		);
		if ( $result['done'] ) {
			return $result;
		}
		$cursor = (int) $cursor;
		$limit  = max( 1, $limit );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time background upgrade.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT id, form_id, schema_version, meta FROM %i WHERE id > %d AND meta LIKE %s ORDER BY id ASC LIMIT %d',
				$table,
				$cursor,
				'%' . $wpdb->esc_like( '"' . EntrySchema::META_KEY . '"' ) . '%',
				$limit
			),
			ARRAY_A
		);

		$versions = array();
		foreach ( (array) $rows as $row ) {
			++$result['scanned'];
			$cursor = max( $cursor, (int) $row['id'] );
			$meta   = json_decode( (string) $row['meta'], true );
			if ( ! is_array( $meta ) || ! array_key_exists( EntrySchema::META_KEY, $meta ) ) {
				continue;
			}
			$version = null === $row['schema_version'] ? null : (int) $row['schema_version'];
			$key     = (int) $row['form_id'] . ':' . (string) $version;
			if ( ! array_key_exists( $key, $versions ) ) {
				$versions[ $key ] = null !== $version && (bool) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time background upgrade.
					$wpdb->prepare( 'SELECT 1 FROM %i WHERE form_id = %d AND version = %d LIMIT 1', $schemas, (int) $row['form_id'], $version )
				);
			}
			if ( ! $versions[ $key ] ) {
				// No version to read the entry with: the copy stays.
				++$result['kept'];
				continue;
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time background upgrade.
			$wpdb->update(
				$table,
				array( 'meta' => wp_json_encode( EntrySchema::stripCopy( $meta ) ) ),
				array( 'id' => (int) $row['id'] ),
				array( '%s' ),
				array( '%d' )
			);
			++$result['cleaned'];
		}

		$result['done'] = count( (array) $rows ) < $limit;
		update_option( self::OPTION, $result['done'] ? 'done' : (string) $cursor, false );
		if ( $result['done'] ) {
			Logger::info( 'Entry schema copies removed; entries reference their schema version.' );
		}
		return $result;
	}
}
