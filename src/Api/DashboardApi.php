<?php

namespace SubtleForms\Api;

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
				'system_health'      => $this->getSystemHealth(),
			);

			return ApiResponse::success(
				array(
					'success' => true,
					'data'    => $data,
				)
			);
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
		$cache_key = 'subtleforms_dashboard_stats';
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
		$submissionsToday = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$submissionsTable} WHERE created_at >= %s",
				$todayStart
			)
		);

		// Submissions this week (last 7 days)
		$weekStart           = gmdate( 'Y-m-d 00:00:00', strtotime( '-7 days' ) );
		$submissionsThisWeek = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$submissionsTable} WHERE created_at >= %s",
				$weekStart
			)
		);

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
		);

		// Cache for 5 minutes
		set_transient( $cache_key, $stats, 5 * MINUTE_IN_SECONDS );

		return $stats;
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

		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT s.id, s.form_id, s.status, s.created_at, f.title as form_title
             FROM {$submissionsTable} s
             LEFT JOIN {$formsTable} f ON s.form_id = f.id
             ORDER BY s.created_at DESC
             LIMIT %d",
				10
			),
			ARRAY_A
		);

		return array_map(
			function ( $row ) {
				return array(
					'id'         => (int) $row['id'],
					'form_id'    => (int) $row['form_id'],
					'form_title' => $row['form_title'] ?? __( 'Unknown Form', 'subtleforms' ),
					'status'     => $row['status'],
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

				return array(
					'id'               => $form['id'],
					'title'            => $form['title'],
					'status'           => $form['status'],
					'updated_at'       => $form['updated_at'],
					'time_ago'         => $this->timeAgo( $form['updated_at'] ),
					'submission_count' => $submissionCount,
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
			'forms'       => $wpdb->get_var( "SHOW TABLES LIKE '{$formsTable}'" ) === $formsTable,
			'submissions' => $wpdb->get_var( "SHOW TABLES LIKE '{$submissionsTable}'" ) === $submissionsTable,
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
		$diff      = time() - $timestamp;

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
	}
}
