<?php
/**
 * The form schema an entry was made with.
 *
 * Entries reference their schema by version (the `schema_version` column)
 * instead of keeping a full copy in their meta (FF-30, 2.4.0). Entries saved
 * before 2.4.0 may still hold a copy under `meta.form_schema`; it is used
 * when the entry has no version, or its version cannot be loaded, so old
 * entries stay readable.
 *
 * @package SubtleForms\Support
 * @since   2.4.0
 */

namespace SubtleForms\Support;

use SubtleForms\Repositories\FormsRepository;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves an entry's schema.
 */
final class EntrySchema {

	/**
	 * Meta key of the schema copy older entries carry.
	 */
	public const META_KEY = 'form_schema';

	/**
	 * Schemas loaded in this request, by "form:version".
	 *
	 * @var array<string,array|null>
	 */
	private static $cache = array();

	/**
	 * The schema for an entry row.
	 *
	 * @param array                $submission Entry row (form_id, schema_version, meta).
	 * @param FormsRepository|null $forms      Forms repository.
	 * @return array|null Null when no schema can be found.
	 */
	public static function forEntry( array $submission, ?FormsRepository $forms = null ): ?array {
		$formId  = (int) ( $submission['form_id'] ?? 0 );
		$version = isset( $submission['schema_version'] ) && '' !== (string) $submission['schema_version'] ? (int) $submission['schema_version'] : null;
		$meta    = $submission['meta'] ?? array();
		if ( is_string( $meta ) ) {
			$meta = json_decode( $meta, true );
		}
		$copy = is_array( $meta ) && isset( $meta[ self::META_KEY ] ) && is_array( $meta[ self::META_KEY ] ) ? $meta[ self::META_KEY ] : null;

		if ( $formId > 0 && null !== $version ) {
			$schema = self::load( $formId, $version, $forms );
			if ( null !== $schema ) {
				return $schema;
			}
		}
		if ( null !== $copy ) {
			return $copy;
		}
		return $formId > 0 ? self::load( $formId, null, $forms ) : null;
	}

	/**
	 * Remove the schema copy from entry meta.
	 *
	 * @param mixed $meta Entry meta.
	 * @return mixed
	 */
	public static function stripCopy( $meta ) {
		if ( is_array( $meta ) ) {
			unset( $meta[ self::META_KEY ] );
		}
		return $meta;
	}

	/**
	 * Forget schemas loaded in this request.
	 */
	public static function flush(): void {
		self::$cache = array();
	}

	/**
	 * Load a schema version (null for the active one). Saved versions are
	 * cached for the request.
	 *
	 * @param int                  $formId  Form ID.
	 * @param int|null             $version Version.
	 * @param FormsRepository|null $forms   Forms repository.
	 * @return array|null
	 */
	private static function load( int $formId, ?int $version, ?FormsRepository $forms ): ?array {
		$key = $formId . ':' . ( null === $version ? 'active' : $version );
		if ( array_key_exists( $key, self::$cache ) ) {
			return self::$cache[ $key ];
		}
		try {
			$forms  = $forms ?? new FormsRepository();
			$loaded = $forms->loadSchemaVersion( $formId, $version );
			$schema = is_array( $loaded ) ? ( $loaded['schema'] ?? null ) : null;
		} catch ( \Throwable $e ) {
			$schema = null;
		}
		$schema = is_array( $schema ) ? $schema : null;
		// Versions never change once saved; the active one can.
		if ( null !== $version ) {
			self::$cache[ $key ] = $schema;
		}
		return $schema;
	}
}
