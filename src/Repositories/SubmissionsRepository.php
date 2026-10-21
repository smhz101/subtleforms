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

	/**
	 * Status of an entry in the Trash (2.3.1).
	 */
	public const TRASH = 'trash';

	/**
	 * SQL condition that leaves trashed entries out. `status` may be NULL.
	 */
	public const NOT_TRASHED = "( status IS NULL OR status <> 'trash' )";

	/**
	 * Status of an entry sent from the builder's Preview (2.4.0). It is a test
	 * answer, so counts, reports and the inbox leave it out.
	 */
	public const PREVIEW = 'preview';

	/**
	 * SQL condition that leaves Trash and Preview entries out: the entries
	 * that count as real submissions in totals, the dashboard and the inbox.
	 */
	public const LISTED = "( status IS NULL OR status NOT IN ( 'trash', 'preview' ) )";

	/**
	 * The visibility conditions for a list or a count.
	 *
	 * Trash only shows in the Trash, Preview entries only when asked for by
	 * name, and everything else shows real entries.
	 *
	 * @param string|null $status Status filter, if any.
	 * @return string[]
	 */
	public static function visibilityConditions( $status ): array {
		if ( self::TRASH === $status ) {
			return array();
		}
		if ( self::PREVIEW === $status ) {
			return array( self::NOT_TRASHED );
		}
		return array( self::LISTED );
	}

	/**
	 * Default number of days an entry stays in the Trash.
	 */
	public const TRASH_DAYS = 30;

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
		$where = array_merge( $where, self::visibilityConditions( $args['status'] ) );

		$where_clause = 'WHERE ' . implode( ' AND ', $where );

		// Validate orderby (whitelist, safe to interpolate)
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

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Intentional direct insert; no caching needed for write operations.
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
				// Stored in UTC so every reader can convert to the viewer's time.
				'created_at'     => current_time( 'mysql', true ),
			),
			array( '%d', '%d', '%s', '%s', '%s', '%s', '%s', '%s' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

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

		$current = isset( $data['status'] ) ? $this->find( $id ) : null;
		$columns = self::statusColumns( $data, is_array( $current ) ? $current : array() );
		foreach ( $columns as $column => $value ) {
			if ( 'meta' === $column ) {
				$update_data['meta'] = wp_json_encode( $value );
				$format[]            = '%s';
				continue;
			}
			$update_data[ $column ] = $value;
			$format[]               = 'status' === $column ? '%s' : '%s';
		}

		if ( isset( $data['is_read'] ) ) {
			$update_data['is_read'] = intval( $data['is_read'] );
			$format[]               = '%d';
		}

		if ( isset( $data['starred'] ) ) {
			$update_data['starred'] = $data['starred'] ? 1 : 0;
			$format[]               = '%d';
		}

		if ( empty( $update_data ) ) {
			return false;
		}

		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Intentional direct update; no caching needed for write operations.
		$result = $wpdb->update(
			$this->table,
			$update_data,
			array( 'id' => $id ),
			$format,
			array( '%d' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

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
	 *
	 * @param int  $id         Entry ID.
	 * @param bool $with_files Also delete its uploaded files (false keeps
	 *                         files a visitor may send again after fixing
	 *                         an answer).
	 */
	public function delete( int $id, bool $with_files = true ): bool {
		global $wpdb;

		// Phase B3: Get form_id before delete for cache invalidation
		$submission = $this->find( $id );

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Direct delete; no caching for write operations.
		$result = $wpdb->delete( $this->table, array( 'id' => $id ), array( '%d' ) );

		// Uploaded files and the activity log go with their entry (2.1, FA-19, FF-27).
		if ( $result && $submission ) {
			if ( $with_files ) {
				\SubtleForms\Uploads\Uploads::deleteForPayload( $submission['payload'] ?? array() );
			}
			( new LogsRepository() )->deleteBySubmission( $id );

			/**
			 * Fires after an entry was deleted for good (2.4.1), so add-ons can
			 * remove what they keep about it, such as integration logs.
			 *
			 * @param int   $id         Entry ID.
			 * @param array $submission The deleted entry.
			 * @since 2.4.1
			 */
			do_action( 'subtleforms/submission/deleted', $id, $submission );
		}

		// Invalidate count cache
		if ( $result !== false && $submission && isset( $submission['form_id'] ) ) {
			$this->invalidate_count_cache( $submission['form_id'] );
		}

		return $result !== false;
	}

	/**
	 * Move an entry to the Trash (2.3.1). Its previous status and the time
	 * are kept so Restore can return it and the Trash can be emptied later.
	 *
	 * @param int $id Entry ID.
	 * @return bool
	 */
	public function trash( int $id ): bool {
		global $wpdb;
		$submission = $this->find( $id );
		if ( ! $submission ) {
			return false;
		}
		if ( ( $submission['status'] ?? '' ) === self::TRASH ) {
			return true;
		}
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Write path.
		$result = $wpdb->update(
			$this->table,
			array(
				'status'       => self::TRASH,
				'trashed_from' => isset( $submission['status'] ) ? (string) $submission['status'] : '',
				'trashed_at'   => current_time( 'mysql', true ),
			),
			array( 'id' => $id ),
			array( '%s', '%s', '%s' ),
			array( '%d' )
		);
		if ( false === $result ) {
			return false;
		}
		$this->invalidate_count_cache( (int) $submission['form_id'] );
		/**
		 * Fires when an entry is moved to the Trash.
		 *
		 * @param int   $id         Entry ID.
		 * @param array $submission Entry row before it was trashed.
		 * @since 2.3.1
		 */
		do_action( 'subtleforms/submission/trashed', $id, $submission );
		return true;
	}

	/**
	 * Restore an entry from the Trash to its previous status (2.3.1).
	 *
	 * @param int $id Entry ID.
	 * @return string|false The restored status, or false.
	 */
	public function untrash( int $id ) {
		global $wpdb;
		$submission = $this->find( $id );
		if ( ! $submission || ( $submission['status'] ?? '' ) !== self::TRASH ) {
			return false;
		}
		$previous = (string) ( $submission['trashed_from'] ?? '' );
		$status   = ( '' === $previous || self::TRASH === $previous ) ? 'completed' : $previous;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Write path.
		$result = $wpdb->update(
			$this->table,
			array(
				'status'       => $status,
				'trashed_from' => null,
				'trashed_at'   => null,
			),
			array( 'id' => $id ),
			array( '%s', '%s', '%s' ),
			array( '%d' )
		);
		if ( false === $result ) {
			return false;
		}
		$this->invalidate_count_cache( (int) $submission['form_id'] );
		/**
		 * Fires when an entry is restored from the Trash.
		 *
		 * @param int    $id     Entry ID.
		 * @param string $status Restored status.
		 * @param array  $submission Entry row while it was in the Trash.
		 * @since 2.3.1
		 */
		do_action( 'subtleforms/submission/untrashed', $id, $status, $submission );
		return $status;
	}

	/**
	 * Permanently delete entries that have been in the Trash longer than
	 * $days days, with their files and logs (daily cron, 2.3.1).
	 *
	 * @param int $days Days in the Trash.
	 * @return int Entries deleted.
	 */
	public function emptyTrash( int $days = self::TRASH_DAYS ): int {
		global $wpdb;
		$cutoff = gmdate( 'Y-m-d H:i:s', time() - max( 0, $days ) * DAY_IN_SECONDS );
		// An entry that reached the Trash without a time (status changed by
		// another route) starts its Trash period now instead of being deleted.
		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix; values are prepared.
		$wpdb->query( $wpdb->prepare( "UPDATE {$this->table} SET trashed_at = %s WHERE status = %s AND trashed_at IS NULL", current_time( 'mysql', true ), self::TRASH ) );
		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix; values are prepared.
		$ids = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$this->table} WHERE status = %s AND trashed_at <= %s LIMIT 1000", self::TRASH, $cutoff ) );
		$deleted = 0;
		$logs    = new LogsRepository();
		foreach ( (array) $ids as $id ) {
			if ( $this->delete( (int) $id ) ) {
				$logs->deleteBySubmission( (int) $id );
				++$deleted;
			}
		}
		return $deleted;
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
			'starred'     => null,
			'ids'         => null,
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
		// Entries in the Trash only show in the Trash (2.3.1), and Preview
		// entries only when asked for.
		$where = array_merge( $where, self::visibilityConditions( $args['status'] ) );

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

		$this->applyStarAndIds( $where, $params, $args );

		if ( $args['field_key'] && $args['field_value'] ) {
			$this->applyFieldFilter( $where, $params, (string) $args['field_key'], (string) $args['field_value'] );
		} elseif ( $args['field_value'] && ! $args['field_key'] ) {
			$searchTerm = '%' . $wpdb->esc_like( $args['field_value'] ) . '%';
			$where[]    = 'payload LIKE %s';
			$params[]   = $searchTerm;
		}

		$whereClause = ! empty( $where ) ? 'WHERE ' . implode( ' AND ', $where ) : '';

		// Validate orderby (whitelist, safe to interpolate)
		$allowed_orderby = array( 'id', 'form_id', 'status', 'created_at' );
		$orderby         = in_array( $args['orderby'], $allowed_orderby, true ) ? $args['orderby'] : 'created_at';
		$order           = strtoupper( $args['order'] ) === 'ASC' ? 'ASC' : 'DESC';

		       // Fetch all columns needed for admin list (including payload/meta)
		       // phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- Table name, orderby and order are whitelisted.
		       $sql = sprintf(
			       "SELECT id, form_id, schema_version, status, is_read, starred, created_at, payload, meta, user_agent FROM {$this->table} %s ORDER BY %s %s LIMIT %%d OFFSET %%d",
					       $whereClause,
					       $orderby,
					       $order
				       );
		       // phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		       $params[] = intval( $args['limit'] );
		       $params[] = intval( $args['offset'] );

		       // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $sql is built from whitelisted table name/orderby and safe params, passed through prepare().
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
			'starred'     => null,
			'ids'         => null,
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
		// Entries in the Trash only show in the Trash (2.3.1), and Preview
		// entries only when asked for.
		$where = array_merge( $where, self::visibilityConditions( $args['status'] ) );

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

		$this->applyStarAndIds( $where, $params, $args );

		if ( $args['field_key'] && $args['field_value'] ) {
			$this->applyFieldFilter( $where, $params, (string) $args['field_key'], (string) $args['field_value'] );
		} elseif ( $args['field_value'] ) {
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
	 * Starred filter and an explicit list of IDs (2.3.0).
	 *
	 * @param array $where  WHERE fragments, appended by reference.
	 * @param array $params Bound parameters, appended by reference.
	 * @param array $args   Query arguments.
	 */
	private function applyStarAndIds( array &$where, array &$params, array $args ): void {
		if ( $args['starred'] !== null && $args['starred'] !== '' ) {
			$where[]  = 'starred = %d';
			$params[] = $args['starred'] ? 1 : 0;
		}
		if ( is_array( $args['ids'] ) ) {
			$ids = array_values( array_unique( array_filter( array_map( 'absint', $args['ids'] ) ) ) );
			if ( ! $ids ) {
				$where[] = '1 = 0';
				return;
			}
			$where[] = 'id IN (' . implode( ',', array_fill( 0, count( $ids ), '%d' ) ) . ')';
			foreach ( $ids as $id ) {
				$params[] = $id;
			}
		}
	}

	/**
	 * Add a note to an entry (2.3.0). Notes live in the entry's meta.
	 *
	 * @param int    $id     Entry ID.
	 * @param string $text   Note text.
	 * @param int    $userId Author.
	 * @return array|null The note, or null when the entry does not exist.
	 */
	public function addNote( int $id, string $text, int $userId ): ?array {
		$submission = $this->find( $id );
		if ( ! $submission ) {
			return null;
		}
		$meta  = is_array( $submission['meta'] ?? null ) ? $submission['meta'] : array();
		$notes = isset( $meta['notes'] ) && is_array( $meta['notes'] ) ? $meta['notes'] : array();
		$note  = array(
			'id'         => wp_generate_uuid4(),
			'text'       => $text,
			'author'     => $userId,
			'created_at' => gmdate( 'c' ),
		);
		$notes[]       = $note;
		$meta['notes'] = $notes;
		$this->update( $id, array( 'meta' => $meta ) );
		return $note;
	}

	/**
	 * Remove a note from an entry.
	 *
	 * @param int    $id     Entry ID.
	 * @param string $noteId Note ID.
	 * @return bool Whether a note was removed.
	 */
	public function deleteNote( int $id, string $noteId ): bool {
		$submission = $this->find( $id );
		if ( ! $submission ) {
			return false;
		}
		$meta  = is_array( $submission['meta'] ?? null ) ? $submission['meta'] : array();
		$notes = isset( $meta['notes'] ) && is_array( $meta['notes'] ) ? $meta['notes'] : array();
		$kept  = array_values( array_filter( $notes, static fn( $n ) => ( $n['id'] ?? '' ) !== $noteId ) );
		if ( count( $kept ) === count( $notes ) ) {
			return false;
		}
		$meta['notes'] = $kept;
		$this->update( $id, array( 'meta' => $meta ) );
		return true;
	}

	/**
	 * Scope a payload filter to one field key.
	 *
	 * Where the database provides JSON functions the value is compared against
	 * that key only. On MySQL < 5.7 / MariaDB < 10.2 we fall back to a LIKE
	 * pattern anchored on the quoted key, which is narrower than searching the
	 * whole payload even though it cannot match non-string values.
	 *
	 * @param array  $where  WHERE fragments, appended by reference.
	 * @param array  $params Bound parameters, appended by reference.
	 * @param string $key    Raw field key from the request.
	 * @param string $value  Raw value to search for.
	 */
	private function applyFieldFilter( array &$where, array &$params, string $key, string $value ): void {
		global $wpdb;

		$field_key = preg_replace( '/[^a-zA-Z0-9_\-]/', '', $key );

		if ( $field_key === '' ) {
			$where[]  = 'payload LIKE %s';
			$params[] = '%' . $wpdb->esc_like( $value ) . '%';
			return;
		}

		if ( \SubtleForms\Support\DatabaseFeatures::supportsJson() ) {
			// JSON path is built from the sanitized key, which is [A-Za-z0-9_-] only.
			$where[]  = "JSON_UNQUOTE( JSON_EXTRACT( payload, '$.\"{$field_key}\"' ) ) LIKE %s";
			$params[] = '%' . $wpdb->esc_like( $value ) . '%';
			return;
		}

		// Fallback: anchor the match on the quoted key so other fields cannot match.
		$where[]  = 'payload LIKE %s';
		$params[] = '%' . $wpdb->esc_like( '"' . $field_key . '":"' ) . '%' . $wpdb->esc_like( $value ) . '%';
	}

	/**
	 * Get next/previous submission IDs (v0.9.4).
	 */
	public function getAdjacentIds( int $currentId, ?int $formId = null ): array {
		global $wpdb;

		$conditions = array( self::LISTED );
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

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $whereNext contains only %d placeholders; table name is from $wpdb->prefix.
		$next = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$this->table} {$whereNext} ORDER BY id ASC LIMIT 1",
				...$nextParams
			)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		// For Prev
		$prevConditions   = $conditions;
		$prevConditions[] = 'id < %d';
		$prevParams       = $params;
		$prevParams[]     = $currentId;

		$wherePrev = 'WHERE ' . implode( ' AND ', $prevConditions );

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $wherePrev contains only %d placeholders; table name is from $wpdb->prefix.
		$prev = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$this->table} {$wherePrev} ORDER BY id DESC LIMIT 1",
				...$prevParams
			)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

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

		// Uploaded files go with their entries (2.1). Only entries that carry
		// a file record are read.
		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix; values are prepared.
		$with_files = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT payload FROM {$this->table} WHERE created_at < %s AND payload LIKE %s",
				$cutoff_date,
				'%' . $wpdb->esc_like( '"size":' ) . '%'
			)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		foreach ( (array) $with_files as $stored_payload ) {
			\SubtleForms\Uploads\Uploads::deleteForPayload( (string) $stored_payload );
		}

		// The activity log of purged entries goes too (FF-27).
		$logs = $wpdb->prefix . 'subtleforms_logs';
		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table names are from $wpdb->prefix; date value is prepared.
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$logs} WHERE submission_id IN ( SELECT id FROM {$this->table} WHERE created_at < %s )",
				$cutoff_date
			)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is from $wpdb->prefix; date value is prepared.
		$deleted = $wpdb->query(
$wpdb->prepare(
"DELETE FROM {$this->table} WHERE created_at < %s",
$cutoff_date
)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

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
		$generation = (int) get_option( 'subtleforms_counts_generation', 1 );
		$cache_key  = self::countsCacheKey( $form_ids, $status, $generation );
		$cached    = get_transient( $cache_key );

		if ( false !== $cached ) {
			return $cached;
		}

		global $wpdb;
		$placeholders = implode( ',', array_fill( 0, count( $form_ids ), '%d' ) );

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- Table name from $wpdb->prefix; placeholders are safe.
		if ( $status ) {
			$query = $wpdb->prepare(
				"SELECT form_id, COUNT(*) as count FROM {$this->table}
                WHERE form_id IN ({$placeholders}) AND status = %s AND ( status IS NULL OR status <> 'trash' )
                GROUP BY form_id",
				array_merge( $form_ids, array( $status ) )
			);
		} else {
			$query = $wpdb->prepare(
				"SELECT form_id, COUNT(*) as count FROM {$this->table}
                WHERE form_id IN ({$placeholders}) AND ( status IS NULL OR status NOT IN ( 'trash', 'preview' ) )
                GROUP BY form_id",
				$form_ids
			);
		}
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- $query is the output of $wpdb->prepare() above.
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
		// Bump a generation so the next read misses. A LIKE delete scanned
		// wp_options on every submission (FF-29). Old keys expire in a minute.
		$next = (int) get_option( 'subtleforms_counts_generation', 1 ) + 1;
		update_option( 'subtleforms_counts_generation', $next, false );
	}

	/**
	 * Keep a pipeline status (payment_pending, failed) when an entry is flagged
	 * or marked spam, and put it back on Restore.
	 *
	 * @param string $current Current status.
	 * @param string $next Requested status.
	 * @param array  $meta Submission meta.
	 * @return array{status: string, meta: array|null}
	 */
	/**
	 * Columns to write when an entry is updated. Flagging stores the previous
	 * status in meta, and that meta has to be part of the same write.
	 *
	 * @param array $data Requested changes.
	 * @param array $current Stored row.
	 * @return array
	 */
	public static function statusColumns( array $data, array $current ): array {
		$columns = array();
		if ( isset( $data['meta'] ) && is_array( $data['meta'] ) ) {
			$columns['meta'] = $data['meta'];
		}
		if ( ! isset( $data['status'] ) ) {
			return $columns;
		}
		$meta = is_array( $current['meta'] ?? null ) ? $current['meta'] : array();
		if ( isset( $columns['meta'] ) ) {
			$meta = array_merge( $meta, $columns['meta'] );
		}
		$resolved = self::reviewStatus( (string) ( $current['status'] ?? '' ), (string) $data['status'], $meta );
		if ( is_array( $resolved['meta'] ) ) {
			$columns['meta'] = $resolved['meta'];
		}
		$columns['status'] = 'none' === $resolved['status'] ? null : $resolved['status'];
		return $columns;
	}

	public static function reviewStatus( string $current, string $next, array $meta ): array {
		$review = array( 'spam', 'flagged', 'archived' );
		if ( in_array( $next, $review, true ) ) {
			if ( '' !== $current && 'trash' !== $current && 'none' !== $current && ! in_array( $current, $review, true ) ) {
				$meta['pipeline_status'] = $current;
			}
			return array(
				'status' => $next,
				'meta'   => $meta,
			);
		}
		if ( 'none' === $next ) {
			$saved = isset( $meta['pipeline_status'] ) ? (string) $meta['pipeline_status'] : '';
			unset( $meta['pipeline_status'] );
			if ( '' !== $saved ) {
				return array(
					'status' => $saved,
					'meta'   => $meta,
				);
			}
			return array(
				'status' => 'none',
				'meta'   => $meta,
			);
		}
		return array(
			'status' => $next,
			'meta'   => null,
		);
	}

	/**
	 * Cache key for dashboard submission counts. The generation changes when
	 * any entry is written, so a stale count is never reused.
	 *
	 * @param array      $formIds Form ids.
	 * @param mixed      $status Status filter.
	 * @param int        $generation Cache generation.
	 * @return string
	 */
	public static function countsCacheKey( array $formIds, $status, int $generation ): string {
		sort( $formIds );
		return 'subtleforms:' . SUBTLEFORMS_VERSION . ':counts:' . $generation . ':' . md5( serialize( $formIds ) . '|' . $status );
	}

	/**
	 * Keep the original time when an entry is imported.
	 *
	 * @param int    $id Submission id.
	 * @param string $createdAt UTC Y-m-d H:i:s.
	 * @return bool
	 */
	public function setCreatedAt( int $id, string $createdAt ): bool {
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $createdAt ) ) {
			return false;
		}
		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$updated = $wpdb->update(
			$this->table,
			array( 'created_at' => $createdAt ),
			array( 'id' => $id ),
			array( '%s' ),
			array( '%d' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return false !== $updated;
	}

}
