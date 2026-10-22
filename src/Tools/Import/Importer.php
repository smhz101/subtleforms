<?php
/**
 * One-click import of forms from other form plugins on this site.
 *
 * Finds the forms each source left in the database, maps them, and saves
 * them as SubtleForms drafts. The original forms are only ever read. Entries
 * and payment settings are not imported and no email is sent: the form is
 * saved, not submitted.
 *
 * @package SubtleForms\Tools\Import
 * @since   2.6.0
 */

namespace SubtleForms\Tools\Import;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Tools\TransferService;

/**
 * Detect, list and import forms from Contact Form 7, Gravity Forms and
 * Fluent Forms (and any source added with `subtleforms/import/sources`).
 */
final class Importer {

	/** Forms imported in one request. The screen sends one at a time. */
	public const MAX_PER_REQUEST = 20;

	/** @var FormsRepository */
	private $forms;

	/** @var array<string, Source> */
	private $sources = array();

	/**
	 * @param FormsRepository $forms   Forms.
	 * @param Source[]|null   $sources Sources; null for the built-in ones.
	 */
	public function __construct( FormsRepository $forms, ?array $sources = null ) {
		$this->forms = $forms;
		foreach ( null === $sources ? self::defaultSources() : $sources as $source ) {
			if ( $source instanceof Source ) {
				$this->sources[ $source->id() ] = $source;
			}
		}
	}

	/**
	 * Built-in sources, open to add-ons.
	 *
	 * @return Source[]
	 */
	public static function defaultSources(): array {
		$sources = array( new Cf7Source(), new GravitySource(), new FluentSource() );
		/**
		 * Filter the plugins SubtleForms can import forms from.
		 *
		 * Each item implements \SubtleForms\Tools\Import\Source.
		 *
		 * @since 2.6.0
		 *
		 * @param Source[] $sources Sources.
		 */
		$filtered = apply_filters( 'subtleforms/import/sources', $sources );
		return is_array( $filtered ) ? $filtered : $sources;
	}

	/**
	 * @param string $id Source id.
	 * @return Source|null
	 */
	public function source( string $id ): ?Source {
		return $this->sources[ $id ] ?? null;
	}

	/**
	 * Every source with how many forms it left on this site.
	 *
	 * @return array<int, array{id: string, label: string, active: bool, count: int}>
	 */
	public function detect(): array {
		$out = array();
		foreach ( $this->sources as $source ) {
			try {
				$count = $source->count();
			} catch ( \Throwable $e ) {
				$count = 0;
			}
			$out[] = array(
				'id'     => $source->id(),
				'label'  => $source->label(),
				'active' => $source->active(),
				'count'  => $count,
			);
		}
		return $out;
	}

	/**
	 * The forms of one source, each with its field count, how many report
	 * lines an import would give, and the SubtleForms forms already made from it.
	 *
	 * @param Source $source Source.
	 * @return array<int, array>
	 */
	public function forms( Source $source ): array {
		$context = self::context();
		$out     = array();
		foreach ( $source->forms() as $row ) {
			$id     = (string) $row['id'];
			$fields = 0;
			$notes  = 0;
			try {
				$raw = $source->read( $id );
				if ( $raw ) {
					$mapped = $source->map( $raw, $context );
					$fields = SchemaBuilder::countFields( (array) ( $mapped['schema']['fields'] ?? array() ) );
					$notes  = $mapped['notes']->count();
				}
			} catch ( \Throwable $e ) {
				$notes = 1;
			}
			$out[] = array(
				'id'       => $id,
				'title'    => '' !== trim( (string) $row['title'] ) ? (string) $row['title'] : __( '(no title)', 'subtleforms' ),
				'fields'   => $fields,
				'notes'    => $notes,
				'imported' => $this->existing( self::ref( $source->id(), $id ) ),
			);
		}
		return $out;
	}

	/**
	 * Import forms as drafts.
	 *
	 * A form imported before is not imported again unless its id is in
	 * $copies: the result says `exists` so the screen can ask first.
	 *
	 * @param Source   $source Source.
	 * @param string[] $ids    Form ids in the other plugin.
	 * @param string[] $copies Ids to import again as a copy.
	 * @return array<int, array>
	 */
	public function import( Source $source, array $ids, array $copies = array() ): array {
		$context = self::context();
		$copies  = array_map( 'strval', $copies );
		$results = array();
		foreach ( array_slice( array_values( array_unique( array_map( 'strval', $ids ) ) ), 0, self::MAX_PER_REQUEST ) as $id ) {
			$results[] = $this->importOne( $source, $id, in_array( $id, $copies, true ), $context );
		}
		return $results;
	}

	/**
	 * @param Source $source  Source.
	 * @param string $id      Form id.
	 * @param bool   $asCopy  Import even when imported before.
	 * @param array  $context Site facts.
	 * @return array
	 */
	private function importOne( Source $source, string $id, bool $asCopy, array $context ): array {
		$result = array(
			'source_id' => $id,
			'title'     => '',
			'status'    => 'failed',
			'form_id'   => 0,
			'edit_url'  => '',
			'fields'    => 0,
			'notes'     => array(),
			'existing'  => array(),
			'error'     => '',
		);
		$raw = $source->read( $id );
		if ( ! $raw ) {
			$result['status'] = 'missing';
			$result['error']  = __( 'This form is no longer there.', 'subtleforms' );
			return $result;
		}
		$ref                = self::ref( $source->id(), $id );
		$result['existing'] = $this->existing( $ref );
		$result['title']    = SchemaBuilder::title( (string) ( $raw['title'] ?? '' ) );
		if ( $result['existing'] && ! $asCopy ) {
			$result['status'] = 'exists';
			return $result;
		}

		try {
			$mapped = $source->map( $raw, $context );
		} catch ( \Throwable $e ) {
			$result['error'] = __( 'This form could not be read.', 'subtleforms' );
			return $result;
		}
		$title  = (string) $mapped['title'];
		$schema = (array) $mapped['schema'];
		if ( $asCopy && $result['existing'] ) {
			/* translators: %s: form title */
			$title = sprintf( __( '%s (copy)', 'subtleforms' ), $title );
		}
		$schema['metadata']['title']        = $title;
		$schema['metadata']['importRef']    = $ref;
		$schema['metadata']['importedFrom'] = array(
			'plugin' => $source->id(),
			'id'     => $id,
			'title'  => (string) ( $raw['title'] ?? '' ),
		);

		$formId = (int) $this->forms->create(
			array(
				'title'  => $title,
				'status' => 'draft',
				'config' => array(),
			)
		);
		if ( $formId <= 0 ) {
			$result['error'] = __( 'The form could not be created.', 'subtleforms' );
			return $result;
		}
		try {
			$clean = TransferService::cleanSchema( $schema );
			$this->forms->saveSchemaVersion( $formId, FormsRepository::beforeSave( $clean, $formId, true ), true );
		} catch ( \Throwable $e ) {
			$this->forms->delete( $formId );
			$result['error'] = __( 'The form could not be saved. Nothing was created.', 'subtleforms' );
			return $result;
		}

		$notes            = $mapped['notes'];
		$result['title']  = $title;
		$result['status'] = 'imported';
		$result['form_id'] = $formId;
		$result['edit_url'] = admin_url( 'admin.php?page=subtleforms-new-form&form_id=' . $formId );
		$result['fields'] = SchemaBuilder::countFields( (array) ( $schema['fields'] ?? array() ) );
		$result['notes']  = $notes instanceof ImportNotes ? $notes->all() : array();

		/**
		 * A form was imported from another plugin.
		 *
		 * @since 2.6.0
		 *
		 * @param int    $formId New SubtleForms form ID.
		 * @param string $source Source id (cf7, gravity, fluent).
		 * @param string $id     Form id in the other plugin.
		 */
		do_action( 'subtleforms/import/imported', $formId, $source->id(), $id );
		return $result;
	}

	/**
	 * The reference stored on an imported form: source and original id.
	 *
	 * @param string $source Source id.
	 * @param string $id     Form id in the other plugin.
	 * @return string
	 */
	public static function ref( string $source, string $id ): string {
		return $source . ':' . $id;
	}

	/**
	 * SubtleForms forms (not in the Trash) imported from this source form.
	 *
	 * @param string $ref Reference from ref().
	 * @return array<int, array{id: int, title: string, status: string, edit_url: string}>
	 */
	public function existing( string $ref ): array {
		global $wpdb;
		$table  = $wpdb->prefix . 'subtleforms_forms';
		$needle = '%' . $wpdb->esc_like( '"importRef":' . wp_json_encode( $ref ) ) . '%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Lookup by a value inside the stored schema; no cache fits.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, title, status FROM %i WHERE status <> 'trash' AND ( config LIKE %s OR draft_schema LIKE %s ) ORDER BY id ASC", $table, $needle, $needle ), ARRAY_A );
		$out  = array();
		foreach ( (array) $rows as $row ) {
			$out[] = array(
				'id'       => (int) $row['id'],
				'title'    => (string) $row['title'],
				'status'   => (string) $row['status'],
				'edit_url' => admin_url( 'admin.php?page=subtleforms-new-form&form_id=' . (int) $row['id'] ),
			);
		}
		return $out;
	}

	/**
	 * Site facts the mappers write into email headers.
	 *
	 * @return array{site_title: string, site_url: string, admin_email: string}
	 */
	public static function context(): array {
		return array(
			'site_title'  => wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES ),
			'site_url'    => (string) home_url( '/' ),
			'admin_email' => (string) get_option( 'admin_email' ),
		);
	}

	/**
	 * The full name of a table when it exists, else an empty string.
	 *
	 * @param string $name Table name without the prefix.
	 * @return string
	 */
	public static function table( string $name ): string {
		global $wpdb;
		$table = $wpdb->prefix . $name;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Existence check of another plugin's table.
		$found = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) );
		return $found === $table ? $table : '';
	}
}
