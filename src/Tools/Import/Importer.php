<?php
/**
 * One-click import of forms from other form plugins on this site.
 *
 * Finds the forms each source left in the database, maps them, and saves
 * them as SubtleForms drafts. The original forms are only ever read. Payment
 * settings are not imported and no email is sent: the form is saved, not
 * submitted. Entries are copied only when the owner asks, in batches, by
 * importEntries().
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
 * Detect, list and import forms from Contact Form 7, Gravity Forms, Fluent
 * Forms, WPForms and Ninja Forms (and any source added with
 * `subtleforms/import/sources`).
 */
final class Importer {

	/** Forms imported in one request. The screen sends one at a time. */
	public const MAX_PER_REQUEST = 20;

	/** Entries copied in one request. */
	public const ENTRY_BATCH = 200;

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
		$sources = array( new Cf7Source(), new GravitySource(), new FluentSource(), new WPFormsSource(), new NinjaSource() );
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
			$count  = 0;
			try {
				$count = $source instanceof EntrySource ? $source->entryCount( $id ) : 0;
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
				'entries'  => $count,
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
			'entries'   => 0,
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
		try {
			$result['entries'] = $source instanceof EntrySource ? $source->entryCount( $id ) : 0;
		} catch ( \Throwable $e ) {
			$result['entries'] = 0;
		}

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
	 * Copy one batch of entries into a form made by an earlier import.
	 *
	 * The caller asks for entries only after the owner agreed. Entries keep
	 * their date, are marked read, and carry where they came from, so a second
	 * run skips the ones already copied. Uploaded files are not copied: their
	 * address is kept as text.
	 *
	 * @param Source $source       Source.
	 * @param string $id           Form id in the other plugin.
	 * @param int    $targetFormId SubtleForms form made from it.
	 * @param int    $after        Last source entry id handled; 0 to start.
	 * @param int    $limit        Entries in this batch.
	 * @return array{imported: int, skipped: int, failed: int, files: int, next: int, done: bool, error: string}
	 */
	public function importEntries( Source $source, string $id, int $targetFormId, int $after = 0, int $limit = self::ENTRY_BATCH ): array {
		$result = array(
			'imported' => 0,
			'skipped'  => 0,
			'failed'   => 0,
			'files'    => 0,
			'next'     => $after,
			'done'     => true,
			'error'    => '',
		);
		if ( ! $source instanceof EntrySource ) {
			$result['error'] = __( 'This plugin has no entries to import.', 'subtleforms' );
			return $result;
		}
		$limit = max( 1, min( self::ENTRY_BATCH, $limit ) );
		$ref   = self::ref( $source->id(), $id );
		$own   = false;
		foreach ( $this->existing( $ref ) as $form ) {
			if ( (int) $form['id'] === $targetFormId ) {
				$own = true;
			}
		}
		if ( ! $own ) {
			$result['error'] = __( 'Entries can only be copied into a form imported from this one.', 'subtleforms' );
			return $result;
		}
		$raw = $source->read( $id );
		if ( ! $raw ) {
			$result['error'] = __( 'This form is no longer there.', 'subtleforms' );
			return $result;
		}
		try {
			$mapped = $source->map( $raw, self::context() );
		} catch ( \Throwable $e ) {
			$result['error'] = __( 'This form could not be read.', 'subtleforms' );
			return $result;
		}
		$entryMap = (array) ( $mapped['entry_map'] ?? array() );
		$loaded   = $this->forms->loadSchemaVersion( $targetFormId );
		$schema   = is_array( $loaded ) && is_array( $loaded['schema'] ?? null ) ? $loaded['schema'] : ( $this->forms->getDraftSchema( $targetFormId ) ?? array() );
		$known    = array();
		foreach ( \SubtleForms\Support\SchemaFields::flat( $schema ) as $field ) {
			if ( ! empty( $field['key'] ) ) {
				$known[ (string) $field['key'] ] = true;
			}
		}

		$rows = $source->entries( $id, $after, $limit );
		if ( ! $rows ) {
			return $result;
		}
		$refs = array();
		foreach ( $rows as $row ) {
			$refs[] = self::entryRef( $source->id(), $id, (int) $row['id'] );
		}
		$have        = $this->importedEntryRefs( $targetFormId, $refs );
		$submissions = new \SubtleForms\Repositories\SubmissionsRepository();
		foreach ( $rows as $row ) {
			$result['next'] = (int) $row['id'];
			$entryRef       = self::entryRef( $source->id(), $id, (int) $row['id'] );
			if ( isset( $have[ $entryRef ] ) ) {
				++$result['skipped'];
				continue;
			}
			try {
				$files   = 0;
				$payload = array_intersect_key( $source->payload( $entryMap, $row, $files ), $known );
				$payload = TransferService::cleanPayload( $payload, $schema );
				$created = $submissions->create(
					array(
						'form_id'    => $targetFormId,
						'payload'    => $payload,
						'ip_address' => (string) ( $row['ip'] ?? '' ),
						'user_agent' => (string) ( $row['user_agent'] ?? '' ),
						'meta'       => array(
							'import' => array(
								'ref'              => $entryRef,
								'imported_from'    => $source->id(),
								'original_form_id' => $id,
								'original_id'      => (string) $row['id'],
							),
						),
					)
				);
				$submissions->update( $created, array( 'is_read' => 1 ) );
				if ( '' !== (string) $row['created_at'] ) {
					$submissions->setCreatedAt( $created, (string) $row['created_at'] );
				}
				$result['files'] += $files;
				++$result['imported'];
				/** This action is documented in src/Tools/TransferService.php. */
				do_action( 'subtleforms/submission/imported', $created, $targetFormId, 'unread', (string) $row['created_at'] );
			} catch ( \Throwable $e ) {
				++$result['failed'];
			}
		}
		$result['done'] = count( $rows ) < $limit;
		return $result;
	}

	/**
	 * The reference stored on an imported entry.
	 *
	 * @param string $source Source id.
	 * @param string $form   Form id in the other plugin.
	 * @param int    $entry  Entry id in the other plugin.
	 * @return string
	 */
	public static function entryRef( string $source, string $form, int $entry ): string {
		return $source . ':' . $form . ':' . $entry;
	}

	/**
	 * Which of these entry references are already in the form.
	 *
	 * @param int      $formId SubtleForms form.
	 * @param string[] $refs   References from entryRef().
	 * @return array<string, true>
	 */
	private function importedEntryRefs( int $formId, array $refs ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_submissions';
		$found = array();
		foreach ( array_chunk( $refs, 10 ) as $chunk ) {
			// Always ten patterns, so the query text is fixed; a short last chunk repeats its final reference.
			$like = array();
			for ( $i = 0; $i < 10; $i++ ) {
				$ref    = $chunk[ min( $i, count( $chunk ) - 1 ) ];
				$like[] = '%' . $wpdb->esc_like( '"ref":' . wp_json_encode( $ref ) ) . '%';
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Lookup by a value inside entry meta.
			$metas = $wpdb->get_col( $wpdb->prepare( 'SELECT meta FROM %i WHERE form_id = %d AND ( meta LIKE %s OR meta LIKE %s OR meta LIKE %s OR meta LIKE %s OR meta LIKE %s OR meta LIKE %s OR meta LIKE %s OR meta LIKE %s OR meta LIKE %s OR meta LIKE %s )', $table, $formId, $like[0], $like[1], $like[2], $like[3], $like[4], $like[5], $like[6], $like[7], $like[8], $like[9] ) );
			foreach ( (array) $metas as $meta ) {
				$decoded = json_decode( (string) $meta, true );
				$ref     = is_array( $decoded ) ? (string) ( $decoded['import']['ref'] ?? '' ) : '';
				if ( '' !== $ref ) {
					$found[ $ref ] = true;
				}
			}
		}
		return $found;
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
