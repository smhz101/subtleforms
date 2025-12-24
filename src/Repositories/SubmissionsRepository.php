<?php
/**
 * SubtleForms Submissions Repository
 *
 * @package   SubtleForms\Repositories
 * @version   0.1.0
 */

namespace SubtleForms\Repositories;

use SubtleForms\Support\Helpers;

/**
 * Repository for managing form submissions.
 */
final class SubmissionsRepository
{
    /**
     * @var string
     */
    private $table;

    public function __construct()
    {
        global $wpdb;
        $this->table = $wpdb->prefix . 'subtleforms_submissions';
    }

    /**
     * Get a submission by ID.
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

        // Decode JSON fields
        $result['payload'] = Helpers::safe_json_decode(Helpers::safe_array_get($result, 'payload', '{}'), true, []);
        $result['meta'] = Helpers::safe_json_decode(Helpers::safe_array_get($result, 'meta', '{}'), true, []);

        return $result;
    }

    /**
     * Get submissions for a form.
     */
    public function findByForm(int $formId, array $args = []): array
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

        $where = $wpdb->prepare('WHERE form_id = %d', $formId);

        if ($args['status']) {
            $where .= $wpdb->prepare(' AND status = %s', $args['status']);
        }

        $sql = sprintf(
            "SELECT * FROM {$this->table} %s ORDER BY %s %s LIMIT %d OFFSET %d",
            $where,
            esc_sql($args['orderby']),
            esc_sql($args['order']),
            intval($args['limit']),
            intval($args['offset'])
        );

        $results = $wpdb->get_results($sql, ARRAY_A);

        // Decode JSON fields
        foreach ($results as &$result) {
            $result['payload'] = Helpers::safe_json_decode(Helpers::safe_array_get($result, 'payload', '{}'), true, []);
            $result['meta'] = Helpers::safe_json_decode(Helpers::safe_array_get($result, 'meta', '{}'), true, []);
        }

        return $results;
    }

    /**
     * Create a new submission.
     * 
     * @throws \RuntimeException If database insert fails
     */
    public function create(array $data): int
    {
        global $wpdb;

        $defaults = [
            'form_id' => 0,
            'schema_version' => null,
            'payload' => [],
            'meta' => [],
            'status' => 'unread',
            'ip_address' => null,
            'user_agent' => null,
        ];

        $data = wp_parse_args($data, $defaults);

        $inserted = $wpdb->insert(
            $this->table,
            [
                'form_id' => intval(Helpers::safe_array_get($data, 'form_id', 0)),
                'schema_version' => isset($data['schema_version']) ? intval($data['schema_version']) : null,
                'payload' => wp_json_encode(Helpers::safe_array_get($data, 'payload', [])),
                'meta' => wp_json_encode(Helpers::safe_array_get($data, 'meta', [])),
                'status' => Helpers::safe_array_get($data, 'status', 'unread'),
                'ip_address' => Helpers::safe_array_get($data, 'ip_address', ''),
                'user_agent' => Helpers::safe_array_get($data, 'user_agent', ''),
            ],
            ['%d', '%d', '%s', '%s', '%s', '%s', '%s']
        );

        if ($inserted === false || $wpdb->last_error) {
            $error = sprintf(
                'Failed to create submission for form %d: %s',
                $data['form_id'],
                $wpdb->last_error ?: 'Unknown database error'
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        $submissionId = $wpdb->insert_id;
        if (!$submissionId) {
            $error = 'Failed to get submission ID after insert';
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        return $submissionId;
    }

    /**
     * Update a submission.
     * 
     * @throws \RuntimeException If database update fails
     */
    public function update(int $id, array $data): bool
    {
        global $wpdb;

        $update_data = [];
        $format = [];

        if (isset($data['payload'])) {
            $update_data['payload'] = wp_json_encode($data['payload']);
            $format[] = '%s';
        }

        if (isset($data['meta'])) {
            $update_data['meta'] = wp_json_encode($data['meta']);
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

        // Check for database errors
        if ($wpdb->last_error) {
            $error = sprintf(
                'Database error updating submission %d: %s',
                $id,
                $wpdb->last_error
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        // $result can be 0 if no rows were changed (but query succeeded)
        // Only fail if $result is false (query error)
        if ($result === false) {
            $error = sprintf(
                'Failed to update submission %d - submission may not exist',
                $id
            );
            error_log('SubtleForms: ' . $error);
            throw new \RuntimeException($error);
        }

        return true;
    }

    /**
     * Delete a submission.
     */
    public function delete(int $id): bool
    {
        global $wpdb;
        $result = $wpdb->delete($this->table, ['id' => $id], ['%d']);
        return $result !== false;
    }

    /**
     * Get submissions with advanced filtering (v0.9.4).
     */
    public function findAll(array $args = []): array
    {
        global $wpdb;

        $defaults = [
            'form_id' => null,
            'status' => null,
            'search' => null,
            'limit' => 20,
            'offset' => 0,
            'orderby' => 'created_at',
            'order' => 'DESC',
        ];

        $args = wp_parse_args($args, $defaults);

        $where = [];
        $params = [];

        if ($args['form_id']) {
            $where[] = 'form_id = %d';
            $params[] = intval($args['form_id']);
        }

        if ($args['status'] && $args['status'] !== 'all') {
            $where[] = 'status = %s';
            $params[] = $args['status'];
        }

        if ($args['search']) {
            $searchTerm = '%' . $wpdb->esc_like($args['search']) . '%';
            $where[] = '(id LIKE %s OR payload LIKE %s OR meta LIKE %s)';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $sql = sprintf(
            "SELECT * FROM {$this->table} %s ORDER BY %s %s LIMIT %%d OFFSET %%d",
            $whereClause,
            esc_sql($args['orderby']),
            esc_sql($args['order'])
        );

        $params[] = intval($args['limit']);
        $params[] = intval($args['offset']);

        $results = $wpdb->get_results($wpdb->prepare($sql, ...$params), ARRAY_A);

        // Decode JSON fields
        foreach ($results as &$result) {
            $result['payload'] = Helpers::safe_json_decode(Helpers::safe_array_get($result, 'payload', '{}'), true, []);
            $result['meta'] = Helpers::safe_json_decode(Helpers::safe_array_get($result, 'meta', '{}'), true, []);
        }

        return $results;
    }

    /**
     * Count submissions.
     */
    public function count(array $args = []): int
    {
        global $wpdb;

        $defaults = [
            'form_id' => null,
            'status' => null,
            'search' => null,
        ];

        $args = wp_parse_args($args, $defaults);

        $where = [];
        $params = [];

        if ($args['form_id']) {
            $where[] = 'form_id = %d';
            $params[] = intval($args['form_id']);
        }

        if ($args['status'] && $args['status'] !== 'all') {
            $where[] = 'status = %s';
            $params[] = $args['status'];
        }

        if ($args['search']) {
            $searchTerm = '%' . $wpdb->esc_like($args['search']) . '%';
            $where[] = '(id LIKE %s OR payload LIKE %s OR meta LIKE %s)';
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $sql = "SELECT COUNT(*) FROM {$this->table} {$whereClause}";

        if (!empty($params)) {
            return (int) $wpdb->get_var($wpdb->prepare($sql, ...$params));
        }

        return (int) $wpdb->get_var($sql);
    }

    /**
     * Get next/previous submission IDs (v0.9.4).
     */
    public function getAdjacentIds(int $currentId, int $formId = null): array
    {
        global $wpdb;

        $conditions = [];
        $params = [];

        if ($formId) {
            $conditions[] = 'form_id = %d';
            $params[] = $formId;
        }

        // For Next
        $nextConditions = $conditions;
        $nextConditions[] = 'id > %d';
        $nextParams = $params;
        $nextParams[] = $currentId;
        
        $whereNext = 'WHERE ' . implode(' AND ', $nextConditions);
        
        $next = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$this->table} {$whereNext} ORDER BY id ASC LIMIT 1",
            ...$nextParams
        ));

        // For Prev
        $prevConditions = $conditions;
        $prevConditions[] = 'id < %d';
        $prevParams = $params;
        $prevParams[] = $currentId;

        $wherePrev = 'WHERE ' . implode(' AND ', $prevConditions);

        $prev = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$this->table} {$wherePrev} ORDER BY id DESC LIMIT 1",
            ...$prevParams
        ));

        return [
            'next' => $next ? intval($next) : null,
            'prev' => $prev ? intval($prev) : null,
        ];
    }
}

