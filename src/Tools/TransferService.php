<?php
/**
 * Read and write SubtleForms transfer packages.
 *
 * @package SubtleForms\Tools
 */

namespace SubtleForms\Tools;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Analytics\Stats;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\EntryValues;

/**
 * Export and import forms and submissions.
 */
final class TransferService {

	/** @var FormsRepository */
	private $forms;

	/** @var SubmissionsRepository */
	private $submissions;

	/**
	 * @param FormsRepository       $forms Forms.
	 * @param SubmissionsRepository $submissions Submissions.
	 */
	public function __construct( FormsRepository $forms, SubmissionsRepository $submissions ) {
		$this->forms       = $forms;
		$this->submissions = $submissions;
	}

	/**
	 * Export forms. An empty id list exports every form that is not in the Trash.
	 *
	 * @param int[] $ids Form ids.
	 * @return array
	 */
	public function exportForms( array $ids ): array {
		$ids = array_values( array_filter( array_map( 'intval', $ids ) ) );
		if ( ! $ids ) {
			if ( $this->forms->count() > TransferPackage::MAX_FORMS ) {
				return array(
					'error' => sprintf(
						/* translators: %d: maximum number of forms */
						__( 'Export up to %d forms at a time. Select the ones you want.', 'subtleforms' ),
						TransferPackage::MAX_FORMS
					),
				);
			}
			$rows = $this->forms->all(
				array(
					'limit'   => TransferPackage::MAX_FORMS,
					'orderby' => 'title',
					'order'   => 'ASC',
				)
			);
			$ids = array_map( 'intval', array_column( (array) $rows, 'id' ) );
		} elseif ( count( $ids ) > TransferPackage::MAX_FORMS ) {
			return array(
				'error' => sprintf(
					/* translators: %d: maximum number of forms */
					__( 'Export up to %d forms at a time. Select the ones you want.', 'subtleforms' ),
					TransferPackage::MAX_FORMS
				),
			);
		}
		$forms   = array();
		$missing = array();
		foreach ( $ids as $id ) {
			$form = $this->forms->find( $id );
			if ( ! is_array( $form ) || ( $form['status'] ?? '' ) === 'trash' ) {
				$missing[] = '#' . $id;
				continue;
			}
			try {
				$loaded = $this->forms->loadSchemaVersion( $id );
			} catch ( \Throwable $e ) {
				$loaded = null;
			}
			$schema = is_array( $loaded ) ? ( $loaded['schema'] ?? null ) : null;
			if ( ! is_array( $schema ) ) {
				// Never published: export the draft the builder holds (FF2-07).
				$schema = $this->forms->getDraftSchema( $id );
			}
			if ( ! is_array( $schema ) ) {
				$missing[] = (string) ( $form['title'] ?? '#' . $id );
				continue;
			}
			$status = (string) ( $form['status'] ?? 'draft' );
			$forms[] = array(
				'title'  => (string) ( $form['title'] ?? '' ),
				'status' => in_array( $status, array( 'draft', 'published' ), true ) ? $status : 'draft',
				'schema' => $schema,
			);
		}
		// An export that silently leaves forms out cannot be imported back,
		// so name them instead (FF2-07).
		if ( $missing ) {
			return array(
				'error' => sprintf(
					/* translators: %s: form titles or IDs */
					__( 'These forms could not be exported because they have no saved content or no longer exist: %s', 'subtleforms' ),
					implode( ', ', $missing )
				),
			);
		}
		if ( ! $forms ) {
			return array( 'error' => __( 'There are no forms to export.', 'subtleforms' ) );
		}
		return TransferPackage::forms( $forms );
	}

	/**
	 * Clean an imported schema exactly like a builder save (FF2-01).
	 *
	 * Imports go through the same request validator and sanitiser as the
	 * builder, so markup in labels, help text or Custom HTML is filtered
	 * the same way however the form arrived.
	 *
	 * @param array $schema Schema from a file.
	 * @return array Clean schema.
	 * @throws \SubtleForms\Validation\ValidationException When the schema is not valid.
	 */
	public static function cleanSchema( array $schema ): array {
		$validator = new \SubtleForms\Validation\RequestValidator( array( 'schemas' => \SubtleForms\Validation\Schemas::all() ) );
		$validated = $validator->validateOrFail( array( 'schema' => $schema ), \SubtleForms\Validation\Schemas::get( \SubtleForms\Validation\Schemas::FORM_SCHEMA_SAVE ) );
		return is_array( $validated['schema'] ?? null ) ? $validated['schema'] : array();
	}

	/**
	 * Clean imported answers like a visitor's submit (FF2-01): text is
	 * stripped of markup, and only Rich text answers keep safe formatting.
	 *
	 * @param array $payload Answers from a file.
	 * @param array $schema  The form's schema.
	 * @return array
	 */
	public static function cleanPayload( array $payload, array $schema ): array {
		$rich = array();
		foreach ( \SubtleForms\Payments\Pricing::fields( $schema ) as $field ) {
			if ( ( $field['type'] ?? '' ) === 'rich_text' && ! empty( $field['key'] ) ) {
				$rich[] = (string) $field['key'];
			}
		}
		$clean = static function ( $value, bool $keepMarkup ) use ( &$clean ) {
			if ( is_array( $value ) ) {
				$out = array();
				foreach ( $value as $k => $v ) {
					$out[ is_string( $k ) ? sanitize_text_field( $k ) : $k ] = $clean( $v, $keepMarkup );
				}
				return $out;
			}
			if ( ! is_string( $value ) ) {
				return is_scalar( $value ) || null === $value ? $value : '';
			}
			return $keepMarkup ? wp_kses_post( $value ) : sanitize_textarea_field( $value );
		};
		$out = array();
		foreach ( $payload as $key => $value ) {
			$key         = sanitize_text_field( (string) $key );
			$out[ $key ] = $clean( $value, in_array( $key, $rich, true ) );
		}
		return $out;
	}

	/**
	 * Create forms from a package.
	 *
	 * @param array $package Decoded JSON.
	 * @return array{created: array, error: string}
	 */
	public function importForms( array $package ): array {
		$read = TransferPackage::readForms( $package );
		if ( $read['error'] !== '' ) {
			return array(
				'created' => array(),
				'error'   => $read['error'],
			);
		}
		$created = array();
		$failed  = array();
		foreach ( $read['forms'] as $form ) {
			$id = $this->forms->create(
				array(
					'title'  => $form['title'],
					'status' => $form['status'],
					'config' => array(),
				)
			);
			if ( ! $id ) {
				$failed[] = $form['title'];
				continue;
			}
			try {
				$this->forms->saveSchemaVersion( $id, self::cleanSchema( $form['schema'] ), true );
				$created[] = array(
					'id'    => $id,
					'title' => $form['title'],
				);
			} catch ( \Throwable $e ) {
				$this->forms->delete( $id );
				$failed[] = $form['title'];
			}
		}
		return array(
			'created' => $created,
			'error'   => $failed
				? sprintf(
					/* translators: %s: form titles */
					__( 'These forms could not be imported: %s', 'subtleforms' ),
					implode( ', ', $failed )
				)
				: '',
		);
	}

	/**
	 * Create draft forms from a Gravity Forms or Fluent Forms export.
	 *
	 * @param string $source gravity or fluent.
	 * @param array  $payload Decoded JSON.
	 * @return array{created: array, notes: array, error: string}
	 */
	public function importMigrated( string $source, array $payload ): array {
		$built = FormMigration::schemas( $source, $payload );
		if ( $built['error'] !== '' ) {
			return array(
				'created' => array(),
				'notes'   => array(),
				'error'   => $built['error'],
			);
		}
		$created = array();
		$notes   = array();
		$failed  = array();
		foreach ( $built['forms'] as $form ) {
			$id = $this->forms->create(
				array(
					'title'  => $form['title'],
					'status' => 'draft',
					'config' => array(),
				)
			);
			if ( ! $id ) {
				$failed[] = $form['title'];
				continue;
			}
			try {
				$this->forms->saveSchemaVersion( $id, self::cleanSchema( $form['schema'] ), true );
				$created[] = array(
					'id'    => $id,
					'title' => $form['title'],
				);
				foreach ( $form['notes'] as $note ) {
					$notes[] = $form['title'] . ': ' . $note;
				}
			} catch ( \Throwable $e ) {
				$this->forms->delete( $id );
				$failed[] = $form['title'];
			}
		}
		return array(
			'created' => $created,
			'notes'   => $notes,
			'error'   => $failed
				? sprintf(
					/* translators: %s: form titles */
					__( 'These forms could not be imported: %s', 'subtleforms' ),
					implode( ', ', $failed )
				)
				: '',
		);
	}

	/**
	 * Export one form's submissions. Passwords are omitted.
	 *
	 * @param int $formId Form id.
	 * @return array
	 */
	public function exportSubmissions( int $formId ): array {
		$form = $this->forms->find( $formId );
		if ( ! is_array( $form ) ) {
			return TransferPackage::submissions( array( 'id' => $formId, 'title' => '' ), array() );
		}
		if ( $this->submissions->count( array( 'form_id' => $formId ) ) > TransferPackage::MAX_SUBMISSIONS ) {
			return array(
				'error' => sprintf(
					/* translators: %d: maximum number of submissions */
					__( 'This form has more than %d submissions, so nothing was exported.', 'subtleforms' ),
					TransferPackage::MAX_SUBMISSIONS
				),
			);
		}
		$secrets = $this->secretKeysByVersion( $formId );
		$rows    = array();
		$offset  = 0;
		while ( count( $rows ) <= TransferPackage::MAX_SUBMISSIONS ) {
			$batch = $this->submissions->findByForm(
				$formId,
				array(
					'limit'   => 200,
					'offset'  => $offset,
					'orderby' => 'created_at',
					'order'   => 'ASC',
				)
			);
			if ( ! $batch ) {
				break;
			}
			foreach ( $batch as $row ) {
				$payload = is_array( $row['payload'] ?? null ) ? $row['payload'] : array();
				$version = (int) ( $row['schema_version'] ?? 0 );
				$keys    = $secrets[ $version ] ?? $secrets[0];
				$meta    = is_array( $row['meta'] ?? null ) ? $row['meta'] : array();
				$rows[]  = array_merge(
					array(
						'status'     => (string) ( $row['status'] ?? 'unread' ),
						'is_read'    => empty( $row['is_read'] ) ? 0 : 1,
						'starred'    => empty( $row['starred'] ) ? 0 : 1,
						'created_at' => (string) ( $row['created_at'] ?? '' ),
						'payload'    => TransferPackage::withoutSecrets( $payload, $keys ),
					),
					// The order and payment record go with the entry (PAY2-01).
					TransferPackage::paymentMeta( $meta )
				);
			}
			$offset += 200;
			if ( count( $batch ) < 200 ) {
				break;
			}
		}
		if ( count( $rows ) > TransferPackage::MAX_SUBMISSIONS ) {
			return array(
				'error' => sprintf(
					/* translators: %d: maximum number of submissions */
					__( 'This form has more than %d submissions, so nothing was exported.', 'subtleforms' ),
					TransferPackage::MAX_SUBMISSIONS
				),
			);
		}
		return TransferPackage::submissions(
			array(
				'id'    => $formId,
				'title' => (string) ( $form['title'] ?? '' ),
			),
			$rows
		);
	}

	/**
	 * Import submissions into an existing form.
	 *
	 * @param int   $formId Form id.
	 * @param array $package Decoded JSON.
	 * @return array{imported: int, error: string}
	 */
	public function importSubmissions( int $formId, array $package ): array {
		$form = $this->forms->find( $formId );
		if ( ! is_array( $form ) || ( $form['status'] ?? '' ) === 'trash' ) {
			return array(
				'imported' => 0,
				'error'    => __( 'Choose a form to import into.', 'subtleforms' ),
			);
		}
		$read = TransferPackage::readSubmissions( $package );
		if ( $read['error'] !== '' ) {
			return array(
				'imported' => 0,
				'error'    => $read['error'],
			);
		}
		try {
			$loaded = $this->forms->loadSchemaVersion( $formId );
		} catch ( \Throwable $e ) {
			$loaded = null;
		}
		$schema   = is_array( $loaded ) && is_array( $loaded['schema'] ?? null ) ? $loaded['schema'] : ( $this->forms->getDraftSchema( $formId ) ?? array() );
		$imported = 0;
		foreach ( $read['submissions'] as $row ) {
			try {
				$id = $this->submissions->create(
					array(
						'form_id' => $formId,
						'payload' => self::cleanPayload( (array) $row['payload'], $schema ),
						'status'  => $row['status'],
						'meta'    => (array) ( $row['meta'] ?? array() ),
					)
				);
			} catch ( \Throwable $e ) {
				continue;
			}
			if ( ! empty( $row['is_read'] ) || ! empty( $row['starred'] ) ) {
				$this->submissions->update(
					$id,
					array(
						'is_read' => empty( $row['is_read'] ) ? 0 : 1,
						'starred' => empty( $row['starred'] ) ? 0 : 1,
					)
				);
			}
			if ( $row['created_at'] !== '' ) {
				$this->submissions->setCreatedAt( $id, $row['created_at'] );
			}
			if ( in_array( $row['status'], \SubtleForms\Analytics\Stats::COUNTED_STATUSES, true ) ) {
				$day = $row['created_at'] !== '' ? substr( $row['created_at'], 0, 10 ) : '';
				try {
					Stats::increment( $formId, 'submissions', $day );
				} catch ( \Throwable $e ) {
					// The entry is stored either way.
				}
			}
			++$imported;
		}
		return array(
			'imported' => $imported,
			'error'    => '',
		);
	}

	/**
	 * Password field keys for each schema version. Key 0 is every version combined.
	 *
	 * @param int $formId Form id.
	 * @return array<int, string[]>
	 */
	private function secretKeysByVersion( int $formId ): array {
		$by    = array();
		$union = array();
		try {
			$versions = $this->forms->getSchemaVersions( $formId );
		} catch ( \Throwable $e ) {
			$versions = array();
		}
		if ( ! $versions ) {
			$versions = array( array( 'version' => 0 ) );
		}
		foreach ( $versions as $version ) {
			$number = (int) ( $version['version'] ?? 0 );
			try {
				$loaded = $number > 0
					? $this->forms->loadSchemaVersion( $formId, $number )
					: $this->forms->loadSchemaVersion( $formId );
			} catch ( \Throwable $e ) {
				continue;
			}
			$schema = is_array( $loaded ) ? ( $loaded['schema'] ?? array() ) : array();
			$keys   = EntryValues::secretKeys( is_array( $schema ) ? $schema : array() );
			if ( $number > 0 ) {
				$by[ $number ] = $keys;
			}
			$union = array_merge( $union, $keys );
		}
		$by[0] = array_values( array_unique( $union ) );
		return $by;
	}
}
