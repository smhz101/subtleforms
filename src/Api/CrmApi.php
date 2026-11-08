<?php
/**
 * CRM connections and lookups for Settings and the form builder.
 *
 * An access token is saved by POST /integrations/crm/{service}/connect and is
 * never sent back: every answer carries only the last four characters.
 *
 * @package SubtleForms
 * @since   2.8.1
 */

declare(strict_types=1);

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Integrations\Crm\HubSpotClient;
use SubtleForms\Integrations\Crm\Services;
use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Integrations\EmailMarketing\ServiceException;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Routes under /subtleforms/v1/integrations/crm. Administrators only.
 */
final class CrmApi {

	/** Seconds the property list is kept. */
	const CACHE_TTL = 10 * MINUTE_IN_SECONDS;

	/** User meta that remembers a dismissed Pro note. */
	const BANNER_META = 'subtleforms_crm_banner_dismissed';

	/**
	 * Register the routes.
	 */
	public function registerRoutes(): void {
		$base    = '/integrations/crm';
		$perm    = array( $this, 'checkPermissions' );
		$service = '/(?P<service>' . implode( '|', array_map( 'preg_quote', Services::slugs() ) ) . ')';

		register_rest_route(
			'subtleforms/v1',
			$base,
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'index' ),
				'permission_callback' => $perm,
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . '/banner/dismiss',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'dismissBanner' ),
				'permission_callback' => $perm,
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . $service,
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'state' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( $this, 'disconnect' ),
					'permission_callback' => $perm,
				),
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . $service . '/enabled',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'setEnabled' ),
				'permission_callback' => $perm,
				'args'                => array(
					'enabled' => array(
						'type'     => 'boolean',
						'required' => true,
					),
				),
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . $service . '/connect',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'connect' ),
				'permission_callback' => $perm,
				'args'                => array(
					'token' => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . $service . '/test',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'test' ),
				'permission_callback' => $perm,
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . $service . '/properties',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'properties' ),
				'permission_callback' => $perm,
				'args'                => array(
					'refresh' => array( 'type' => 'boolean' ),
				),
			)
		);
	}

	/**
	 * Administrators only, with the REST nonce.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 */
	public function checkPermissions( WP_REST_Request $request ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new WP_Error( 'subtleforms_forbidden', __( 'You are not allowed to perform this action.', 'subtleforms' ), array( 'status' => 403 ) );
		}
		$nonce = sanitize_text_field( wp_unslash( (string) $request->get_header( 'X-WP-Nonce' ) ) );
		if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'subtleforms_invalid_nonce', __( 'Security check failed. Please refresh and try again.', 'subtleforms' ), array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * The service a request names.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	private function slug( WP_REST_Request $request ): string {
		return sanitize_key( (string) $request->get_param( 'service' ) );
	}

	/**
	 * Every service's connection, without the token.
	 *
	 * @return WP_REST_Response
	 */
	public function index(): WP_REST_Response {
		$out = array();
		foreach ( Services::slugs() as $slug ) {
			$out[ $slug ] = Services::state( $slug );
		}
		return ApiResponse::success( array( 'services' => $out ) );
	}

	/**
	 * One connection, without the token.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function state( WP_REST_Request $request ): WP_REST_Response {
		return ApiResponse::success( Services::state( $this->slug( $request ) ) );
	}

	/**
	 * Switch a service on or off. Its token and the forms' settings are kept either way.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function setEnabled( WP_REST_Request $request ): WP_REST_Response {
		( new Connection( $this->slug( $request ) ) )->setEnabled( (bool) rest_sanitize_boolean( $request->get_param( 'enabled' ) ) );
		return ApiResponse::success( Services::state( $this->slug( $request ) ) );
	}

	/**
	 * Check a token and save it when HubSpot accepts it.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function connect( WP_REST_Request $request ): WP_REST_Response {
		$slug  = $this->slug( $request );
		$token = trim( sanitize_text_field( (string) $request->get_param( 'token' ) ) );
		if ( ! HubSpotClient::looksLikeToken( $token ) ) {
			return ApiResponse::error( 'subtleforms_crm_token', HubSpotClient::badTokenMessage(), 400 );
		}
		try {
			$account = ( new HubSpotClient( $token ) )->account();
		} catch ( ServiceException $e ) {
			return ApiResponse::error( 'subtleforms_crm_failed', $e->getMessage(), 400 );
		}
		$connection = new Connection( $slug );
		$connection->save( $token, $account );
		delete_transient( $connection->cacheKey( 'properties' ) );
		return ApiResponse::success( array_merge( Services::state( $slug ), array( 'ok' => true ) ) );
	}

	/**
	 * Check the saved token.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function test( WP_REST_Request $request ): WP_REST_Response {
		$slug       = $this->slug( $request );
		$connection = new Connection( $slug );
		if ( ! $connection->hasKey() ) {
			return ApiResponse::error( 'subtleforms_crm_token', __( 'Add an access token first.', 'subtleforms' ), 400 );
		}
		try {
			$account = ( new HubSpotClient( $connection->apiKey() ) )->account();
		} catch ( ServiceException $e ) {
			$connection->recordCheck( false, array(), $e->getMessage() );
			return ApiResponse::success(
				array(
					'ok'      => false,
					'message' => $e->getMessage(),
					'state'   => Services::state( $slug ),
				)
			);
		}
		$connection->recordCheck( true, $account );
		$message = '' !== $account['portal_id']
			/* translators: 1: account name, 2: HubSpot account (portal) ID */
			? sprintf( __( 'Connected to %1$s (portal %2$s).', 'subtleforms' ), $account['name'], $account['portal_id'] )
			: __( 'Connected.', 'subtleforms' );
		return ApiResponse::success(
			array(
				'ok'      => true,
				'message' => $message,
				'account' => $account,
				'state'   => Services::state( $slug ),
			)
		);
	}

	/**
	 * Remove the saved token. The switch and the forms' settings stay.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function disconnect( WP_REST_Request $request ): WP_REST_Response {
		$connection = new Connection( $this->slug( $request ) );
		delete_transient( $connection->cacheKey( 'properties' ) );
		$connection->clear();
		return ApiResponse::success( Services::state( $this->slug( $request ) ) );
	}

	/**
	 * The contact properties a form field can be sent to.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function properties( WP_REST_Request $request ): WP_REST_Response {
		$connection = new Connection( $this->slug( $request ) );
		if ( ! $connection->hasKey() ) {
			return ApiResponse::error( 'subtleforms_crm_not_connected', __( 'Connect HubSpot first, in Settings > Integrations > CRM.', 'subtleforms' ), 400 );
		}
		$cacheKey = $connection->cacheKey( 'properties' );
		if ( ! rest_sanitize_boolean( $request->get_param( 'refresh' ) ) ) {
			$saved = get_transient( $cacheKey );
			if ( is_array( $saved ) ) {
				return ApiResponse::success( $saved );
			}
		}
		try {
			$list = ( new HubSpotClient( $connection->apiKey() ) )->properties();
		} catch ( ServiceException $e ) {
			return ApiResponse::error( 'subtleforms_crm_failed', $e->getMessage(), 400 );
		}
		set_transient( $cacheKey, $list, self::CACHE_TTL );
		return ApiResponse::success( $list );
	}

	/**
	 * Remember that this user dismissed the note about SubtleForms Pro in
	 * Settings > Integrations > CRM. One dismissal hides it everywhere it is
	 * shown.
	 *
	 * @return WP_REST_Response
	 */
	public function dismissBanner(): WP_REST_Response {
		$user_id = get_current_user_id();
		if ( $user_id <= 0 ) {
			return ApiResponse::unauthorized( __( 'User not authenticated', 'subtleforms' ) );
		}
		update_user_meta( $user_id, self::BANNER_META, true );
		return ApiResponse::success( array( 'dismissed' => true ) );
	}

	/**
	 * Whether this user dismissed the Pro note.
	 *
	 * @param int $userId User ID.
	 */
	public static function bannerDismissed( int $userId ): bool {
		return $userId > 0 && (bool) get_user_meta( $userId, self::BANNER_META, true );
	}
}
