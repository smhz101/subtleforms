<?php
/**
 * SubtleForms Submissions Repository
 *
 * @package   SubtleForms\Repositories
 * @version   0.1.0
 */

namespace SubtleForms\Repositories;

/**
 * Repository for managing form submissions.
 */
final class SubmissionsRepository
{
    private string $table;

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
        $result['payload'] = json_decode($result['payload'], true);
        $result['meta'] = json_decode($result['meta'], true);

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
            $result['payload'] = json_decode($result['payload'], true);
            $result['meta'] = json_decode($result['meta'], true);
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
            'form_version' => null,
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
                'form_id' => intval($data['form_id']),
                'form_version' => isset($data['form_version']) ? intval($data['form_version']) : null,
                'payload' => wp_json_encode($data['payload']),
                'meta' => wp_json_encode($data['meta']),
                'status' => $data['status'],
                'ip_address' => $data['ip_address'],
                'user_agent' => $data['user_agent'],
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
            $result['payload'] = json_decode($result['payload'], true);
            $result['meta'] = json_decode($result['meta'], true);
        }

        return $results;
    }

    /**
     * Count submissions.
     */
    public function count(int $formId = null, array $args = []): int
    {
        global $wpdb;

        $where = '';
        if ($formId) {
            $where = $wpdb->prepare(' WHERE form_id = %d', $formId);
        }

        if (!empty($args['status'])) {
            $operator = $formId ? ' AND' : ' WHERE';
            $where .= $wpdb->prepare("{$operator} status = %s", $args['status']);
        }

        return (int) $wpdb->get_var("SELECT COUNT(*) FROM {$this->table}{$where}");
    }

    /**
     * Get next/previous submission IDs (v0.9.4).
     */
    public function getAdjacentIds(int $currentId, int $formId = null): array
    {
        global $wpdb;

        $where = $formId ? $wpdb->prepare(' WHERE form_id = %d', $formId) : '';

        $next = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$this->table}{$where} AND id > %d ORDER BY id ASC LIMIT 1",
            $currentId
        ));

        $prev = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$this->table}{$where} AND id < %d ORDER BY id DESC LIMIT 1",
            $currentId
        ));

        return [
            'next' => $next ? intval($next) : null,
            'prev' => $prev ? intval($prev) : null,
        ];
    }
}

