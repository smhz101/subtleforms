<?php

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) { exit; }

use SubtleForms\Api\ApiResponse;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\Settings;
use SubtleForms\Security\RateLimiter;
use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Dashboard API
 *
 * REST API endpoint for dashboard statistics and activity.
 */
class DashboardApi {

	/**
	 * @var FormsRepository
	 */
	private $formsRepo;

	/**
	 * @var SubmissionsRepository
	 */
	private $submissionsRepo;

	/**
	 * @var Settings
	 */
	private $settings;

	/**
	 * Constructor
	 *
	 * @param FormsRepository       $formsRepo Forms repository
	 * @param SubmissionsRepository $submissionsRepo Submissions repository
	 * @param Settings              $settings Settings manager
	 */
	public function __construct(
		FormsRepository $formsRepo,
		SubmissionsRepository $submissionsRepo,
		?Settings $settings = null
	) {
		$this->formsRepo       = $formsRepo;
		$this->submissionsRepo = $submissionsRepo;
		$this->settings        = $settings;
	}

	/**
	 * Register routes
	 */
	public function registerRoutes() {
		register_rest_route(
			'subtleforms/v1',
			'/dashboard',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'getDashboard' ),
				'permission_callback' => array( $this, 'checkPermissions' ),
			)
		);
	}

	/**
	 * Get dashboard data
	 *
	 * @param WP_REST_Request $request
	 * @return WP_REST_Response|WP_Error
	 */
	public function getDashboard( WP_REST_Request $request ) {
		// Rate limiting (Phase A3-P1)
		$rateLimitResponse = $this->guardRateLimit( $request );
		if ( $rateLimitResponse ) {
			return $rateLimitResponse;
		}

		try {
			$data = array(
				'stats'              => $this->getStats(),
				'recent_submissions' => $this->getRecentSubmissions(),
				'recent_forms'       => $this->getRecentForms(),
				'trend'              => $this->getSubmissionTrend( 14 ),
				'system_health'      => $this->getSystemHealth(),
			);

			return ApiResponse::success( $data );
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( $e->getMessage() );
		}
	}

	/**
	 * Get dashboard statistics
	 *
	 * @return array
	 */
	private function getStats() {
		// v1.7.0: Cache dashboard stats for 5 minutes to reduce DB load
		$cache_key = 'subtleforms_dashboard_stats_v2';
		$cached    = get_transient( $cache_key );

		if ( false !== $cached && is_array( $cached ) ) {
			return $cached;
		}

		global $wpdb;
		$formsTable       = $wpdb->prefix . 'subtleforms_forms';
		$submissionsTable = $wpdb->prefix . 'subtleforms_submissions';

		// Get form counts
		$totalForms     = $this->formsRepo->count();
		$publishedForms = $this->formsRepo->count( array( 'status' => 'published' ) );
		$draftForms     = $this->formsRepo->count( array( 'status' => 'draft' ) );

		// Get submission counts
		$totalSubmissions = $this->submissionsRepo->count();

		// Submissions today
		$todayStart       = gmdate( 'Y-m-d 00:00:00' );
		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is $wpdb->prefix controlled.
		$submissionsToday = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$submissionsTable} WHERE created_at >= %s",
				$todayStart
			)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		// Submissions this week (last 7 days)
		$weekStart           = gmdate( 'Y-m-d 00:00:00', strtotime( '-7 days' ) );
		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is $wpdb->prefix controlled.
		$submissionsThisWeek = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$submissionsTable} WHERE created_at >= %s",
				$weekStart
			)
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		// Average submissions per form
		$avgSubmissionsPerForm = $publishedForms > 0
			? round( $totalSubmissions / $publishedForms, 1 )
			: 0;

		$stats = array(
			'total_forms'              => $totalForms,
			'published_forms'          => $publishedForms,
			'draft_forms'              => $draftForms,
			'total_submissions'        => $totalSubmissions,
			'submissions_today'        => $submissionsToday,
			'submissions_this_week'    => $submissionsThisWeek,
			'avg_submissions_per_form' => $avgSubmissionsPerForm,
			'unread_submissions'       => $this->submissionsRepo->count( array( 'is_read' => 0 ) ),
		);

		// Short cache: the dashboard refetches every minute, and nothing
		// invalidates this key on new submissions.
		set_transient( $cache_key, $stats, MINUTE_IN_SECONDS );

		return $stats;
	}

	/**
	 * Daily submission counts for the last N days, oldest first.
	 *
	 * Days without submissions are included with a count of 0 so the chart
	 * always has one bar per day.
	 *
	 * @param int $days Number of days, including today.
	 * @return array<int, array{date: string, count: int}>
	 */
	private function getSubmissionTrend( int $days = 14 ): array {
		global $wpdb;
		$days             = max( 1, min( 90, $days ) );
		$submissionsTable = $wpdb->prefix . 'subtleforms_submissions';
		$start            = gmdate( 'Y-m-d 00:00:00', strtotime( '-' . ( $days - 1 ) . ' days' ) );

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is $wpdb->prefix controlled.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT DATE(created_at) AS day, COUNT(*) AS c FROM {$submissionsTable} WHERE created_at >= %s GROUP BY DATE(created_at)",
				$start
			),
			ARRAY_A
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		$counts = array();
		for ( $i = $days - 1; $i >= 0; $i-- ) {
			$counts[ gmdate( 'Y-m-d', strtotime( '-' . $i . ' days' ) ) ] = 0;
		}

		foreach ( (array) $rows as $row ) {
			$day = substr( (string) ( $row['day'] ?? '' ), 0, 10 );
			if ( isset( $counts[ $day ] ) ) {
				$counts[ $day ] += (int) ( $row['c'] ?? 0 );
			}
		}

		$trend = array();
		foreach ( $counts as $date => $count ) {
			$trend[] = array(
				'date'  => $date,
				'count' => $count,
			);
		}

		return $trend;
	}

	/**
	 * Get recent submissions
	 *
	 * @return array
	 */
	private function getRecentSubmissions() {
		global $wpdb;
		$submissionsTable = $wpdb->prefix . 'subtleforms_submissions';
		$formsTable       = $wpdb->prefix . 'subtleforms_forms';

		// phpcs:disable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table names are $wpdb->prefix controlled.
		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.id, s.form_id, s.status, s.is_read, s.created_at, f.title as form_title
             FROM {$submissionsTable} s
             LEFT JOIN {$formsTable} f ON s.form_id = f.id
             ORDER BY s.created_at DESC
             LIMIT %d",
				10
			),
			ARRAY_A
		);
		// phpcs:enable PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching

		return array_map(
			function ( $row ) {
				return array(
					'id'         => (int) $row['id'],
					'form_id'    => (int) $row['form_id'],
					'form_title' => $row['form_title'] ?? __( 'Unknown Form', 'subtleforms' ),
					'status'     => $row['status'],
					'is_read'    => ! empty( $row['is_read'] ),
					'created_at' => $row['created_at'],
					'time_ago'   => $this->timeAgo( $row['created_at'] ),
				);
			},
			$results
		);
	}

	/**
	 * Get recently edited forms
	 *
	 * @return array
	 */
	private function getRecentForms() {
		$forms = $this->formsRepo->all(
			array(
				'limit'   => 10,
				'orderby' => 'updated_at',
				'order'   => 'DESC',
			)
		);

		return array_map(
			function ( $form ) {
				// Get submission count for this form
				$submissionCount = $this->submissionsRepo->count( array( 'form_id' => $form['id'] ) );

				// Single source of truth for type/status/unpublished-changes so
				// the Dashboard agrees with All Forms and the builder header.
				$form = \SubtleForms\Support\FormMeta::with_meta( $form );

				return array(
					'id'                      => $form['id'],
					'title'                   => $form['title'],
					'type'                    => $form['type'],
					'status'                  => $form['status'],
					'has_unpublished_changes' => $form['has_unpublished_changes'],
					'updated_at'              => $form['updated_at'],
					'time_ago'                => $this->timeAgo( $form['updated_at'] ),
					'submission_count'        => $submissionCount,
				);
			},
			$forms
		);
	}

	/**
	 * Get system health information
	 *
	 * @return array
	 */
	private function getSystemHealth() {
		global $wpdb;

		$health = array(
			'plugin_version'    => defined( 'SUBTLEFORMS_VERSION' ) ? SUBTLEFORMS_VERSION : '1.0.0',
			'wordpress_version' => get_bloginfo( 'version' ),
			'php_version'       => PHP_VERSION,
			'database_version'  => $wpdb->db_version(),
			'debug_mode'        => $this->settings ? $this->settings->get( 'debug_mode', false ) : false,
			'autosave_enabled'  => $this->settings ? $this->settings->get( 'autosave_enabled', true ) : true,
			'memory_limit'      => ini_get( 'memory_limit' ),
			'max_upload_size'   => size_format( wp_max_upload_size() ),
		);

		// Check if database tables exist
		$formsTable       = $wpdb->prefix . 'subtleforms_forms';
		$submissionsTable = $wpdb->prefix . 'subtleforms_submissions';

		$health['tables_exist'] = array(
			'forms'       => $wpdb->get_var( "SHOW TABLES LIKE '{$formsTable}'" ) === $formsTable, // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is $wpdb->prefix controlled.
			'submissions' => $wpdb->get_var( "SHOW TABLES LIKE '{$submissionsTable}'" ) === $submissionsTable, // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is $wpdb->prefix controlled.
		);

		// Overall health status
		$allTablesExist = $health['tables_exist']['forms'] && $health['tables_exist']['submissions'];
		$phpVersionOk   = version_compare( PHP_VERSION, '7.4', '>=' );

		$health['status'] = ( $allTablesExist && $phpVersionOk ) ? 'healthy' : 'warning';

		return $health;
	}

	/**
	 * Convert timestamp to human-readable time ago
	 *
	 * @param string $datetime MySQL datetime string
	 * @return string
	 */
	private function timeAgo( $datetime ) {
		$timestamp = strtotime( $datetime );
		// Rows written before 2.0 may hold server-local times; never show a
		// negative age for them.
		$diff      = max( 0, time() - $timestamp );

		if ( $diff < 60 ) {
			/* translators: %d: number of seconds */
			return sprintf( _n( '%d second ago', '%d seconds ago', $diff, 'subtleforms' ), $diff );
		} elseif ( $diff < 3600 ) {
			$minutes = (int) floor( $diff / 60 );
			/* translators: %d: number of minutes */
			return sprintf( _n( '%d minute ago', '%d minutes ago', $minutes, 'subtleforms' ), $minutes );
		} elseif ( $diff < 86400 ) {
			$hours = (int) floor( $diff / 3600 );
			/* translators: %d: number of hours */
			return sprintf( _n( '%d hour ago', '%d hours ago', $hours, 'subtleforms' ), $hours );
		} elseif ( $diff < 604800 ) {
			$days = (int) floor( $diff / 86400 );
			/* translators: %d: number of days */
			return sprintf( _n( '%d day ago', '%d days ago', $days, 'subtleforms' ), $days );
		} else {
			// Respect the site's WordPress date format (Settings → General)
			// so the Dashboard agrees with All Forms — one date helper
			// everywhere (Part B8). Falls back to 'M j, Y' when no format is
			// configured (e.g. unit tests without WP loaded).
			$format = function_exists( 'get_option' ) ? get_option( 'date_format' ) : '';
			if ( $format && function_exists( 'wp_date' ) ) {
				return wp_date( $format, $timestamp );
			}
			if ( $format && function_exists( 'date_i18n' ) ) {
				return date_i18n( $format, $timestamp );
			}
			return gmdate( 'M j, Y', $timestamp );
		}
	}

	/**
	 * Guard rate limit for request (Phase A3-P1)
	 *
	 * @param WP_REST_Request $request Request object.
	 * @return WP_REST_Response|null Error response if rate limited, null if allowed.
	 */
	private function guardRateLimit( WP_REST_Request $request ): ?WP_REST_Response {
		$userId = get_current_user_id() ?: null;
		$ip     = isset( $_SERVER['REMOTE_ADDR'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) )
			: '0.0.0.0';
		$route  = $request->get_route();
		$method = $request->get_method();

		$policy = RateLimiter::policy( $route, $method );
		$key    = RateLimiter::buildKey( $route, $method, $userId, $ip );
		$result = RateLimiter::check( $key, $policy['limit'], $policy['window'] );

		if ( ! $result['allowed'] ) {
			$headers = RateLimiter::headers( $result, $policy['limit'] );
			return ApiResponse::rate_limited(
				__( 'Too many requests. Please try again later.', 'subtleforms' ),
				$result['retry_after'],
				array(),
				$headers
			);
		}

		return null;
	}

	/**
	 * Check permissions
	 *
	 * @param \WP_REST_Request $request Incoming request.
	 * @return true|\WP_Error
	 */
	public function checkPermissions( \WP_REST_Request $request ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new \WP_Error(
				'subtleforms_forbidden',
				__( 'You are not allowed to perform this action.', 'subtleforms' ),
				array( 'status' => 403 )
			);
		}

		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new \WP_Error(
				'subtleforms_invalid_nonce',
				__( 'Security check failed. Please refresh and try again.', 'subtleforms' ),
				array( 'status' => 403 )
			);
		}

		return true;
	}

	/**
	 * Clear dashboard stats cache (called when forms or submissions change)
	 * v1.7.0: Performance optimization - invalidate cache on data changes
	 */
	public static function clearStatsCache() {
		delete_transient( 'subtleforms_dashboard_stats' );
		delete_transient( 'subtleforms_dashboard_stats_v2' );
	}
}
