<?php
/**
 * Fresh-install import offer (2.7.2).
 *
 * GET  /import-offer          Whether to show the modal or notice, and sources.
 * POST /import-offer/dismiss  Body { action: 'defer'|'dismiss' }.
 *
 * Site administrators only (manage_options and a REST nonce).
 *
 * @package SubtleForms\Api
 * @since   2.7.2
 */

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\ImportOffer;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Import offer REST routes.
 */
final class ImportOfferApi {

	use ApiGuards;

	private const NAMESPACE = 'subtleforms/v1';

	/** @var FeatureGate */
	private $gate;

	/**
	 * @param FeatureGate $gate Gate.
	 */
	public function __construct( FeatureGate $gate ) {
		$this->gate = $gate;
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
			'/import-offer',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'getOffer' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/import-offer/dismiss',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'dismiss' ),
				'permission_callback' => array( $this, 'check_write_permission' ),
			)
		);
	}

	/**
	 * Current offer state and detected sources.
	 *
	 * @return WP_REST_Response
	 */
	public function getOffer(): WP_REST_Response {
		return ApiResponse::success( ImportOffer::status() );
	}

	/**
	 * Defer (show notice) or dismiss the offer.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function dismiss( WP_REST_Request $request ): WP_REST_Response {
		$limited = $this->guardRateLimit( $request );
		if ( $limited ) {
			return $limited;
		}

		$action = $request->get_param( 'action' );
		if ( ! is_string( $action ) || '' === $action ) {
			$body = $request->get_json_params();
			if ( is_array( $body ) && isset( $body['action'] ) ) {
				$action = $body['action'];
			}
		}
		$action = sanitize_key( (string) $action );
		if ( 'defer' === $action ) {
			ImportOffer::defer();
		} elseif ( 'dismiss' === $action ) {
			ImportOffer::dismiss();
		} else {
			return ApiResponse::bad_request(
				__( 'Action must be defer or dismiss.', 'subtleforms' )
			);
		}

		return ApiResponse::success( ImportOffer::status() );
	}
}
