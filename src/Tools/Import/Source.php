<?php
/**
 * One form plugin SubtleForms can import from.
 *
 * A source only ever reads. It finds the other plugin's forms in the database
 * whether or not that plugin is active, and turns one form into a SubtleForms
 * schema. Saving, the re-import guard and the report shape are shared and
 * live in Importer. Add a source with the `subtleforms/import/sources` filter.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Detect, list, read and map the forms of another plugin.
 */
interface Source {

	/**
	 * Short id used in the REST routes and the source reference: cf7,
	 * gravity, fluent.
	 *
	 * @return string
	 */
	public function id(): string;

	/**
	 * The plugin's name, as people know it.
	 *
	 * @return string
	 */
	public function label(): string;

	/**
	 * Whether the plugin is active right now. Importing works either way.
	 *
	 * @return bool
	 */
	public function active(): bool;

	/**
	 * How many forms the plugin left in the database. 0 when none or when its
	 * tables are not there.
	 *
	 * @return int
	 */
	public function count(): int;

	/**
	 * Every form, lightest first: id and title.
	 *
	 * @return array<int, array{id: string, title: string}>
	 */
	public function forms(): array;

	/**
	 * Everything the mapper needs for one form, straight from the database.
	 *
	 * @param string $id Form id in the other plugin.
	 * @return array|null Null when the form does not exist.
	 */
	public function read( string $id ): ?array;

	/**
	 * Turn one form into a SubtleForms schema and a report. Writes nothing.
	 *
	 * @param array $raw     What read() returned.
	 * @param array $context Site facts: site_title, site_url, admin_email.
	 * @return array{title: string, schema: array, notes: ImportNotes}
	 */
	public function map( array $raw, array $context ): array;
}
