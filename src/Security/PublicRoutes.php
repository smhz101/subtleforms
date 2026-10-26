<?php
/**
 * Public routes work for visitors on cached pages.
 *
 * A REST nonce in a page served from a full-page cache expires after a day or
 * two. WordPress then refuses the request with `rest_cookie_invalid_nonce`,
 * even for a visitor who is not logged in. The routes visitors call while
 * filling in a form need no login, so for these routes a stale nonce simply
 * means "treat the request as a visitor" (FF-03).
 *
 * @package SubtleForms\Security
 * @since   2.3.9
 */

namespace SubtleForms\Security;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class PublicRoutes {

	/**
	 * Routes a visitor calls while filling in and sending a form.
	 */
	const PATTERN = '#^/subtleforms/v1/(submit|uploads|forms/\d+/(schema|view))/?$#';

	/**
	 * Register hooks.
	 */
	public static function register(): void {
		// After core's rest_cookie_check_errors (priority 100).
		add_filter( 'rest_authentication_errors', array( self::class, 'allowStaleNonce' ), 110 );
	}

	/**
	 * Let a request with an expired nonce through as a visitor on public routes.
	 *
	 * @param mixed $result Authentication result so far.
	 * @return mixed
	 */
	public static function allowStaleNonce( $result ) {
		if ( ! is_wp_error( $result ) || 'rest_cookie_invalid_nonce' !== $result->get_error_code() ) {
			return $result;
		}
		if ( ! self::isPublicRoute( self::currentRoute() ) ) {
			return $result;
		}
		wp_set_current_user( 0 );
		return true;
	}

	/**
	 * Whether a REST route is one visitors call.
	 *
	 * @param string $route REST route, for example /subtleforms/v1/submit.
	 */
	public static function isPublicRoute( string $route ): bool {
		if ( 1 === preg_match( self::PATTERN, $route ) ) {
			return true;
		}
		/**
		 * More REST routes visitors call while filling in a form, for
		 * example an add-on's own public routes. Exact routes such as
		 * `/subtleforms/v1/example`.
		 *
		 * @param string[] $routes Routes.
		 * @since 2.7.2
		 */
		$extra = function_exists( 'apply_filters' ) ? (array) apply_filters( 'subtleforms/rest/public_routes', array() ) : array();
		$route = rtrim( $route, '/' );
		foreach ( $extra as $candidate ) {
			if ( is_string( $candidate ) && '' !== $candidate && rtrim( $candidate, '/' ) === $route ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * The REST route of the current request.
	 */
	private static function currentRoute(): string {
		global $wp;
		if ( isset( $wp->query_vars['rest_route'] ) && is_string( $wp->query_vars['rest_route'] ) ) {
			return '/' . ltrim( $wp->query_vars['rest_route'], '/' );
		}
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Only matched against a fixed pattern.
		$uri    = isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path   = (string) wp_parse_url( $uri, PHP_URL_PATH );
		$prefix = '/' . trim( rest_get_url_prefix(), '/' );
		$pos    = strpos( $path, $prefix . '/' );
		return false === $pos ? '' : substr( $path, $pos + strlen( $prefix ) );
	}
}
