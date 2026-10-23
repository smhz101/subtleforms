<?php

/**
 * SubtleForms appearance REST API.
 *
 * @package SubtleForms\Api
 * @since   2.7.2
 */

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Support\FeatureGate;
use SubtleForms\Support\ThemeStyles;
use WP_REST_Request;
use WP_REST_Response;

/**
 * What the active theme offers a form: its colour palette, fonts, font sizes
 * and button look. Same permission as every other builder route.
 */
final class AppearanceApi {

	use ApiGuards;

	private const NAMESPACE = 'subtleforms/v1';

	/** @var FeatureGate */
	private $gate;

	public function __construct( FeatureGate $gate ) {
		$this->gate = $gate;
	}

	protected function getGate(): FeatureGate {
		return $this->gate;
	}

	/**
	 * Register REST API routes.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			self::NAMESPACE,
			'/appearance/theme',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_theme' ),
				'permission_callback' => array( $this, 'check_read_permission' ),
			)
		);
	}

	/**
	 * GET /appearance/theme.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function get_theme( WP_REST_Request $request ): WP_REST_Response {
		$limited = $this->guardRateLimit( $request );
		if ( $limited ) {
			return $limited;
		}
		return ApiResponse::success( ThemeStyles::get() );
	}
}
