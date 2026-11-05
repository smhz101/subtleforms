<?php
/**
 * Mailchimp connection and lookups for Settings and the form builder.
 *
 * The API key is saved by POST /integrations/mailchimp/connect and is never
 * sent back: every answer carries only the last four characters.
 *
 * @package SubtleForms
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Api;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Integrations\Mailchimp\Client;
use SubtleForms\Integrations\Mailchimp\Connection;
use SubtleForms\Integrations\Mailchimp\MailchimpException;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Routes under /subtleforms/v1/integrations/mailchimp. Administrators only.
 */
final class MailchimpApi {

	/** Seconds the audience and field lists are kept. */
	const CACHE_TTL = 10 * MINUTE_IN_SECONDS;

	/**
	 * Register the routes.
	 */
	public function registerRoutes(): void {
		$base = '/integrations/mailchimp';
		$perm = array( $this, 'checkPermissions' );

		register_rest_route(
			'subtleforms/v1',
			$base,
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
			$base . '/connect',
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
			$base . '/test',
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
			$base . '/audiences',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'audiences' ),
				'permission_callback' => $perm,
				'args'                => array(
					'refresh' => array( 'type' => 'boolean' ),
				),
			)
		);
		register_rest_route(
			'subtleforms/v1',
			$base . '/audiences/(?P<id>[A-Za-z0-9]+)/fields',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'fields' ),
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
	 * The connection, without the key.
	 *
	 * @return WP_REST_Response
	 */
	public function state(): WP_REST_Response {
		return ApiResponse::success( Connection::state() );
	}

	/**
	 * Check a key and save it when Mailchimp accepts it.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function connect( WP_REST_Request $request ): WP_REST_Response {
		$key = trim( sanitize_text_field( (string) $request->get_param( 'api_key' ) ) );
		if ( ! Client::looksLikeKey( $key ) ) {
			return ApiResponse::error( 'subtleforms_mailchimp_key', __( 'This does not look like a Mailchimp API key. Keys end with a dash and the data center, for example "-us21".', 'subtleforms' ), 400 );
		}
		try {
			$account = ( new Client( $key ) )->account();
		} catch ( MailchimpException $e ) {
			return ApiResponse::error( 'subtleforms_mailchimp_failed', $e->getMessage(), 400 );
		}
		Connection::save( $key, $account );
		return ApiResponse::success( array_merge( Connection::state(), array( 'ok' => true ) ) );
	}

	/**
	 * Check the saved key, or a key typed in but not saved.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function test( WP_REST_Request $request ): WP_REST_Response {
		$typed = trim( sanitize_text_field( (string) $request->get_param( 'api_key' ) ) );
		$key   = '' !== $typed ? $typed : Connection::apiKey();
		if ( '' === $key ) {
			return ApiResponse::error( 'subtleforms_mailchimp_key', __( 'Add an API key first.', 'subtleforms' ), 400 );
		}
		try {
			$account = ( new Client( $key ) )->account();
		} catch ( MailchimpException $e ) {
			if ( '' === $typed ) {
				Connection::recordCheck( false, array(), $e->getMessage() );
			}
			return ApiResponse::success(
				array(
					'ok'      => false,
					'message' => $e->getMessage(),
					'state'   => Connection::state(),
				)
			);
		}
		if ( '' === $typed ) {
			Connection::recordCheck( true, $account );
		}
		return ApiResponse::success(
			array(
				'ok'      => true,
				'message' => '' !== $account['name']
					/* translators: 1: Mailchimp account name, 2: account email */
					? sprintf( __( 'Connected to %1$s (%2$s).', 'subtleforms' ), $account['name'], $account['email'] )
					: __( 'Connected.', 'subtleforms' ),
				'account' => $account,
				'state'   => Connection::state(),
			)
		);
	}

	/**
	 * Remove the saved key.
	 *
	 * @return WP_REST_Response
	 */
	public function disconnect(): WP_REST_Response {
		Connection::clear();
		return ApiResponse::success( Connection::state() );
	}

	/**
	 * The account's audiences.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function audiences( WP_REST_Request $request ): WP_REST_Response {
		return $this->cached(
			Connection::cacheKey( 'audiences' ),
			(bool) $request->get_param( 'refresh' ),
			static function ( Client $client ): array {
				return $client->audiences();
			}
		);
	}

	/**
	 * The merge fields of one audience.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public function fields( WP_REST_Request $request ): WP_REST_Response {
		$id = (string) $request->get_param( 'id' );
		return $this->cached(
			Connection::cacheKey( 'fields|' . $id ),
			(bool) $request->get_param( 'refresh' ),
			static function ( Client $client ) use ( $id ): array {
				return $client->mergeFields( $id );
			}
		);
	}

	/**
	 * Answer from the saved list, or ask Mailchimp and save the answer.
	 *
	 * @param string   $cacheKey Transient name.
	 * @param bool     $refresh  Ask Mailchimp even when a saved list exists.
	 * @param callable $load     Receives the Client and returns the list.
	 * @return WP_REST_Response
	 */
	private function cached( string $cacheKey, bool $refresh, callable $load ): WP_REST_Response {
		if ( ! Connection::hasKey() ) {
			return ApiResponse::error( 'subtleforms_mailchimp_not_connected', __( 'Connect Mailchimp first, in Settings > Integrations > Mailchimp.', 'subtleforms' ), 400 );
		}
		if ( ! $refresh ) {
			$saved = get_transient( $cacheKey );
			if ( is_array( $saved ) ) {
				return ApiResponse::success( $saved );
			}
		}
		try {
			$list = $load( new Client( Connection::apiKey() ) );
		} catch ( MailchimpException $e ) {
			return ApiResponse::error( 'subtleforms_mailchimp_failed', $e->getMessage(), 400 );
		}
		set_transient( $cacheKey, $list, self::CACHE_TTL );
		return ApiResponse::success( $list );
	}
}
