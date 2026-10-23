<?php
/**
 * Report totals: forms, entries and a seven day chart of entries.
 *
 * Views, conversion and the form funnel are provided by SubtleForms Pro.
 *
 * @package SubtleForms\Api
 */

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Tools\ReportSeries;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Free report totals.
 */
final class ReportsApi {

	use ApiGuards;

	private const NAMESPACE = 'subtleforms/v1';

	/** @var FormsRepository */
	private $forms;

	/** @var SubmissionsRepository */
	private $submissions;

	/** @var FeatureGate */
	private $gate;

	/**
	 * @param FormsRepository       $forms Forms.
	 * @param SubmissionsRepository $submissions Submissions.
	 * @param FeatureGate           $gate Gate.
	 */
	public function __construct( FormsRepository $forms, SubmissionsRepository $submissions, FeatureGate $gate ) {
		$this->forms       = $forms;
		$this->submissions = $submissions;
		$this->gate        = $gate;
	}

	/**
	 * @return FeatureGate
	 */
	protected function getGate(): FeatureGate {
		return $this->gate;
	}

	/**
	 * Register routes.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/reports/overview',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'overview' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);
	}

	/**
	 * Form and submission totals, plus submissions for the last 7 days.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function overview( WP_REST_Request $request ): WP_REST_Response {
		unset( $request );
		global $wpdb;
		$table = $wpdb->prefix . 'subtleforms_submissions';
		$zone  = ReportSeries::siteZone();
		$start = ReportSeries::start( 7, null, $zone );
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		// Only real entries count: spam, failed and trashed entries do not.
		$counted = ReportSeries::COUNTED_STATUSES;
		$in      = implode( ',', array_fill( 0, count( $counted ), '%s' ) );
		$rows    = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT created_at FROM {$table} WHERE created_at >= %s AND ( status IS NULL OR status IN ({$in}) )",
				array_merge( array( $start ), $counted )
			)
		);
		$total   = (int) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT COUNT(*) FROM {$table} WHERE status IS NULL OR status IN ({$in})",
				$counted
			)
		);
		// phpcs:enable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$counts = ReportSeries::countByLocalDay( (array) $rows, $zone );
		$forms = array();
		foreach ( (array) $this->forms->all( array( 'limit' => 100, 'orderby' => 'title', 'order' => 'ASC' ) ) as $form ) {
			$forms[] = array(
				'id'    => (int) ( $form['id'] ?? 0 ),
				'title' => (string) ( $form['title'] ?? '' ),
			);
		}
		return ApiResponse::success(
			array(
				'total_forms'        => $this->forms->count(),
				'total_submissions'  => $total,
				'unread_submissions' => $this->submissions->count( array( 'is_read' => 0 ) ),
				'series'             => ReportSeries::fillDays( $counts, 7, ReportSeries::today( $zone ) ),
				'forms'              => $forms,
			)
		);
	}
}
