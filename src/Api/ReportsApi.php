<?php
/**
 * Report totals: forms, entries and a seven day chart of entries.
 *
 * Add-ons can add their own panels to the Reports screen.
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
use SubtleForms\Tools\ReportData;
use SubtleForms\Tools\ReportQueries;
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
		register_rest_route(
			self::NAMESPACE,
			'/reports',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'report' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
				'args'                => array(
					'from'    => array(
						'type'     => 'string',
						'required' => false,
					),
					'to'      => array(
						'type'     => 'string',
						'required' => false,
					),
					'form_id' => array(
						'type'     => 'integer',
						'required' => false,
						'minimum'  => 0,
					),
				),
			)
		);
	}

	/**
	 * Entries per day for a date range with the range before it, a breakdown
	 * per form and, for one form, how its choice and rating fields were
	 * answered. Kept for a minute per set of arguments; a new entry ends the
	 * wait.
	 *
	 * @param WP_REST_Request $request Request: from, to (Y-m-d, site zone), form_id.
	 * @return WP_REST_Response
	 */
	public function report( WP_REST_Request $request ): WP_REST_Response {
		$zone  = ReportSeries::siteZone();
		$today = ReportSeries::today( $zone );
		$from  = $request->get_param( 'from' );
		$to    = $request->get_param( 'to' );
		$to    = null === $to || '' === $to ? $today : $to;
		$from  = null === $from || '' === $from ? ReportQueries::addDays( (string) $to, -29 ) : $from;

		if ( ! ReportData::validDate( $from ) || ! ReportData::validDate( $to ) ) {
			return ApiResponse::validation_error( __( 'Dates must look like 2026-10-31.', 'subtleforms' ), array( 'from' => 'invalid' ) );
		}
		if ( $from > $to ) {
			return ApiResponse::validation_error( __( 'The start date must not be after the end date.', 'subtleforms' ), array( 'from' => 'after_to' ) );
		}
		if ( ReportData::dayCount( $from, $to ) > ReportData::MAX_DAYS ) {
			return ApiResponse::validation_error(
				/* translators: %d: most days */
				sprintf( __( 'A report covers at most %d days.', 'subtleforms' ), ReportData::MAX_DAYS ),
				array( 'to' => 'too_long' )
			);
		}
		$form_id = max( 0, (int) $request->get_param( 'form_id' ) );
		if ( $form_id > 0 && ! $this->forms->find( $form_id ) ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		$key  = \SubtleForms\Admin\OverviewData::cacheKey( 'report_' . md5( $from . '|' . $to . '|' . $form_id . '|' . $today ) );
		$data = get_transient( $key );
		if ( ! is_array( $data ) ) {
			$data = ReportData::build( $from, $to, $form_id, $this->forms );
			set_transient( $key, $data, ReportData::TTL );
		}
		return ApiResponse::success( $data );
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
