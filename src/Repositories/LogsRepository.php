<?php
/**
 * SubtleForms Logs Repository
 *
 * @package   SubtleForms\Repositories
 * @version   0.1.0
 */

namespace SubtleForms\Repositories;

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

		$where = $wpdb->prepare( 'WHERE submission_id = %d', $submissionId );

		if ( $args['level'] ) {
			$where .= $wpdb->prepare( ' AND level = %s', $args['level'] );
		}

		$sql = sprintf(
			"SELECT * FROM {$this->table} %s ORDER BY %s %s LIMIT %d OFFSET %d",
			$where,
			esc_sql( $args['orderby'] ),
			esc_sql( $args['order'] ),
			intval( $args['limit'] ),
			intval( $args['offset'] )
		);

		$results = $wpdb->get_results( $sql, ARRAY_A );

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

		$wpdb->insert(
			$this->table,
			array(
				'submission_id' => intval( $data['submission_id'] ),
				'level'         => $data['level'],
				'message'       => $data['message'],
				'context'       => wp_json_encode( $data['context'] ),
			),
			array( '%d', '%s', '%s', '%s' )
		);

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
		$result = $wpdb->delete( $this->table, array( 'submission_id' => $submissionId ), array( '%d' ) );
		return $result !== false;
	}

	/**
	 * Count logs.
	 */
	public function count( ?int $submissionId = null, array $args = array() ): int {
		global $wpdb;

		$where = '';
		if ( $submissionId ) {
			$where = $wpdb->prepare( ' WHERE submission_id = %d', $submissionId );
		}

		if ( ! empty( $args['level'] ) ) {
			$operator = $submissionId ? ' AND' : ' WHERE';
			$where   .= $wpdb->prepare( "{$operator} level = %s", $args['level'] );
		}

		return (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$this->table}{$where}" );
	}
}
