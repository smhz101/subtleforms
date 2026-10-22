<?php
/**
 * Blocked spam counts and the spam protection offer (2.6.0).
 *
 * GET  /spam/stats                  Blocked spam over the last N days, for the site or one form.
 * GET  /spam/protection             Whether the dashboard offers to turn protection on.
 * POST /spam/protection/enable-all  Turn the hidden trap field and the time trap on everywhere.
 * POST /spam/protection/undo        Put back what enable-all changed.
 * POST /spam/protection/dismiss     Hide the offer.
 *
 * Site administrators only (manage_options and a REST nonce).
 *
 * @package SubtleForms\Api
 * @since   2.6.0
 */

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Analytics\SpamStats;
use SubtleForms\Engine\SpamProtection;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\SpamDefaults;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Spam REST routes.
 */
final class SpamApi {

	use ApiGuards;

	private const NAMESPACE = 'subtleforms/v1';

	/** @var FormsRepository */
	private $forms;

	/** @var FeatureGate */
	private $gate;

	/**
	 * @param FormsRepository $forms Forms.
	 * @param FeatureGate     $gate  Gate.
	 */
	public function __construct( FormsRepository $forms, FeatureGate $gate ) {
		$this->forms = $forms;
		$this->gate  = $gate;
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
			'/spam/stats',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'stats' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
				'args'                => array(
					'days'    => array(
						'type'              => 'integer',
						'default'           => 30,
						'minimum'           => 1,
						'maximum'           => SpamStats::MAX_DAYS,
						'sanitize_callback' => 'absint',
					),
					'form_id' => array(
						'type'              => 'integer',
						'default'           => 0,
						'minimum'           => 0,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/spam/protection',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'protection' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		foreach ( array( 'enable-all' => 'enableAll', 'undo' => 'undo', 'dismiss' => 'dismiss' ) as $path => $method ) {
			register_rest_route(
				self::NAMESPACE,
				'/spam/protection/' . $path,
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, $method ),
					'permission_callback' => array( $this, 'check_write_permission' ),
				)
			);
		}
	}

	/**
	 * Blocked spam for the site, or for one form with its protection.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function stats( WP_REST_Request $request ): WP_REST_Response {
		$days   = max( 1, min( SpamStats::MAX_DAYS, (int) $request->get_param( 'days' ) ) );
		$formId = (int) $request->get_param( 'form_id' );
		if ( $formId > 0 && ! $this->forms->find( $formId ) ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		$data = array_merge(
			SpamStats::summary( $days, $formId > 0 ? $formId : null ),
			array( 'period_days' => $days )
		);

		if ( $formId > 0 ) {
			// What a form without its own choice uses, so the settings screen
			// shows the switches as they really work.
			$fallback            = SpamProtection::for_form( null );
			$data['form_id']     = $formId;
			$data['fallback']    = array(
				'honeypot' => $fallback['honeypot'],
				'timeTrap' => $fallback['timeTrap'],
			);
			$data['min_seconds'] = $fallback['minSeconds'];
		}

		return ApiResponse::success( $data );
	}

	/**
	 * Whether the dashboard offers to turn protection on.
	 *
	 * @return WP_REST_Response
	 */
	public function protection(): WP_REST_Response {
		return ApiResponse::success( SpamDefaults::status() );
	}

	/**
	 * Turn protection on for every form.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function enableAll( WP_REST_Request $request ): WP_REST_Response {
		$limited = $this->guardRateLimit( $request );
		if ( $limited ) {
			return $limited;
		}
		$changed = SpamDefaults::enableAll();
		return ApiResponse::success( array_merge( SpamDefaults::status(), array( 'changed' => $changed ) ) );
	}

	/**
	 * Put back what enable-all changed.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function undo( WP_REST_Request $request ): WP_REST_Response {
		$limited = $this->guardRateLimit( $request );
		if ( $limited ) {
			return $limited;
		}
		$restored = SpamDefaults::undo();
		return ApiResponse::success( array_merge( SpamDefaults::status(), array( 'restored' => $restored ) ) );
	}

	/**
	 * Hide the offer.
	 *
	 * @return WP_REST_Response
	 */
	public function dismiss(): WP_REST_Response {
		SpamDefaults::dismiss();
		return ApiResponse::success( SpamDefaults::status() );
	}
}
