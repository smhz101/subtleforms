<?php
/**
 * SubtleForms Submissions Repository
 *
 * @package   SubtleForms\Repositories
 * @version   0.1.0
 */

namespace SubtleForms\Repositories;

if ( ! defined( 'ABSPATH' ) ) { exit; }

use SubtleForms\Support\Helpers;

use SubtleForms\Support\Logger;
/**
 * Repository for managing form submissions.
 */
final class SubmissionsRepository {

	/**
	 * @var string
	 */
	private $table;

	public function __construct() {
		global $wpdb;
		$this->table = $wpdb->prefix . 'subtleforms_submissions';
	}

	/**
	 * Get a submission by ID.
	 */
	public function find( int $id ): ?array {
		global $wpdb;
		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is $wpdb->prefix controlled.
		$result = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->table} WHERE id = %d", $id ),
			ARRAY_A
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		if ( ! $result ) {
			return null;
		}

		// Decode JSON fields
		$result['payload'] = Helpers::safe_json_decode( Helpers::safe_array_get( $result, 'payload', '{}' ), true, array() );
		$result['meta']    = Helpers::safe_json_decode( Helpers::safe_array_get( $result, 'meta', '{}' ), true, array() );

		return $result;
	}

	/**
	 * Get submissions for a form.
	 */
	public function findByForm( int $formId, array $args = array() ): array {
		global $wpdb;

		$defaults = array(
			'status'  => null,
			'limit'   => 20,
			'offset'  => 0,
			'orderby' => 'created_at',
			'order'   => 'DESC',
		);

		$args = wp_parse_args( $args, $defaults );

		$where  = array( 'form_id = %d' );
		$params = array( $formId );

		if ( $args['status'] ) {
			$where[]  = 'status = %s';
			$params[] = $args['status'];
		}

		$where_clause = 'WHERE ' . implode( ' AND ', $where );

		// Validate orderby (whitelist — safe to interpolate)
		$allowed_orderby = array( 'id', 'form_id', 'status', 'created_at' );
		$orderby         = in_array( $args['orderby'], $allowed_orderby, true ) ? $args['orderby'] : 'created_at';
		$order           = strtoupper( $args['order'] ) === 'ASC' ? 'ASC' : 'DESC';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name, orderby and order are whitelisted.
		$sql = "SELECT * FROM {$this->table} {$where_clause} ORDER BY {$orderby} {$order} LIMIT %d OFFSET %d";

		$params[] = intval( $args['limit'] );
		$params[] = intval( $args['offset'] );

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $sql is built from whitelisted table name and safe params, passed through prepare().
		$results = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );

		// Decode JSON fields
		foreach ( $results as &$result ) {
			$result['payload'] = Helpers::safe_json_decode( Helpers::safe_array_get( $result, 'payload', '{}' ), true, array() );
			$result['meta']    = Helpers::safe_json_decode( Helpers::safe_array_get( $result, 'meta', '{}' ), true, array() );
		}

		return $results;
	}

	/**
	 * Create a new submission.
	 *
	 * @throws \RuntimeException If database insert fails
	 */
	public function create( array $data ): int {
		global $wpdb;

		$defaults = array(
			'form_id'        => 0,
			'schema_version' => null,
			'payload'        => array(),
			'meta'           => array(),
			'status'         => 'unread',
			'ip_address'     => null,
			'user_agent'     => null,
		);

		$data = wp_parse_args( $data, $defaults );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Intentional direct insert; no caching needed for write operations.
		$inserted = $wpdb->insert(
			$this->table,
			array(
				'form_id'        => intval( Helpers::safe_array_get( $data, 'form_id', 0 ) ),
				'schema_version' => isset( $data['schema_version'] ) ? intval( $data['schema_version'] ) : null,
				'payload'        => wp_json_encode( Helpers::safe_array_get( $data, 'payload', array() ) ),
				'meta'           => wp_json_encode( Helpers::safe_array_get( $data, 'meta', array() ) ),
				'status'         => Helpers::safe_array_get( $data, 'status', 'unread' ),
				'ip_address'     => Helpers::safe_array_get( $data, 'ip_address', '' ),
				'user_agent'     => Helpers::safe_array_get( $data, 'user_agent', '' ),
			),
			array( '%d', '%d', '%s', '%s', '%s', '%s', '%s' )
		);

		if ( $inserted === false || $wpdb->last_error ) {
			$error = sprintf(
				'Failed to create submission for form %d: %s',
				$data['form_id'],
				$wpdb->last_error ?: 'Unknown database error'
			);
			Logger::error( '' . $error );
			throw new \RuntimeException( $error ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		$submissionId = $wpdb->insert_id;
		if ( ! $submissionId ) {
			$error = 'Failed to get submission ID after insert';
			Logger::error( '' . $error );
			throw new \RuntimeException( $error ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		// Phase B3: Invalidate count cache for this form
		$this->invalidate_count_cache( $data['form_id'] );

		return $submissionId;
	}

	/**
	 * Update a submission.
	 *
	 * @throws \RuntimeException If database update fails
	 */
	public function update( int $id, array $data ): bool {
		global $wpdb;

		$update_data = array();
		$format      = array();

		if ( isset( $data['payload'] ) ) {
			$update_data['payload'] = wp_json_encode( $data['payload'] );
			$format[]               = '%s';
		}

		if ( isset( $data['meta'] ) ) {
			$update_data['meta'] = wp_json_encode( $data['meta'] );
			$format[]            = '%s';
		}

		if ( isset( $data['status'] ) ) {
			if ( $data['status'] === 'none' ) {
				// 'none' clears admin status override — set to NULL in DB
				$update_data['status'] = null;
			} else {
				$update_data['status'] = $data['status'];
			}
			$format[] = '%s';
		}

		if ( isset( $data['is_read'] ) ) {
			$update_data['is_read'] = intval( $data['is_read'] );
			$format[]               = '%d';
		}

		if ( empty( $update_data ) ) {
			return false;
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Intentional direct update; no caching needed for write operations.
		$result = $wpdb->update(
			$this->table,
			$update_data,
			array( 'id' => $id ),
			$format,
			array( '%d' )
		);

		// Check for database errors
		if ( $wpdb->last_error ) {
			$error = sprintf(
				'Database error updating submission %d: %s',
				$id,
				$wpdb->last_error
			);
			Logger::error( '' . $error );
			throw new \RuntimeException( $error ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		// $result can be 0 if no rows were changed (but query succeeded)
		// Only fail if $result is false (query error)
		if ( $result === false ) {
			$error = sprintf(
				'Failed to update submission %d - submission may not exist',
				$id
			);
			Logger::error( '' . $error );
			throw new \RuntimeException( $error ); // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped
		}

		// Phase B3: Invalidate count cache (fetch submission to get form_id)
		$submission = $this->find( $id );
		if ( $submission && isset( $submission['form_id'] ) ) {
			$this->invalidate_count_cache( $submission['form_id'] );
		}

		return true;
	}

	/**
	 * Delete a submission.
	 */
	public function delete( int $id ): bool {
		global $wpdb;

		// Phase B3: Get form_id before delete for cache invalidation
		$submission = $this->find( $id );

		$result = $wpdb->delete( $this->table, array( 'id' => $id ), array( '%d' ) );

		// Invalidate count cache
		if ( $result !== false && $submission && isset( $submission['form_id'] ) ) {
			$this->invalidate_count_cache( $submission['form_id'] );
		}

		return $result !== false;
	}

	/**
	 * Get submissions with advanced filtering (v0.9.4).
	 */
	public function findAll( array $args = array() ): array {
		global $wpdb;

		$start = \SubtleForms\Support\QueryInstrumentation::start( __METHOD__ );

		$defaults = array(
			'form_id'     => null,
			'status'      => null,
			'is_read'     => null,
			'search'      => null,
			'after'       => null,
			'field_key'   => null,
			'field_value' => null,
			'limit'       => 20,
			'offset'      => 0,
			'orderby'     => 'created_at',
			'order'       => 'DESC',
		);

		$args = wp_parse_args( $args, $defaults );

		$where  = array();
		$params = array();

		if ( $args['form_id'] ) {
			$where[]  = 'form_id = %d';
			$params[] = intval( $args['form_id'] );
		}

		if ( $args['status'] && $args['status'] !== 'all' ) {
			$where[]  = 'status = %s';
			$params[] = $args['status'];
		}

		if ( $args['is_read'] !== null ) {
			$where[]  = 'is_read = %d';
			$params[] = intval( $args['is_read'] );
		}

		if ( $args['search'] ) {
			$searchTerm = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where[]    = '(id LIKE %s OR payload LIKE %s OR meta LIKE %s)';
			$params[]   = $searchTerm;
			$params[]   = $searchTerm;
			$params[]   = $searchTerm;
		}

		if ( $args['after'] ) {
			$where[]  = 'created_at >= %s';
			$params[] = sanitize_text_field( $args['after'] ) . ' 00:00:00';
		}

		if ( $args['field_key'] && $args['field_value'] ) {
			$field_key   = preg_replace( '/[^a-zA-Z0-9_\-]/', '', $args['field_key'] );
			$field_value = '%' . $wpdb->esc_like( $args['field_value'] ) . '%';
			// Use LIKE on payload JSON string for broad compatibility
			$where[]  = 'payload LIKE %s';
			$params[] = $field_value;
		} elseif ( $args['field_value'] && ! $args['field_key'] ) {
			$searchTerm = '%' . $wpdb->esc_like( $args['field_value'] ) . '%';
			$where[]    = 'payload LIKE %s';
			$params[]   = $searchTerm;
		}

		$whereClause = ! empty( $where ) ? 'WHERE ' . implode( ' AND ', $where ) : '';

		// Validate orderby (whitelist — safe to interpolate)
		$allowed_orderby = array( 'id', 'form_id', 'status', 'created_at' );
		$orderby         = in_array( $args['orderby'], $allowed_orderby, true ) ? $args['orderby'] : 'created_at';
		$order           = strtoupper( $args['order'] ) === 'ASC' ? 'ASC' : 'DESC';

		       // Fetch all columns needed for admin list (including payload/meta)
		       // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name, orderby and order are whitelisted.
				       $sql = sprintf(
			       "SELECT id, form_id, status, is_read, created_at, payload, meta, ip_address, user_agent FROM {$this->table} %s ORDER BY %s %s LIMIT %%d OFFSET %%d",
					       $whereClause,
					       $orderby,
					       $order
				       );

		       $params[] = intval( $args['limit'] );
		       $params[] = intval( $args['offset'] );

		       // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $sql is built from whitelisted table name/orderby and safe params, passed through prepare().
		       $results = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );

		       // Decode JSON fields for each result
		       foreach ( $results as &$result ) {
			       $result['payload'] = \SubtleForms\Support\Helpers::safe_json_decode( \SubtleForms\Support\Helpers::safe_array_get( $result, 'payload', '{}' ), true, array() );
			       $result['meta']    = \SubtleForms\Support\Helpers::safe_json_decode( \SubtleForms\Support\Helpers::safe_array_get( $result, 'meta', '{}' ), true, array() );
		       }
		       unset($result);

		       \SubtleForms\Support\QueryInstrumentation::end( $start, __METHOD__, $sql );

		       return $results;
	}

	/**
	 * Count submissions.
	 */
	public function count( array $args = array() ): int {
		global $wpdb;

		$defaults = array(
			'form_id'     => null,
			'status'      => null,
			'is_read'     => null,
			'search'      => null,
			'after'       => null,
			'field_key'   => null,
			'field_value' => null,
		);

		$args = wp_parse_args( $args, $defaults );

		$where  = array();
		$params = array();

		if ( $args['form_id'] ) {
			$where[]  = 'form_id = %d';
			$params[] = intval( $args['form_id'] );
		}

		if ( $args['status'] && $args['status'] !== 'all' ) {
			$where[]  = 'status = %s';
			$params[] = $args['status'];
		}

		if ( isset( $args['is_read'] ) && $args['is_read'] !== null ) {
			$where[]  = 'is_read = %d';
			$params[] = intval( $args['is_read'] );
		}

		if ( $args['search'] ) {
			$searchTerm = '%' . $wpdb->esc_like( $args['search'] ) . '%';
			$where[]    = '(id LIKE %s OR payload LIKE %s OR meta LIKE %s)';
			$params[]   = $searchTerm;
			$params[]   = $searchTerm;
			$params[]   = $searchTerm;
		}

		if ( $args['after'] ) {
			$where[]  = 'created_at >= %s';
			$params[] = sanitize_text_field( $args['after'] ) . ' 00:00:00';
		}

		if ( $args['field_value'] ) {
			$searchTerm = '%' . $wpdb->esc_like( $args['field_value'] ) . '%';
			$where[]    = 'payload LIKE %s';
			$params[]   = $searchTerm;
		}

		$whereClause = ! empty( $where ) ? 'WHERE ' . implode( ' AND ', $where ) : '';

		$sql = "SELECT COUNT(*) FROM {$this->table} {$whereClause}";

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $sql built from $wpdb->prefix table name; user-supplied values are prepared or absent.
		if ( ! empty( $params ) ) {
			return (int) $wpdb->get_var( $wpdb->prepare( $sql, ...$params ) );
		}

		return (int) $wpdb->get_var( $sql );
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
	}

	/**
	 * Get next/previous submission IDs (v0.9.4).
	 */
	public function getAdjacentIds( int $currentId, ?int $formId = null ): array {
		global $wpdb;

		$conditions = array();
		$params     = array();

		if ( $formId ) {
			$conditions[] = 'form_id = %d';
			$params[]     = $formId;
		}

		// For Next
		$nextConditions   = $conditions;
		$nextConditions[] = 'id > %d';
		$nextParams       = $params;
		$nextParams[]     = $currentId;

		$whereNext = 'WHERE ' . implode( ' AND ', $nextConditions );

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter -- $whereNext contains only %d placeholders, passed to prepare().
		$next = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$this->table} {$whereNext} ORDER BY id ASC LIMIT 1",
				...$nextParams
			)
		);

		// For Prev
		$prevConditions   = $conditions;
		$prevConditions[] = 'id < %d';
		$prevParams       = $params;
		$prevParams[]     = $currentId;

		$wherePrev = 'WHERE ' . implode( ' AND ', $prevConditions );

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter -- $wherePrev contains only %d placeholders, passed to prepare().
		$prev = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$this->table} {$wherePrev} ORDER BY id DESC LIMIT 1",
				...$prevParams
			)
		);

		return array(
			'next' => $next ? intval( $next ) : null,
			'prev' => $prev ? intval( $prev ) : null,
		);
	}

	/**
	 * Delete submissions older than specified days.
	 *
	 * @param int $days Number of days.
	 * @return int Number of deleted submissions.
	 */
	public function delete_older_than( $days ) {
		global $wpdb;

		$cutoff_date = gmdate( 'Y-m-d H:i:s', strtotime( "-{$days} days" ) );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery -- Table name is safe.
		$deleted = $wpdb->query(
$wpdb->prepare(
"DELETE FROM {$this->table} WHERE created_at < %s",
$cutoff_date
)
		);

		return $deleted !== false ? (int) $deleted : 0;
	}

	/**
	 * Get submission counts grouped by form_id in bulk (performance optimization)
	 *
	 * @param array $form_ids Array of form IDs to get counts for
	 * @param string $status Optional status filter ('unread', 'saved', etc.)
	 * @return array Associative array [form_id => count]
	 */
	public function get_counts_by_forms( array $form_ids, $status = null ): array {
		if ( empty( $form_ids ) ) {
			return array();
		}

		// Phase B3: Cache dashboard aggregates (60s TTL)
		sort( $form_ids ); // Consistent key ordering
		$cache_key = 'subtleforms:1.8.2:counts:' . md5( serialize( $form_ids ) . '|' . $status );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;
		$placeholders = implode( ',', array_fill( 0, count( $form_ids ), '%d' ) );

		if ( $status ) {
			$query = $wpdb->prepare(
				"SELECT form_id, COUNT(*) as count FROM {$this->table} 
                WHERE form_id IN ({$placeholders}) AND status = %s 
                GROUP BY form_id",
				array_merge( $form_ids, array( $status ) )
			);
		} else {
			$query = $wpdb->prepare(
				"SELECT form_id, COUNT(*) as count FROM {$this->table} 
                WHERE form_id IN ({$placeholders}) 
                GROUP BY form_id",
				$form_ids
			);
		}

		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $query is the output of $wpdb->prepare() above.
		$results = $wpdb->get_results( $query, ARRAY_A );
		$counts  = array();

		foreach ( $results as $row ) {
			$counts[ (int) $row['form_id'] ] = (int) $row['count'];
		}

		// Fill in zero counts for forms with no submissions
		foreach ( $form_ids as $id ) {
			if ( ! isset( $counts[ $id ] ) ) {
				$counts[ $id ] = 0;
			}
		}

		// Cache for 60 seconds
		set_transient( $cache_key, $counts, 60 );

		return $counts;
	}

	/**
	 * Invalidate count cache for a specific form (v1.8.2 - Phase B3).
	 */
	private function invalidate_count_cache( int $form_id ): void {
		// Delete all cached counts that include this form
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", '_transient_subtleforms:1.8.2:counts:%' ) );
	}
}
