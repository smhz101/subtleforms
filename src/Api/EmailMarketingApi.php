<?php
/**
 * Email marketing connections and lookups for Settings and the form builder.
 *
 * An API key is saved by POST /integrations/email-marketing/{service}/connect
 * and is never sent back: every answer carries only the last four characters.
 *
 * @package SubtleForms
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Integrations\EmailMarketing\BrevoClient;
use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Integrations\EmailMarketing\ServiceException;
use SubtleForms\Integrations\EmailMarketing\Services;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Routes under /subtleforms/v1/integrations/email-marketing. Administrators only.
 */
final class EmailMarketingApi {

	/** Seconds the list and field lists are kept. */
	const CACHE_TTL = 10 * MINUTE_IN_SECONDS;

	/** User meta that remembers a dismissed Pro note. */
	const BANNER_META = 'subtleforms_email_marketing_banner_dismissed';

	/**
	 * Register the routes.
	 */
	public function registerRoutes(): void {
		$base    = '/integrations/email-marketing';
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
					'api_key' => array(
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
				'args'                => array(
					'api_key' => array( 'type' => 'string' ),
				),
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . $service . '/settings',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'saveSettings' ),
				'permission_callback' => $perm,
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . $service . '/lists',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'lists' ),
				'permission_callback' => $perm,
				'args'                => array(
					'refresh' => array( 'type' => 'boolean' ),
				),
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . $service . '/fields',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'fields' ),
				'permission_callback' => $perm,
				'args'                => array(
					'list_id' => array( 'type' => 'string' ),
					'refresh' => array( 'type' => 'boolean' ),
				),
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . '/brevo/templates',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'brevoTemplates' ),
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
	 * Every service's connection, without the keys.
	 *
	 * @return WP_REST_Response
	 */
	public function index(): WP_REST_Response {
		$out = array();
		foreach ( Services::slugs() as $slug ) {
			$out[ $slug ] = ( new Connection( $slug ) )->state();
		}
		return ApiResponse::success( array( 'services' => $out ) );
	}

	/**
	 * One connection, without the key.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function state( WP_REST_Request $request ): WP_REST_Response {
		return ApiResponse::success( ( new Connection( $this->slug( $request ) ) )->state() );
	}

	/**
	 * Switch a service on or off. Its key and settings are kept either way.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function setEnabled( WP_REST_Request $request ): WP_REST_Response {
		$connection = new Connection( $this->slug( $request ) );
		$connection->setEnabled( (bool) rest_sanitize_boolean( $request->get_param( 'enabled' ) ) );
		return ApiResponse::success( $connection->state() );
	}

	/**
	 * Check a key and save it when the service accepts it.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function connect( WP_REST_Request $request ): WP_REST_Response {
		$slug = $this->slug( $request );
		$key  = trim( sanitize_text_field( (string) $request->get_param( 'api_key' ) ) );
		$def  = Services::definitions()[ $slug ];
		if ( ! $def['client']::looksLikeKey( $key ) ) {
			return ApiResponse::error( 'subtleforms_email_marketing_key', $def['client']::badKeyMessage(), 400 );
		}
		$connection = new Connection( $slug );
		try {
			$account = Services::client( $slug, $key, \SubtleForms\Integrations\EmailMarketing\AbstractClient::ADMIN_TIMEOUT, $connection->settings() )->account();
		} catch ( ServiceException $e ) {
			return ApiResponse::error( 'subtleforms_email_marketing_failed', $e->getMessage(), 400 );
		}
		$connection->save( $key, $account );
		return ApiResponse::success( array_merge( $connection->state(), array( 'ok' => true ) ) );
	}

	/**
	 * Check the saved key, or a key typed in but not saved.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function test( WP_REST_Request $request ): WP_REST_Response {
		$slug       = $this->slug( $request );
		$connection = new Connection( $slug );
		$typed      = trim( sanitize_text_field( (string) $request->get_param( 'api_key' ) ) );
		$key        = '' !== $typed ? $typed : $connection->apiKey();
		if ( '' === $key ) {
			return ApiResponse::error( 'subtleforms_email_marketing_key', __( 'Add an API key first.', 'subtleforms' ), 400 );
		}
		try {
			$account = Services::client( $slug, $key, \SubtleForms\Integrations\EmailMarketing\AbstractClient::ADMIN_TIMEOUT, $connection->settings() )->account();
		} catch ( ServiceException $e ) {
			if ( '' === $typed ) {
				$connection->recordCheck( false, array(), $e->getMessage() );
			}
			return ApiResponse::success(
				array(
					'ok'      => false,
					'message' => $e->getMessage(),
					'state'   => $connection->state(),
				)
			);
		}
		if ( '' === $typed ) {
			$connection->recordCheck( true, $account );
		}
		return ApiResponse::success(
			array(
				'ok'      => true,
				'message' => '' !== $account['name']
					/* translators: 1: account name, 2: account email */
					? sprintf( __( 'Connected to %1$s (%2$s).', 'subtleforms' ), $account['name'], $account['email'] )
					: __( 'Connected.', 'subtleforms' ),
				'account' => $account,
				'state'   => $connection->state(),
			)
		);
	}

	/**
	 * Save a service's own settings (Brevo: the double opt-in template and
	 * the page people land on after they confirm).
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function saveSettings( WP_REST_Request $request ): WP_REST_Response {
		$slug       = $this->slug( $request );
		$connection = new Connection( $slug );
		if ( 'brevo' !== $slug ) {
			return ApiResponse::success( $connection->state() );
		}
		$url = esc_url_raw( trim( (string) $request->get_param( 'doi_redirect_url' ) ), array( 'http', 'https' ) );
		$connection->saveSettings(
			array(
				'doi_template_id'  => max( 0, (int) $request->get_param( 'doi_template_id' ) ),
				'doi_redirect_url' => $url,
			)
		);
		return ApiResponse::success( $connection->state() );
	}

	/**
	 * Remove the saved key. The switch and the settings stay.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function disconnect( WP_REST_Request $request ): WP_REST_Response {
		$connection = new Connection( $this->slug( $request ) );
		$connection->clear();
		return ApiResponse::success( $connection->state() );
	}

	/**
	 * The account's lists.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function lists( WP_REST_Request $request ): WP_REST_Response {
		$slug = $this->slug( $request );
		return $this->cached(
			$slug,
			'lists',
			(bool) $request->get_param( 'refresh' ),
			static function ( $client ): array {
				return $client->lists();
			}
		);
	}

	/**
	 * The fields an answer can be sent to (for Mailchimp, those of one audience).
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function fields( WP_REST_Request $request ): WP_REST_Response {
		$slug = $this->slug( $request );
		$id   = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $request->get_param( 'list_id' ) );
		return $this->cached(
			$slug,
			'fields|' . ( 'mailchimp' === $slug ? $id : '' ),
			(bool) $request->get_param( 'refresh' ),
			static function ( $client ) use ( $id ): array {
				return $client->fields( (string) $id );
			}
		);
	}

	/**
	 * Brevo's email templates, for the double opt-in choice.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function brevoTemplates( WP_REST_Request $request ): WP_REST_Response {
		return $this->cached(
			'brevo',
			'templates',
			(bool) $request->get_param( 'refresh' ),
			static function ( $client ): array {
				return $client instanceof BrevoClient ? $client->templates() : array();
			}
		);
	}

	/**
	 * Remember that this user dismissed the note about SubtleForms Pro in
	 * Settings > Integrations > Email marketing. One dismissal hides it
	 * everywhere it is shown.
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
	 * Answer from the saved list, or ask the service and save the answer.
	 *
	 * @param string   $slug     Service slug.
	 * @param string   $what     What is cached.
	 * @param bool     $refresh  Ask the service even when a saved list exists.
	 * @param callable $load     Receives the client and returns the list.
	 * @return WP_REST_Response
	 */
	private function cached( string $slug, string $what, bool $refresh, callable $load ): WP_REST_Response {
		$connection = new Connection( $slug );
		if ( ! $connection->hasKey() ) {
			return ApiResponse::error(
				'subtleforms_email_marketing_not_connected',
				/* translators: %s: service name */
				sprintf( __( 'Connect %s first, in Settings > Integrations > Email marketing.', 'subtleforms' ), Services::definitions()[ $slug ]['label'] ?? $slug ),
				400
			);
		}
		$cacheKey = $connection->cacheKey( $what );
		if ( ! $refresh ) {
			$saved = get_transient( $cacheKey );
			if ( is_array( $saved ) ) {
				return ApiResponse::success( $saved );
			}
		}
		try {
			$list = $load( Services::client( $slug, $connection->apiKey(), \SubtleForms\Integrations\EmailMarketing\AbstractClient::ADMIN_TIMEOUT, $connection->settings() ) );
		} catch ( ServiceException $e ) {
			return ApiResponse::error( 'subtleforms_email_marketing_failed', $e->getMessage(), 400 );
		}
		set_transient( $cacheKey, $list, self::CACHE_TTL );
		return ApiResponse::success( $list );
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
