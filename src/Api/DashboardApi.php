<?php

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) { exit; }

use SubtleForms\Admin\OverviewData;
use SubtleForms\Api\ApiResponse;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Tools\ReportSeries;
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
			// One call, one cache: the figures, the chart (90 days, the page
			// shows 7, 30 or 90), what needs attention, recent entries, top
			// forms and the Getting started list.
			$data                 = OverviewData::snapshot( $this->formsRepo, $this->submissionsRepo );
			$data['recent_forms'] = $this->getRecentForms();
			$data['system_health'] = $this->getSystemHealth();

			/**
			 * Filter the dashboard figures before they are sent. Add-ons add
			 * their own keys (for example `attention` rows) for their slots.
			 *
			 * @param array $data Dashboard data.
			 * @since 2.7.5
			 */
			$data = (array) apply_filters( 'subtleforms/dashboard/data', $data );

			return ApiResponse::success( $data );
		} catch ( \Exception $e ) {
			return ApiResponse::server_error( $e->getMessage() );
		}
	}

	/**
	 * Rows fetched per query while collecting forms for the performance selector.
	 *
	 * This is a page size, not a cap. Collection continues until a short page.
	 */
	public const PERFORMANCE_FORM_BATCH = 100;

	/**
	 * Every accessible non-trashed form, most recently updated first.
	 *
	 * FormsRepository::all() excludes trash when status is omitted, so the
	 * performance selector can reach older forms. The dashboard recent list
	 * still reads the front of this same order.
	 *
	 * @param callable $fetch function( array $args ): array Page from the forms repository.
	 * @return array
	 */
	public static function collectPerformanceForms( callable $fetch ): array {
		$forms  = array();
		$offset = 0;
		$batch  = self::PERFORMANCE_FORM_BATCH;

		do {
			$page = $fetch(
				array(
					'limit'   => $batch,
					'offset'  => $offset,
					'orderby' => 'updated_at',
					'order'   => 'DESC',
				)
			);

			if ( ! is_array( $page ) || array() === $page ) {
				break;
			}

			foreach ( $page as $form ) {
				$forms[] = $form;
			}

			$offset += count( $page );
		} while ( self::PERFORMANCE_FORM_BATCH === count( $page ) );

		return $forms;
	}

	/**
	 * Forms for the dashboard recent list and the performance selector.
	 *
	 * @return array
	 */
	private function getRecentForms() {
		$forms = self::collectPerformanceForms(
			function ( array $args ) {
				return $this->formsRepo->all( $args );
			}
		);

		$ids    = array_map( 'intval', array_column( $forms, 'id' ) );
		$counts = $this->submissionsRepo->get_counts_by_forms( $ids );

		return array_map(
			function ( $form ) use ( $counts ) {
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
					'submission_count'        => $counts[ (int) $form['id'] ] ?? 0,
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
			// so the Dashboard agrees with All Forms, one date helper
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
		$ip     = \SubtleForms\Security\ClientIp::get() ?: '0.0.0.0';
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

		$nonce = sanitize_text_field( wp_unslash( (string) $request->get_header( 'X-WP-Nonce' ) ) );
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
		delete_transient( OverviewData::cacheKey( 'snapshot' ) );
	}
}
