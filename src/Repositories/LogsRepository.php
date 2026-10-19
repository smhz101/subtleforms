<?php
/**
 * SubtleForms Logs Repository
 *
 * @package   SubtleForms\Repositories
 * @version   0.1.0
 */

namespace SubtleForms\Repositories;

if ( ! defined( 'ABSPATH' ) ) { exit; }

use SubtleForms\Support\Helpers;

/**
 * Repository for managing submission logs.
 */
final class LogsRepository {

	/**
	 * @var string
	 */
	private $table;

	public function __construct() {
		global $wpdb;
		$this->table = $wpdb->prefix . 'subtleforms_logs';
	}

	/**
	 * Get logs for a submission.
	 */
	public function findBySubmission( int $submissionId, array $args = array() ): array {
		global $wpdb;

		$defaults = array(
			'level'   => null,
			'limit'   => 50,
			'offset'  => 0,
			'orderby' => 'created_at',
			'order'   => 'ASC',
		);

		$args = wp_parse_args( $args, $defaults );

		$where  = array( 'submission_id = %d' );
		$params = array( $submissionId );

		if ( $args['level'] ) {
			$where[]  = 'level = %s';
			$params[] = $args['level'];
		}

		$where_clause = 'WHERE ' . implode( ' AND ', $where );

		// Validate orderby (whitelist, safe to interpolate)
		$allowed_orderby = array( 'id', 'submission_id', 'level', 'created_at' );
		$orderby         = in_array( $args['orderby'], $allowed_orderby, true ) ? $args['orderby'] : 'created_at';
		$order           = strtoupper( $args['order'] ) === 'ASC' ? 'ASC' : 'DESC';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name, orderby and order are whitelisted.
		$sql = "SELECT * FROM {$this->table} {$where_clause} ORDER BY {$orderby} {$order} LIMIT %d OFFSET %d";

		$params[] = intval( $args['limit'] );
		$params[] = intval( $args['offset'] );

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $sql is built from whitelisted table name/orderby and safe params, passed through prepare().
		$results = $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A );

		// Decode JSON context
		foreach ( $results as &$result ) {
			$result['context'] = Helpers::safe_json_decode( Helpers::safe_array_get( $result, 'context', '{}' ), true, array() );
		}

		return $results;
	}

	/**
	 * Create a new log entry.
	 */
	public function create( array $data ): int {
		global $wpdb;

		$defaults = array(
			'submission_id' => 0,
			'level'         => 'info',
			'message'       => '',
			'context'       => array(),
		);

		$data = wp_parse_args( $data, $defaults );

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Intentional log insert; no caching needed for write operations.
		$wpdb->insert(
			$this->table,
			array(
				'submission_id' => intval( $data['submission_id'] ),
				'level'         => $data['level'],
				'message'       => $data['message'],
				'context'       => wp_json_encode( $data['context'] ),
				'created_at'    => current_time( 'mysql', true ),
			),
			array( '%d', '%s', '%s', '%s', '%s' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return $wpdb->insert_id;
	}

	/**
	 * Log an info message.
	 */
	public function info( int $submissionId, string $message, array $context = array() ): int {
		return $this->create(
			array(
				'submission_id' => $submissionId,
				'level'         => 'info',
				'message'       => $message,
				'context'       => $context,
			)
		);
	}

	/**
	 * Log an error message.
	 */
	public function error( int $submissionId, string $message, array $context = array() ): int {
		return $this->create(
			array(
				'submission_id' => $submissionId,
				'level'         => 'error',
				'message'       => $message,
				'context'       => $context,
			)
		);
	}

	/**
	 * Log a warning message.
	 */
	public function warning( int $submissionId, string $message, array $context = array() ): int {
		return $this->create(
			array(
				'submission_id' => $submissionId,
				'level'         => 'warning',
				'message'       => $message,
				'context'       => $context,
			)
		);
	}

	/**
	 * Delete logs for a submission.
	 */
	public function deleteBySubmission( int $submissionId ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Intentional direct delete; no caching needed for write.
		$result = $wpdb->delete( $this->table, array( 'submission_id' => $submissionId ), array( '%d' ) );
		return $result !== false;
	}

	/**
	 * Count logs.
	 */
	public function count( ?int $submissionId = null, array $args = array() ): int {
		global $wpdb;

		$where  = array();
		$params = array();

		if ( $submissionId ) {
			$where[]  = 'submission_id = %d';
			$params[] = $submissionId;
		}

		if ( ! empty( $args['level'] ) ) {
			$where[]  = 'level = %s';
			$params[] = $args['level'];
		}

		$where_clause = empty( $where ) ? '' : ' WHERE ' . implode( ' AND ', $where );

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name is safe.
		$sql = "SELECT COUNT(*) FROM {$this->table}{$where_clause}";

		if ( ! empty( $params ) ) {
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $sql built from whitelisted table name; values are prepared.
			return (int) $wpdb->get_var( $wpdb->prepare( $sql, ...$params ) );
		}

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- No user-supplied params; table name is controlled.
		return (int) $wpdb->get_var( $sql );
	}

	/**
	 * A page of logs, newest first.
	 *
	 * Webhook rows are the ones whose context records action_type webhook.
	 *
	 * @param array $args page, per_page, level, form_id, webhook.
	 * @return array{rows: array, total: int}
	 */
		/**
	 * A webhook that was only queued is not a successful call.
	 *
	 * @param array  $context Log context.
	 * @param string $message Stored message.
	 * @return string
	 */
	public static function webhookMessage( array $context, string $message ): string {
		if ( ( $context['action_type'] ?? '' ) !== 'webhook' ) {
			return $message;
		}
		$data = is_array( $context['data'] ?? null ) ? $context['data'] : array();
		if ( ! empty( $data['http_status'] ) || ! empty( $data['error'] ) ) {
			return $message;
		}
		if ( ! empty( $data['dispatched'] ) ) {
			return __( 'Queued', 'subtleforms' );
		}
		return $message;
	}

	public function search( array $args = array() ): array {
		global $wpdb;
		$logs        = $this->table;
		$submissions = $wpdb->prefix . 'subtleforms_submissions';
		$forms       = $wpdb->prefix . 'subtleforms_forms';
		$page        = max( 1, (int) ( $args['page'] ?? 1 ) );
		$per_page    = max( 1, min( 50, (int) ( $args['per_page'] ?? 20 ) ) );
		$level   = (string) ( $args['level'] ?? '' );
		$level   = in_array( $level, array( 'info', 'warning', 'error' ), true ) ? $level : '';
		$form_id = (int) ( $args['form_id'] ?? 0 );
		$like    = ! empty( $args['webhook'] ) ? '%"action_type":"webhook"%' : '';
		$offset  = ( $page - 1 ) * $per_page;
		$from    = "{$logs} l LEFT JOIN {$submissions} s ON s.id = l.submission_id LEFT JOIN {$forms} f ON f.id = s.form_id";
		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table names are fixed. Every value is a placeholder.
		$total = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$from} WHERE (%s = '' OR l.level = %s) AND (%d = 0 OR s.form_id = %d) AND (%s = '' OR l.context LIKE %s)",
				$level,
				$level,
				$form_id,
				$form_id,
				$like,
				$like
			)
		);
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT l.id, l.submission_id, l.level, l.message, l.context, l.created_at, s.form_id, f.title AS form_title FROM {$from} WHERE (%s = '' OR l.level = %s) AND (%d = 0 OR s.form_id = %d) AND (%s = '' OR l.context LIKE %s) ORDER BY l.id DESC LIMIT %d OFFSET %d",
				$level,
				$level,
				$form_id,
				$form_id,
				$like,
				$like,
				$per_page,
				$offset
			),
			ARRAY_A
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		$clean = array();
		foreach ( (array) $rows as $row ) {
			$context = json_decode( (string) ( $row['context'] ?? '' ), true );
			$data    = is_array( $context ) && is_array( $context['data'] ?? null ) ? $context['data'] : array();
			$body    = (string) ( $data['response_body'] ?? '' );
			if ( strlen( $body ) > 180 ) {
				$body = substr( $body, 0, 180 );
			}
			$clean[] = array(
				'id'            => (int) $row['id'],
				'submission_id' => (int) $row['submission_id'],
				'form_id'       => (int) ( $row['form_id'] ?? 0 ),
				'form_title'    => (string) ( $row['form_title'] ?? '' ),
				'level'         => (string) $row['level'],
				'message'       => self::webhookMessage( is_array( $context ) ? $context : array(), (string) $row['message'] ),
				'created_at'    => (string) $row['created_at'],
				'url'           => (string) ( $data['url'] ?? '' ),
				'method'        => (string) ( $data['method'] ?? '' ),
				'http_status'   => isset( $data['http_status'] ) ? (int) $data['http_status'] : null,
				'error'         => (string) ( $data['error'] ?? '' ),
				'response'      => $body,
			);
		}
		return array(
			'rows'  => $clean,
			'total' => $total,
		);
	}

}
