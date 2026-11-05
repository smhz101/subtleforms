<?php
/**
 * A source that can also hand over the entries visitors sent.
 *
 * Entries hold personal data, so they are only copied when the owner asks.
 * A source reads them in batches by entry id and turns each into answers for
 * the fields the mapper made. Nothing in the other plugin is changed.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.8.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Count, read and convert the entries of one form.
 */
interface EntrySource {

	/**
	 * How many entries the form has (spam and trash left out). 0 when the
	 * plugin keeps none, as WPForms Lite does.
	 *
	 * @param string $id Form id in the other plugin.
	 * @return int
	 */
	public function entryCount( string $id ): int;

	/**
	 * The next entries after an entry id, oldest first.
	 *
	 * Each row: id (int), created_at (UTC Y-m-d H:i:s or ''), ip, user_agent
	 * (empty when the plugin did not store them) and values (what payload()
	 * reads).
	 *
	 * @param string $id    Form id in the other plugin.
	 * @param int    $after Last entry id already handled; 0 to start.
	 * @param int    $limit Rows to return.
	 * @return array<int, array>
	 */
	public function entries( string $id, int $after, int $limit ): array;

	/**
	 * Answers for one entry, keyed by SubtleForms field key.
	 *
	 * @param array $entryMap `entry_map` from map().
	 * @param array $entry    A row from entries().
	 * @param int   $files    Number of uploaded file links kept as text, by reference.
	 * @return array<string, mixed>
	 */
	public function payload( array $entryMap, array $entry, int &$files ): array;
}
