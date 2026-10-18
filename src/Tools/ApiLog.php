<?php
/**
 * A short log of SubtleForms REST calls.
 *
 * Method, route, status, user and duration only. Bodies are not stored.
 * Rows older than 30 days are removed.
 *
 * @package SubtleForms\Tools
 */

namespace SubtleForms\Tools;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * API log table.
 */
final class ApiLog {

	public const RETENTION_DAYS = 30;

	/**
	 * Table name.
	 *
	 * @return string
	 */
	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'subtleforms_api_logs';
	}

	/**
	 * Create the table and start recording.
	 */
	public static function register(): void {
		if ( get_option( 'subtleforms_api_log_table' ) !== '1' ) {
			self::install();
			update_option( 'subtleforms_api_log_table', '1', false );
		}
		add_filter( 'rest_pre_dispatch', array( __CLASS__, 'markStart' ), 10, 3 );
		add_filter( 'rest_post_dispatch', array( __CLASS__, 'record' ), 10, 3 );
	}

	/**
	 * Create or update the table.
	 */
	public static function install(): void {
		global $wpdb;
		if ( ! function_exists( 'dbDelta' ) ) {
			require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		}
		$table   = self::table();
		$charset = $wpdb->get_charset_collate();
		$sql     = "CREATE TABLE {$table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  method varchar(10) NOT NULL DEFAULT '',
  route varchar(191) NOT NULL DEFAULT '',
  status smallint(5) unsigned NOT NULL DEFAULT 0,
  user_id bigint(20) unsigned NOT NULL DEFAULT 0,
  duration_ms int unsigned NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY created_at (created_at),
  KEY status (status)
) {$charset};";
		dbDelta( $sql );
	}

	/** @var array<int, float> */
	private static $started = array();

	/**
	 * Remember when this REST call started.
	 *
	 * @param mixed            $result Result.
	 * @param \WP_REST_Server  $server Server.
	 * @param \WP_REST_Request $request Request.
	 * @return mixed
	 */
	public static function markStart( $result, $server, $request ) {
		if ( $request instanceof \WP_REST_Request && self::isOurs( $request ) ) {
			self::$started[ spl_object_id( $request ) ] = microtime( true );
		}
		return $result;
	}

	/**
	 * Write one row for a SubtleForms REST call.
	 *
	 * @param mixed            $result Response or error.
	 * @param \WP_REST_Server  $server Server.
	 * @param \WP_REST_Request $request Request.
	 * @return mixed
	 */
	public static function record( $result, $server, $request ) {
		if ( ! $request instanceof \WP_REST_Request || ! self::isOurs( $request ) ) {
			return $result;
		}
		if ( 'OPTIONS' === $request->get_method() ) {
			return $result;
		}
		$status = 200;
		if ( $result instanceof \WP_REST_Response ) {
			$status = (int) $result->get_status();
		} elseif ( $result instanceof \WP_Error ) {
			$data   = $result->get_error_data();
			$status = is_array( $data ) && isset( $data['status'] ) ? (int) $data['status'] : 500;
		}
		$id      = spl_object_id( $request );
		$started = self::$started[ $id ] ?? null;
		unset( self::$started[ $id ] );
		$ms = is_float( $started ) ? (int) round( ( microtime( true ) - $started ) * 1000 ) : 0;

		global $wpdb;
		// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Append-only log.
		$wpdb->insert(
			self::table(),
			array(
				'method'      => substr( $request->get_method(), 0, 10 ),
				'route'       => substr( $request->get_route(), 0, 191 ),
				'status'      => max( 0, min( 999, $status ) ),
				'user_id'     => get_current_user_id(),
				'duration_ms' => max( 0, $ms ),
				'created_at'  => current_time( 'mysql', true ),
			),
			array( '%s', '%s', '%d', '%d', '%d', '%s' )
		);
		// phpcs:enable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		self::prune();
		return $result;
	}

	/**
	 * A page of log rows, newest first.
	 *
	 * @param array $args page, per_page, status.
	 * @return array{rows: array, total: int}
	 */
	public static function query( array $args ): array {
		global $wpdb;
		$table    = self::table();
		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
		$per_page = max( 1, min( 50, (int) ( $args['per_page'] ?? 20 ) ) );
		$status = ( isset( $args['status'] ) && $args['status'] !== '' && $args['status'] !== null ) ? (int) $args['status'] : -1;
		$offset = ( $page - 1 ) * $per_page;
		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is fixed. Every value is a placeholder.
		$total = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE (%d = -1 OR status = %d)",
				$status,
				$status
			)
		);
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, method, route, status, user_id, duration_ms, created_at FROM {$table} WHERE (%d = -1 OR status = %d) ORDER BY id DESC LIMIT %d OFFSET %d",
				$status,
				$status,
				$per_page,
				$offset
			),
			ARRAY_A
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		return array(
			'rows'  => is_array( $rows ) ? $rows : array(),
			'total' => $total,
		);
	}

	/**
	 * Delete rows older than the retention window, at most once a day.
	 */
	private static function prune(): void {
		if ( get_transient( 'subtleforms_api_log_pruned' ) ) {
			return;
		}
		set_transient( 'subtleforms_api_log_pruned', 1, DAY_IN_SECONDS );
		global $wpdb;
		$table = self::table();
		$cut   = gmdate( 'Y-m-d H:i:s', time() - ( self::RETENTION_DAYS * DAY_IN_SECONDS ) );
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE created_at < %s", $cut ) );
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return bool
	 */
	private static function isOurs( \WP_REST_Request $request ): bool {
		return strpos( $request->get_route(), '/subtleforms/' ) === 0;
	}
}
