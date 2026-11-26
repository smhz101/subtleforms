<?php
/**
 * Read-only Extensions catalog route.
 *
 * @package SubtleForms\Api
 */

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Admin\AdminMenu;
use SubtleForms\Extensions\Catalog;
use SubtleForms\Support\Capabilities;
use WP_REST_Response;

/**
 * GET subtleforms/v1/extensions.
 */
final class ExtensionsApi {

	/**
	 * Register routes.
	 */
	public function registerRoutes(): void {
		register_rest_route(
			'subtleforms/v1',
			'/extensions',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'index' ),
				'permission_callback' => array( $this, 'checkPermission' ),
			)
		);
	}

	/**
	 * @return true|\WP_Error
	 */
	public function checkPermission() {
		if ( current_user_can( ( new Capabilities() )->manage_cap() ) ) {
			return true;
		}
		return new \WP_Error(
			'subtleforms_forbidden',
			__( 'You are not allowed to perform this action.', 'subtleforms' ),
			array( 'status' => rest_authorization_required_code() )
		);
	}

	/**
	 * @return WP_REST_Response
	 */
	public function index(): WP_REST_Response {
		return ApiResponse::success(
			array(
				'entries'    => Catalog::entries(),
				'categories' => Catalog::categories(),
				'hasAddon'   => AdminMenu::companion_active(),
			)
		);
	}
}
