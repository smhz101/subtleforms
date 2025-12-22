<?php
/**
 * SubtleForms Forms Repository
 *
 * @package   SubtleForms\Repositories
 * @version   0.1.0
 */

namespace SubtleForms\Repositories;

/**
 * Repository for managing forms.
 */
final class FormsRepository
{
    private string $table;
    private string $schemas_table;

    public function __construct()
    {
        global $wpdb;
        $this->table = $wpdb->prefix . 'subtleforms_forms';
        $this->schemas_table = $wpdb->prefix . 'subtleforms_form_schemas';
        
        // Verify tables exist on first instantiation
        $this->ensureTablesExist();
    }

    /**
     * Verify required database tables exist.
     * 
     * @throws \RuntimeException If tables are missing
     */
    private function ensureTablesExist(): void
    {
        global $wpdb;
        
        $forms_exists = $wpdb->get_var("SHOW TABLES LIKE '{$this->table}'");
        $schemas_exists = $wpdb->get_var("SHOW TABLES LIKE '{$this->schemas_table}'");
        
        $missing = [];
        if ($forms_exists !== $this->table) {
            $missing[] = $this->table;
        }
        if ($schemas_exists !== $this->schemas_table) {
            $missing[] = $this->schemas_table;
        }
        
        if (!empty($missing)) {
            $error = sprintf(
                'SubtleForms database tables are missing: %s. Please deactivate and reactivate the plugin to create them.',
                implode(', ', $missing)
            );
            error_log('SubtleForms Repository Error: ' . $error);
            throw new \RuntimeException($error);
        }
    }

    /**
     * Get a form by ID.
     */
    public function find(int $id): ?array
    {
        global $wpdb;
        $result = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->table} WHERE id = %d", $id),
            ARRAY_A
        );

        if (!$result) {
            return null;
        }

        // Decode JSON config
        $result['config'] = json_decode($result['config'], true);
        return $result;
    }

    /**
     * Get all forms.
     */
    public function all(array $args = []): array
    {
        global $wpdb;

        $defaults = [
            'status' => null,
            'limit' => 20,
            'offset' => 0,
            'orderby' => 'created_at',
            'order' => 'DESC',
        ];

        $args = wp_parse_args($args, $defaults);
        $where = '';

        if ($args['status']) {
            $where = $wpdb->prepare(' WHERE status = %s', $args['status']);
        }

        $sql = sprintf(
            "SELECT * FROM {$this->table}%s ORDER BY %s %s LIMIT %d OFFSET %d",
            $where,
            esc_sql($args['orderby']),
            esc_sql($args['order']),
            intval($args['limit']),
            intval($args['offset'])
        );

        $results = $wpdb->get_results($sql, ARRAY_A);

        // Decode JSON config for each form
        foreach ($results as &$result) {
            $result['config'] = json_decode($result['config'], true);
        }

        return $results;
    }

    /**
     * Create a new form.
     */
    public function create(array $data): int
    {
        global $wpdb;

        $defaults = [
            'title' => '',
            'config' => [],
            'status' => 'draft',
        ];

        $data = wp_parse_args($data, $defaults);

        $wpdb->insert(
            $this->table,
            [
                'title' => sanitize_text_field($data['title']),
                'config' => wp_json_encode($data['config']),
                'status' => $data['status'],
            ],
            ['%s', '%s', '%s']
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
    public function saveSchemaVersion(int $formId, array $schema, bool $activate = false): int
    {
        // Validate schema before saving
        $validator = new \SubtleForms\Support\SchemaValidator();
        try {
            $validator->validate($schema);
        } catch (\InvalidArgumentException $e) {
            throw $e;
        }

        global $wpdb;

        // Determine next version
        $max = (int) $wpdb->get_var($wpdb->prepare("SELECT MAX(version) FROM {$this->schemas_table} WHERE form_id = %d", $formId));
        
        if ($wpdb->last_error) {
            $error = sprintf(
                'Database error determining next schema version for form %d: %s',
                $formId,
                $wpdb->last_error
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }
        
        $next = $max ? $max + 1 : 1;

        $inserted = $wpdb->insert(
            $this->schemas_table,
            [
                'form_id' => $formId,
                'version' => $next,
                'schema_data' => wp_json_encode($schema),
                'active' => $activate ? 1 : 0,
            ],
            ['%d', '%d', '%s', '%d']
        );

        if ($inserted === false || $wpdb->last_error) {
            $error = sprintf(
                'Failed to save schema version %d for form %d: %s',
                $next,
                $formId,
                $wpdb->last_error ?: 'Unknown database error'
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        // If activating, mark others inactive and update forms table
        if ($activate) {
            try {
                $this->setActiveSchemaVersion($formId, $next);
            } catch (\RuntimeException $e) {
                // Log but don't fail - the schema was saved successfully
                error_log('SubtleForms: Failed to activate schema version ' . $next . ': ' . $e->getMessage());
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
    public function loadSchemaVersion(int $formId, ?int $version = null): ?array
    {
        global $wpdb;

        if ($version === null) {
            // Try to get active version first
            $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->schemas_table} WHERE form_id = %d AND active = 1 ORDER BY version DESC LIMIT 1", $formId), ARRAY_A);
            
            // If no active version, fall back to the latest version
            if (!$row && !$wpdb->last_error) {
                error_log("SubtleForms: No active schema found for form {$formId}, using latest version as fallback");
                $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->schemas_table} WHERE form_id = %d ORDER BY version DESC LIMIT 1", $formId), ARRAY_A);
            }
        } else {
            $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->schemas_table} WHERE form_id = %d AND version = %d", $formId, $version), ARRAY_A);
        }

        // Check for database errors
        if ($wpdb->last_error) {
            $error = sprintf(
                'Database error loading schema for form %d: %s',
                $formId,
                $wpdb->last_error
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        if (!$row) {
            return null;
        }

        // Validate schema_data exists
        if (!isset($row['schema_data'])) {
            $error = sprintf(
                'Schema data column missing for form %d version %d. Database schema may be outdated.',
                $formId,
                $row['version'] ?? 'unknown'
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        // Decode and validate JSON
        $decodedSchema = json_decode($row['schema_data'], true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $error = sprintf(
                'Failed to decode schema JSON for form %d version %d: %s',
                $formId,
                $row['version'],
                json_last_error_msg()
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        return [
            'version' => (int) $row['version'],
            'schema' => $decodedSchema,
            'created_at' => $row['created_at'],
            'active' => (bool) $row['active'],
        ];
    }

    /**
     * Mark a given schema version active for a form.
     * 
     * @throws \RuntimeException If database operations fail
     */
    public function setActiveSchemaVersion(int $formId, int $version): bool
    {
        global $wpdb;

        // Unset other active flags
        $wpdb->update($this->schemas_table, ['active' => 0], ['form_id' => $formId], ['%d'], ['%d']);

        if ($wpdb->last_error) {
            $error = sprintf(
                'Failed to deactivate other schema versions for form %d: %s',
                $formId,
                $wpdb->last_error
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        // Set requested version active
        $updated = $wpdb->update($this->schemas_table, ['active' => 1], ['form_id' => $formId, 'version' => $version], ['%d'], ['%d', '%d']);

        if ($updated === false || $wpdb->last_error) {
            $error = sprintf(
                'Failed to activate schema version %d for form %d: %s',
                $version,
                $formId,
                $wpdb->last_error ?: 'Version may not exist'
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        // Update forms table config and active_version to keep in sync
        $schemaRow = $wpdb->get_row($wpdb->prepare("SELECT schema_data FROM {$this->schemas_table} WHERE form_id = %d AND version = %d", $formId, $version), ARRAY_A);
        
        if ($wpdb->last_error) {
            $error = sprintf(
                'Failed to fetch schema data for form %d version %d: %s',
                $formId,
                $version,
                $wpdb->last_error
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }
        
        if ($schemaRow) {
            $result = $wpdb->update($this->table, [
                'config' => $schemaRow['schema_data'],
                'active_version' => $version,
            ], ['id' => $formId], ['%s', '%d'], ['%d']);
            
            if ($result === false && $wpdb->last_error) {
                $error = sprintf(
                    'Failed to update forms table for form %d: %s',
                    $formId,
                    $wpdb->last_error
                );
                error_log('SubtleForms: ' . $error);
                // Don't throw - schema is already activated, this is just sync
            }
        }

        return $updated !== false;
    }

    /**
     * Get list of schema versions for a form.
     */
    public function getSchemaVersions(int $formId): array
    {
        global $wpdb;

        $rows = $wpdb->get_results($wpdb->prepare("SELECT version, active, created_at FROM {$this->schemas_table} WHERE form_id = %d ORDER BY version DESC", $formId), ARRAY_A);
        return array_map(function($r) {
            return [
                'version' => (int) $r['version'],
                'active' => (bool) $r['active'],
                'created_at' => $r['created_at'],
            ];
        }, $rows ?: []);
    }

    /**
     * Update a form.
     */
    public function update(int $id, array $data): bool
    {
        global $wpdb;

        $update_data = [];
        $format = [];

        if (isset($data['title'])) {
            $update_data['title'] = sanitize_text_field($data['title']);
            $format[] = '%s';
        }

        if (isset($data['config'])) {
            $update_data['config'] = wp_json_encode($data['config']);
            $format[] = '%s';
        }

        if (isset($data['status'])) {
            $update_data['status'] = $data['status'];
            $format[] = '%s';
        }

        if (empty($update_data)) {
            return false;
        }

        $result = $wpdb->update(
            $this->table,
            $update_data,
            ['id' => $id],
            $format,
            ['%d']
        );

        return $result !== false;
    }

    /**
     * Delete a form.
     */
    public function delete(int $id): bool
    {
        global $wpdb;
        $result = $wpdb->delete($this->table, ['id' => $id], ['%d']);
        return $result !== false;
    }

    /**
     * Count forms.
     */
    public function count(array $args = []): int
    {
        global $wpdb;

        $where = '';
        if (!empty($args['status'])) {
            $where = $wpdb->prepare(' WHERE status = %s', $args['status']);
        }

        return (int) $wpdb->get_var("SELECT COUNT(*) FROM {$this->table}{$where}");
    }
}
