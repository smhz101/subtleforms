<?php
/**
 * Form completion funnel REST API.
 *
 * - POST /forms/{id}/funnel  Public beacon: a visitor left a form they started.
 * - GET  /analytics/funnel   Seen, started, submitted and where people stopped.
 *
 * The beacon carries a field key and a step number, never an answer. Anything
 * the published form does not have is ignored, and each network address may
 * only report a few times per form (the address is hashed, never stored).
 *
 * @package SubtleForms\Api
 * @since   2.6.0
 */

namespace SubtleForms\Api;

use SubtleForms\Analytics\Funnel;
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
 * Funnel endpoints.
 */
final class FunnelApi {

	const NAMESPACE = 'subtleforms/v1';

	/** Reports one network address may send per form per window. */
	const BEACON_LIMIT = 20;

	/** Rate limit window, in seconds. */
	const BEACON_WINDOW = 600;

	/** Reports one network address may send for all forms per window. */
	const IP_LIMIT = 60;

	/** Window of the all-forms limit, in seconds. */
	const IP_WINDOW = 600;

	/** Date range presets offered in the report. */
	const PRESETS = array( 7, 30, 90 );

	/**
	 * Register routes.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/forms/(?P<form_id>\d+)/funnel',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'record' ),
				// Visitors have no REST nonce (pages may be cached). The
				// report is limited per address and to published forms.
				'permission_callback' => '__return_true',
				'args'                => array(
					'form_id' => array(
						'type'              => 'integer',
						'required'          => true,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/analytics/funnel',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'report' ),
				'permission_callback' => array( $this, 'checkAdmin' ),
				'args'                => array(
					'form_id' => array(
						'type'              => 'integer',
						'required'          => true,
						'minimum'           => 1,
						'sanitize_callback' => 'absint',
					),
					'days'    => array(
						'type'              => 'integer',
						'default'           => 30,
						'minimum'           => 1,
						'maximum'           => Stats::MAX_DAYS,
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	/**
	 * Reports are for people who manage SubtleForms.
	 *
	 * @return true|WP_Error
	 */
	public function checkAdmin() {
		if ( ! current_user_can( ( new \SubtleForms\Support\Capabilities() )->manage_cap() ) ) {
			return new WP_Error( 'subtleforms_forbidden', __( 'You are not allowed to perform this action.', 'subtleforms' ), array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * Record a visitor leaving a form.
	 *
	 * Parameters (form encoded, from navigator.sendBeacon):
	 * - a:  drop (left the form), move (left again at another field after an
	 *       earlier report) or undo (sent the form after an earlier report).
	 * - f, s:   field key and step index where the visitor left.
	 * - pf, ps: field key and step index of the earlier report.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function record( WP_REST_Request $request ): WP_REST_Response {
		$formId = (int) $request->get_param( 'form_id' );
		$action = (string) $request->get_param( 'a' );

		if ( ! in_array( $action, array( 'drop', 'move', 'undo' ), true ) ) {
			return new WP_REST_Response( array( 'tracked' => false ), 400 );
		}

		if ( ! Funnel::tracks() || Funnel::skipsCurrentUser() ) {
			return new WP_REST_Response( array( 'tracked' => false ), 200 );
		}

		$agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
		if ( Funnel::isBot( $agent ) ) {
			return new WP_REST_Response( array( 'tracked' => false ), 200 );
		}

		// The form comes first: a made-up form ID must not create a rate
		// limit record of its own.
		$repo = new FormsRepository();
		$form = $repo->find( $formId );
		if ( ! $form || ( $form['status'] ?? '' ) !== 'published' ) {
			return new WP_REST_Response( array( 'tracked' => false ), 404 );
		}

		// Rate limit by a salted hash of the address, for any form and for
		// this form; the address itself is never stored.
		$ip      = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		$overall = RateLimiter::check( self::bucket( $ip, 0 ), self::IP_LIMIT, self::IP_WINDOW );
		$result  = empty( $overall['allowed'] ) ? $overall : RateLimiter::check( self::bucket( $ip, $formId ), self::BEACON_LIMIT, self::BEACON_WINDOW );
		if ( empty( $result['allowed'] ) ) {
			return new WP_REST_Response( array( 'tracked' => false ), 429 );
		}

		try {
			$version = $repo->loadSchemaVersion( $formId );
		} catch ( \Throwable $e ) {
			$version = null;
		}
		$schema = is_array( $version ) ? ( $version['schema'] ?? $version ) : null;
		if ( ! Stats::formAllows( $schema ) ) {
			return new WP_REST_Response( array( 'tracked' => false ), 200 );
		}

		// Only keys of the published form are kept; anything else counts as
		// "left somewhere on the form".
		$fields = Funnel::fieldLabels( $schema );

		if ( 'move' === $action || 'undo' === $action ) {
			Funnel::undoDrop(
				$formId,
				Funnel::knownKey( $request->get_param( 'pf' ), $fields ),
				Funnel::stepIndex( $request->get_param( 'ps' ) )
			);
		}
		if ( 'drop' === $action || 'move' === $action ) {
			Funnel::recordDrop(
				$formId,
				Funnel::knownKey( $request->get_param( 'f' ), $fields ),
				Funnel::stepIndex( $request->get_param( 's' ) )
			);
		}

		return new WP_REST_Response( array( 'tracked' => true ), 200 );
	}

	/**
	 * Rate limit bucket for an address and a form. The address is hashed
	 * with a site secret and only lives in a short transient.
	 *
	 * @param string $ip     Network address.
	 * @param int    $formId Form ID.
	 */
	public static function bucket( string $ip, int $formId ): string {
		return 'subtleforms_rl_funnel_' . substr( hash_hmac( 'sha256', $ip . '|' . $formId, wp_salt( 'nonce' ) ), 0, 24 );
	}

	/**
	 * The funnel for one form.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function report( WP_REST_Request $request ): WP_REST_Response {
		$formId = (int) $request->get_param( 'form_id' );
		$days   = max( 1, min( Stats::MAX_DAYS, (int) $request->get_param( 'days' ) ) );

		$repo = new FormsRepository();
		$form = $repo->find( $formId );
		if ( ! $form ) {
			return ApiResponse::not_found( __( 'Form not found', 'subtleforms' ) );
		}

		try {
			$version = $repo->loadSchemaVersion( $formId );
		} catch ( \Throwable $e ) {
			$version = null;
		}
		$schema = is_array( $version ) ? ( $version['schema'] ?? $version ) : null;

		return ApiResponse::success(
			array_merge(
				array(
					'form_id'      => $formId,
					'days'         => $days,
					'since'        => Stats::since( $days ),
					'tracking'     => Funnel::tracks(),
					'form_tracked' => Stats::formAllows( $schema ),
				),
				Funnel::report( $formId, $days, $schema )
			)
		);
	}
}
