<?php
/**
 * Analytics REST API.
 *
 * - POST /forms/{id}/view       Public view beacon (nonce checked, rate limited).
 * - GET  /analytics/summary     Views, submissions and conversion per form.
 * - GET  /analytics/series      Daily views and submissions, all forms or one.
 * - GET  /analytics/{id}        Legacy totals for one form.
 *
 * Reports require the `extensions.analytics` capability (SubtleForms Pro).
 *
 * @package SubtleForms\Api
 * @since   2.1.0
 */

namespace SubtleForms\Api;

use SubtleForms\Analytics\Stats;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Security\RateLimiter;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Analytics endpoints.
 */
final class AnalyticsApi {

	const NAMESPACE = 'subtleforms/v1';

	/** Views a single network address may report per window. */
	const BEACON_LIMIT = 60;

	/** Rate limit window, in seconds. */
	const BEACON_WINDOW = 600;

	/**
	 * Register routes.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/forms/(?P<form_id>\d+)/view',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'recordView' ),
				'permission_callback' => array( $this, 'checkBeaconNonce' ),
				'args'                => array(
					'form_id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		$days = array(
			'type'              => 'integer',
			'default'           => 30,
			'minimum'           => 1,
			'maximum'           => Stats::MAX_DAYS,
			'sanitize_callback' => 'absint',
		);

		register_rest_route(
			self::NAMESPACE,
			'/analytics/summary',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'summary' ),
				'permission_callback' => array( $this, 'checkAdmin' ),
				'args'                => array( 'days' => $days ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/analytics/series',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'series' ),
				'permission_callback' => array( $this, 'checkAdmin' ),
				'args'                => array(
					'days'    => $days,
					'form_id' => array(
						'type'              => 'integer',
						'default'           => 0,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/analytics/(?P<form_id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'legacyTotals' ),
				'permission_callback' => array( $this, 'checkAdmin' ),
				'args'                => array(
					'form_id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	// ── Permissions ───────────────────────────────────────────────────────

	/**
	 * Anyone may report a view: visitors have no REST nonce.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 */
	public function checkBeaconNonce( WP_REST_Request $request ) {
		// Visitors get no REST nonce (pages may be cached), so a view needs
		// none. The count is limited per address and only for published forms.
		return true;
	}

	/**
	 * Reports are for site managers.
	 *
	 * @return true|WP_Error
	 */
	public function checkAdmin() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'subtleforms_forbidden', __( 'You are not allowed to perform this action.', 'subtleforms' ), array( 'status' => 403 ) );
		}
		return true;
	}

	// ── Beacon ────────────────────────────────────────────────────────────

	/**
	 * Count one view.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function recordView( WP_REST_Request $request ): WP_REST_Response {
		$formId = (int) $request->get_param( 'form_id' );

		if ( ! Stats::tracksViews() ) {
			return new WP_REST_Response( array( 'tracked' => false ), 200 );
		}

		// Rate limit by a salted hash of the address; the address itself is
		// never stored.
		$ip     = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		$bucket = 'subtleforms_rl_view_' . substr( md5( wp_salt( 'nonce' ) . '|' . $ip ), 0, 20 );
		$result = RateLimiter::check( $bucket, self::BEACON_LIMIT, self::BEACON_WINDOW );
		if ( empty( $result['allowed'] ) ) {
			return new WP_REST_Response( array( 'tracked' => false ), 429 );
		}

		$repo = new FormsRepository();
		$form = $repo->find( $formId );
		if ( ! $form || ( $form['status'] ?? '' ) !== 'published' ) {
			return new WP_REST_Response( array( 'tracked' => false ), 404 );
		}

		try {
			$schema = $repo->loadSchemaVersion( $formId );
		} catch ( \Throwable $e ) {
			$schema = null;
		}
		if ( ! Stats::formAllows( is_array( $schema ) ? ( $schema['schema'] ?? $schema ) : null ) ) {
			return new WP_REST_Response( array( 'tracked' => false ), 200 );
		}

		Stats::increment( $formId, 'views' );

		return new WP_REST_Response( array( 'tracked' => true ), 200 );
	}

	// ── Reports ───────────────────────────────────────────────────────────

	/**
	 * Views, submissions and conversion for every form.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function summary( WP_REST_Request $request ) {
		$days   = max( 1, min( Stats::MAX_DAYS, (int) $request->get_param( 'days' ) ) );
		$totals = Stats::totalsByForm( $days );

		$forms     = array();
		$allViews  = 0;
		$allSubs   = 0;
		foreach ( $totals as $formId => $row ) {
			$allViews        += $row['views'];
			$allSubs         += $row['submissions'];
			$forms[ $formId ] = array(
				'form_id'     => $formId,
				'views'       => $row['views'],
				'submissions' => $row['submissions'],
				'conversion'  => Stats::conversion( $row['views'], $row['submissions'] ),
			);
		}

		return ApiResponse::success(
			array(
				'days'   => $days,
				'since'  => Stats::since( $days ),
				'forms'  => (object) $forms,
				'totals' => array(
					'views'       => $allViews,
					'submissions' => $allSubs,
					'conversion'  => Stats::conversion( $allViews, $allSubs ),
				),
			)
		);
	}

	/**
	 * Daily series.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function series( WP_REST_Request $request ) {
		$days   = max( 1, min( Stats::MAX_DAYS, (int) $request->get_param( 'days' ) ) );
		$formId = (int) $request->get_param( 'form_id' );
		$series = Stats::series( $days, $formId > 0 ? $formId : null );

		$views = array_sum( array_column( $series, 'views' ) );
		$subs  = array_sum( array_column( $series, 'submissions' ) );

		return ApiResponse::success(
			array(
				'days'    => $days,
				'form_id' => $formId,
				'series'  => $series,
				'totals'  => array(
					'views'       => $views,
					'submissions' => $subs,
					'conversion'  => Stats::conversion( $views, $subs ),
				),
			)
		);
	}

	/**
	 * Pre-2.1 shape: { form_id, views, submissions } over the retention period.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function legacyTotals( WP_REST_Request $request ) {
		$formId = (int) $request->get_param( 'form_id' );
		$totals = Stats::totalsByForm( Stats::MAX_DAYS );

		return new WP_REST_Response(
			array(
				'form_id'     => $formId,
				'views'       => $totals[ $formId ]['views'] ?? 0,
				'submissions' => $totals[ $formId ]['submissions'] ?? 0,
			),
			200
		);
	}
}
