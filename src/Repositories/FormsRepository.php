<?php
/**
 * SubtleForms Forms Repository
 *
 * @package   SubtleForms\Repositories
 * @version   0.1.0
 */

namespace SubtleForms\Repositories;

use SubtleForms\Support\Helpers;

/**
 * Repository for managing forms.
 */
final class FormsRepository {

	/**
	 * @var string
	 */
	private $table;

	/**
	 * @var string
	 */
	private $schemas_table;

	public function __construct() {
		global $wpdb;
		$this->table         = $wpdb->prefix . 'subtleforms_forms';
		$this->schemas_table = $wpdb->prefix . 'subtleforms_form_schemas';

		// Verify tables exist on first instantiation
		$this->ensureTablesExist();
	}

	/**
	 * Verify required database tables exist.
	 *
	 * @throws \RuntimeException If tables are missing
	 */
	private function ensureTablesExist(): void {
		global $wpdb;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, set in constructor from $wpdb->prefix.
		$forms_exists   = $wpdb->get_var( "SHOW TABLES LIKE '{$this->table}'" );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table names are safe, set in constructor from $wpdb->prefix.
		$schemas_exists = $wpdb->get_var( "SHOW TABLES LIKE '{$this->schemas_table}'" );

		$missing = array();
		if ( $forms_exists !== $this->table ) {
			$missing[] = $this->table;
		}
		if ( $schemas_exists !== $this->schemas_table ) {
			$missing[] = $this->schemas_table;
		}

		if ( ! empty( $missing ) ) {
			$error = sprintf(
				'SubtleForms database tables are missing: %s. Please deactivate and reactivate the plugin to create them.',
				implode( ', ', $missing )
			);
			error_log( 'SubtleForms Repository Error: ' . $error );
			throw new \RuntimeException( $error );
		}
	}

	/**
	 * Get a form by ID.
	 */
	public function find( int $id ): ?array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery -- Table name is safe. Direct query needed for dynamic form data.
		$result = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->table} WHERE id = %d", $id ),
			ARRAY_A
		);

		if ( ! $result ) {
			return null;
		}

		// Decode JSON config
		$result['config'] = Helpers::safe_json_decode( Helpers::safe_array_get( $result, 'config', '{}' ), true, array() );
		return $result;
	}

	/**
	 * Get all forms.
	 */
	public function all( array $args = array() ): array {
		global $wpdb;

		$start = \SubtleForms\Support\QueryInstrumentation::start( __METHOD__ );

		$defaults = array(
			'status'  => null,
			'search'  => null,
			'limit'   => 20,
			'offset'  => 0,
			'orderby' => 'created_at',
			'order'   => 'DESC',
		);

		$args             = wp_parse_args( $args, $defaults );
		$where_conditions = array();

		if ( $args['status'] ) {
			$where_conditions[] = $wpdb->prepare( 'status = %s', $args['status'] );
		}

		if ( $args['search'] ) {
			$search_term        = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where_conditions[] = $wpdb->prepare( 'title LIKE %s', $search_term );
		}

		$where = empty( $where_conditions ) ? '' : ' WHERE ' . implode( ' AND ', $where_conditions );

		// Validate orderby
		$allowed_orderby = array( 'id', 'title', 'status', 'created_at', 'updated_at' );
		$orderby         = in_array( $args['orderby'], $allowed_orderby ) ? $args['orderby'] : 'created_at';
		$order           = strtoupper( $args['order'] ) === 'ASC' ? 'ASC' : 'DESC';

		// Phase B3: Only fetch needed columns for list views (skip large config JSON)
		$sql = sprintf(
			"SELECT id, title, status, created_at, updated_at FROM {$this->table}%s ORDER BY %s %s LIMIT %d OFFSET %d",
			$where,
			esc_sql( $orderby ),
			esc_sql( $order ),
			intval( $args['limit'] ),
			intval( $args['offset'] )
		);

		$results = $wpdb->get_results( $sql, ARRAY_A );

		// No JSON decoding needed - config not fetched

		\SubtleForms\Support\QueryInstrumentation::end( $start, __METHOD__, $sql );

		return $results;
	}

	/**
	 * Count forms based on criteria.
	 */
	public function count( array $args = array() ): int {
		global $wpdb;

		$where_conditions = array();

		if ( ! empty( $args['status'] ) ) {
			$where_conditions[] = $wpdb->prepare( 'status = %s', $args['status'] );
		}

		if ( ! empty( $args['search'] ) ) {
			$search_term        = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where_conditions[] = $wpdb->prepare( 'title LIKE %s', $search_term );
		}

		$where = empty( $where_conditions ) ? '' : ' WHERE ' . implode( ' AND ', $where_conditions );

		$sql = "SELECT COUNT(*) FROM {$this->table}{$where}";

		return (int) $wpdb->get_var( $sql );
	}

	/**
	 * Find multiple forms by IDs in a single query (v1.8.2).
	 * Returns a map of form_id => form data.
	 * Only fetches id and title columns for performance.
	 */
	public function findMultiple( array $ids ): array {
		global $wpdb;

		if ( empty( $ids ) ) {
			return array();
		}

		// Sanitize IDs
		$ids = array_map( 'intval', $ids );
		$ids = array_filter( $ids );

		if ( empty( $ids ) ) {
			return array();
		}

		$placeholders = implode( ', ', array_fill( 0, count( $ids ), '%d' ) );

		// Only fetch id and title for list views
		$sql = "SELECT id, title FROM {$this->table} WHERE id IN ($placeholders)";

		$results = $wpdb->get_results( $wpdb->prepare( $sql, ...$ids ), ARRAY_A );

		// Return as map: form_id => form
		$map = array();
		foreach ( $results as $form ) {
			$map[ $form['id'] ] = $form;
		}

		return $map;
	}

	/**
	 * Create a new form.
	 */
	public function create( array $data ): int {
		global $wpdb;

		$defaults = array(
			'title'  => '',
			'config' => array(),
			'status' => 'draft',
			'schema' => null,
		);

		$data = wp_parse_args( $data, $defaults );

		// Inject default schema if missing or empty
		if (empty($data['schema']) || !is_array($data['schema']) || empty($data['schema']['fields'])) {
			$data['schema'] = array(
				'metadata' => array(
					'type' => 'regular',
					'name' => $data['title'] ?: 'Untitled Form',
				),
				'schema_version' => 1,
				'fields' => array(
					array(
						'type' => 'text',
						'name' => 'field_1',
						'label' => 'Text',
						'required' => false,
						'placeholder' => '',
						'options' => array(),
						'defaultValue' => '',
						'validation' => array(),
						'attributes' => array(),
					),
				),
			);
		}

		$wpdb->insert(
			$this->table,
			array(
				'title'  => Helpers::safe_sanitize_text( Helpers::safe_string_get( $data, 'title' ) ),
				'config' => wp_json_encode( $data['config'] ),
				'status' => $data['status'],
			),
			array( '%s', '%s', '%s' )
		);

		return $wpdb->insert_id;
	}

	/**
	 * Save a new schema version for a form.
	 *
	 * @return int Version number saved
	 * @throws \InvalidArgumentException If schema validation fails
	 * @throws \RuntimeException If database operation fails
	 */
	public function saveSchemaVersion( int $formId, array $schema, bool $activate = false ): int {
		// Ensure schema_version exists, default to 1 if not present
		if ( ! isset( $schema['schema_version'] ) ) {
			$schema['schema_version'] = 1;
		}

		// Ensure metadata and metadata.name exist with a safe default
		if ( ! isset( $schema['metadata'] ) || ! is_array( $schema['metadata'] ) ) {
			$schema['metadata'] = array();
		}
		if ( empty( $schema['metadata']['name'] ) || ! is_string( $schema['metadata']['name'] ) ) {
			$schema['metadata']['name'] = 'form_schema';
			error_log( sprintf( 'SubtleForms: Injected default metadata.name="%s" for form %d in saveSchemaVersion', $schema['metadata']['name'], $formId ) );
		}

		// Ensure fields array exists (allow empty drafts)
		if ( ! isset( $schema['fields'] ) || ! is_array( $schema['fields'] ) ) {
			$schema['fields'] = array();
			error_log( sprintf( 'SubtleForms: Injected default empty fields array for form %d in saveSchemaVersion', $formId ) );
		}

		// Validate schema before saving
		$validator = new \SubtleForms\Support\SchemaValidator();
		try {
			$validator->validate( $schema );
		} catch ( \InvalidArgumentException $e ) {
			throw $e;
		}

		global $wpdb;

		// Determine next version
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery -- Table name is safe. Direct query needed for versioning.
		$max = (int) $wpdb->get_var( $wpdb->prepare( "SELECT MAX(version) FROM {$this->schemas_table} WHERE form_id = %d", $formId ) );

		if ( $wpdb->last_error ) {
			$error = sprintf(
				'Database error determining next schema version for form %d: %s',
				$formId,
				$wpdb->last_error
			);
			error_log( 'SubtleForms: ' . $error );
			throw new \RuntimeException( $error );
		}

		$next = $max ? $max + 1 : 1;

		// Development: Uncomment to debug schema versioning
		// if ($activate) {
		// error_log(sprintf(
		// 'SubtleForms: Activating schema version %d for form %d',
		// $next,
		// $formId
		// ));
		// }

		$inserted = $wpdb->insert(
			$this->schemas_table,
			array(
				'form_id'     => $formId,
				'version'     => $next,
				'schema_data' => wp_json_encode( $schema ),
				'active'      => $activate ? 1 : 0,
			),
			array( '%d', '%d', '%s', '%d' )
		);

		if ( $inserted === false || $wpdb->last_error ) {
			$error = sprintf(
				'Failed to save schema version %d for form %d: %s',
				$next,
				$formId,
				$wpdb->last_error ?: 'Unknown database error'
			);
			error_log( 'SubtleForms: ' . $error );
			throw new \RuntimeException( $error );
		}

		// If activating, mark others inactive and update forms table
		if ( $activate ) {
			try {
				$this->setActiveSchemaVersion( $formId, $next );
			} catch ( \RuntimeException $e ) {
				// Log but don't fail - the schema was saved successfully
				error_log( 'SubtleForms: Failed to activate schema version ' . $next . ': ' . $e->getMessage() );
			}
		}

		return $next;
	}

	/**
	 * Load a specific schema version or the active one when version is null.
	 * If no active version exists, returns the latest version as a fallback.
	 *
	 * @throws \RuntimeException If database query fails or schema data is corrupt
	 */
	public function loadSchemaVersion( int $formId, ?int $version = null ): ?array {
		global $wpdb;

		if ( $version === null ) {
			// Try to get active version first
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->schemas_table} WHERE form_id = %d AND active = 1 ORDER BY version DESC LIMIT 1", $formId ), ARRAY_A );

			// If no active version, fall back to the latest version
			if ( ! $row && ! $wpdb->last_error ) {
				error_log( "SubtleForms: No active schema found for form {$formId}, using latest version as fallback" );
				$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->schemas_table} WHERE form_id = %d ORDER BY version DESC LIMIT 1", $formId ), ARRAY_A );
			}
		} else {
			$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->schemas_table} WHERE form_id = %d AND version = %d", $formId, $version ), ARRAY_A );
		}

		// Check for database errors
		if ( $wpdb->last_error ) {
			$error = sprintf(
				'Database error loading schema for form %d: %s',
				$formId,
				$wpdb->last_error
			);
			error_log( 'SubtleForms: ' . $error );
			throw new \RuntimeException( $error );
		}

		if ( ! $row ) {
			return null;
		}

		// Validate schema_data exists
		if ( ! isset( $row['schema_data'] ) ) {
			$error = sprintf(
				'Schema data column missing for form %d version %d. Database schema may be outdated.',
				$formId,
				$row['version'] ?? 'unknown'
			);
			error_log( 'SubtleForms: ' . $error );
			throw new \RuntimeException( $error );
		}

		// Decode and validate JSON
		$decodedSchema = Helpers::safe_json_decode( Helpers::safe_array_get( $row, 'schema_data', '{}' ), true, null );
		if ( $decodedSchema === null ) {
			$error = sprintf(
				'Failed to decode schema JSON for form %d version %d: %s',
				$formId,
				Helpers::safe_array_get( $row, 'version', 0 ),
				json_last_error_msg()
			);
			error_log( 'SubtleForms: ' . $error );
			throw new \RuntimeException( $error );
		}

		// Ensure schema_version exists in decoded schema, default to 1 for legacy schemas
		if ( ! isset( $decodedSchema['schema_version'] ) ) {
			$decodedSchema['schema_version'] = 1;
		}

		// Run migrations
		$migrator      = new \SubtleForms\Support\SchemaMigrator();
		$decodedSchema = $migrator->migrate( $decodedSchema );

		return array(
			'version'    => (int) $row['version'],
			'schema'     => $decodedSchema,
			'created_at' => $row['created_at'],
			'active'     => (bool) $row['active'],
		);
	}

	/**
	 * Mark a given schema version active for a form.
	 *
	 * @throws \RuntimeException If database operations fail
	 */
	public function setActiveSchemaVersion( int $formId, int $version ): bool {
		global $wpdb;

		// Unset other active flags
		$wpdb->update( $this->schemas_table, array( 'active' => 0 ), array( 'form_id' => $formId ), array( '%d' ), array( '%d' ) );

		if ( $wpdb->last_error ) {
			$error = sprintf(
				'Failed to deactivate other schema versions for form %d: %s',
				$formId,
				$wpdb->last_error
			);
			error_log( 'SubtleForms: ' . $error );
			throw new \RuntimeException( $error );
		}

		// Set requested version active
		$updated = $wpdb->update(
			$this->schemas_table,
			array( 'active' => 1 ),
			array(
				'form_id' => $formId,
				'version' => $version,
			),
			array( '%d' ),
			array( '%d', '%d' )
		);

		if ( $updated === false || $wpdb->last_error ) {
			$error = sprintf(
				'Failed to activate schema version %d for form %d: %s',
				$version,
				$formId,
				$wpdb->last_error ?: 'Version may not exist'
			);
			error_log( 'SubtleForms: ' . $error );
			throw new \RuntimeException( $error );
		}

		// Update forms table config and active_version to keep in sync
		$schemaRow = $wpdb->get_row( $wpdb->prepare( "SELECT schema_data FROM {$this->schemas_table} WHERE form_id = %d AND version = %d", $formId, $version ), ARRAY_A );

		if ( $wpdb->last_error ) {
			$error = sprintf(
				'Failed to fetch schema data for form %d version %d: %s',
				$formId,
				$version,
				$wpdb->last_error
			);
			error_log( 'SubtleForms: ' . $error );
			throw new \RuntimeException( $error );
		}

		if ( $schemaRow ) {
			$result = $wpdb->update(
				$this->table,
				array(
					'config'         => $schemaRow['schema_data'],
					'active_version' => $version,
				),
				array( 'id' => $formId ),
				array( '%s', '%d' ),
				array( '%d' )
			);

			if ( $result === false && $wpdb->last_error ) {
				$error = sprintf(
					'Failed to update forms table for form %d: %s',
					$formId,
					$wpdb->last_error
				);
				error_log( 'SubtleForms: ' . $error );
				// Don't throw - schema is already activated, this is just sync
			}
		}

		return $updated !== false;
	}

	/**
	 * Get list of schema versions for a form.
	 */
	public function getSchemaVersions( int $formId ): array {
		global $wpdb;

		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT version, active, created_at FROM {$this->schemas_table} WHERE form_id = %d ORDER BY version DESC", $formId ), ARRAY_A );
		return array_map(
			function ( $r ) {
				return array(
					'version'    => (int) $r['version'],
					'active'     => (bool) $r['active'],
					'created_at' => $r['created_at'],
				);
			},
			$rows ?: array()
		);
	}

	/**
	 * Update a form.
	 */
	public function update( int $id, array $data ): bool {
		global $wpdb;

		$update_data = array();
		$format      = array();

		if ( isset( $data['title'] ) ) {
			$update_data['title'] = Helpers::safe_sanitize_text( $data['title'] );
			$format[]             = '%s';
		}

		if ( isset( $data['config'] ) ) {
			$update_data['config'] = wp_json_encode( $data['config'] );
			$format[]              = '%s';
		}

		if ( isset( $data['status'] ) ) {
			$update_data['status'] = $data['status'];
			$format[]              = '%s';
		}

		if ( empty( $update_data ) ) {
			return false;
		}

		$result = $wpdb->update(
			$this->table,
			$update_data,
			array( 'id' => $id ),
			$format,
			array( '%d' )
		);

		return $result !== false;
	}

	/**
	 * Delete a form.
	 */
	public function delete( int $id ): bool {
		global $wpdb;
		$result = $wpdb->delete( $this->table, array( 'id' => $id ), array( '%d' ) );
		return $result !== false;
	}

	/**
	 * Save draft schema (non-versioned, unpublished).
	 *
	 * Draft schemas are stored directly in the forms table and do NOT create versions.
	 * This is used for autosave and any edits that haven't been published yet.
	 *
	 * @param int   $formId Form ID
	 * @param array $schema Schema data
	 * @return bool Success status
	 * @throws \InvalidArgumentException If schema validation fails
	 */
	public function saveDraftSchema( int $formId, array $schema ): bool {
		// Validate schema before saving
		$validator = new \SubtleForms\Support\SchemaValidator();
		try {
			$validator->validate( $schema );
		} catch ( \InvalidArgumentException $e ) {
			throw $e;
		}

		global $wpdb;

		$result = $wpdb->update(
			$this->table,
			array( 'draft_schema' => wp_json_encode( $schema ) ),
			array( 'id' => $formId ),
			array( '%s' ),
			array( '%d' )
		);

		if ( $result === false ) {
			error_log(
				sprintf(
					'SubtleForms: Failed to save draft schema for form %d: %s',
					$formId,
					$wpdb->last_error
				)
			);
			return false;
		}

		return true;
	}

	/**
	 * Get draft schema for a form.
	 *
	 * @param int $formId Form ID
	 * @return array|null Draft schema or null if none exists
	 */
	public function getDraftSchema( int $formId ): ?array {
		global $wpdb;

		$draft = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT draft_schema FROM {$this->table} WHERE id = %d",
				$formId
			)
		);

		if ( ! $draft ) {
			return null;
		}

		$decoded = json_decode( $draft, true );
		return is_array( $decoded ) ? $decoded : null;
	}

	/**
	 * Promote draft schema to active version.
	 *
	 * This creates a new versioned schema from the current draft and activates it.
	 * Used when publishing a form or manually saving with activation.
	 *
	 * @param int $formId Form ID
	 * @return int New version number
	 * @throws \InvalidArgumentException If draft schema is invalid
	 * @throws \RuntimeException If no draft schema exists or save fails
	 */
	public function promoteDraftToActive( int $formId ): int {
		$draftSchema = $this->getDraftSchema( $formId );

		if ( ! $draftSchema ) {
			throw new \RuntimeException( 'No draft schema to promote' );
		}

		// Create versioned schema and activate it
		$version = $this->saveSchemaVersion( $formId, $draftSchema, true );

		// Development: Uncomment to debug schema promotion
		// error_log(sprintf(
		// 'SubtleForms: Promoted draft schema to version %d for form %d',
		// $version,
		// $formId
		// ));

		return $version;
	}
}
