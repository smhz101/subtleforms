<?php
/**
 * REST preloading for the admin app.
 *
 * A SubtleForms admin screen can receive the answer of a few of its first REST
 * requests inside the page, the way the block editor does. The app registers
 * the answers with apiFetch's preloading middleware before it renders, so the
 * request is answered at once instead of crossing the network after load.
 *
 * Add-ons choose what to preload per screen with the
 * `subtleforms/admin/preload_paths` filter. Only GET routes of this plugin's
 * namespace are accepted. The routes run through WordPress itself with the
 * current user, so permissions are the ones a normal request would meet.
 *
 * @package SubtleForms\Admin
 * @since   2.7.4
 */

namespace SubtleForms\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds the preloaded REST answers for a SubtleForms admin screen.
 */
final class AdminPreload {

	/** Route prefix every preloaded path must have. */
	const PREFIX = '/subtleforms/v1/';

	/** Most paths one screen may preload. */
	const MAX_PATHS = 12;

	/**
	 * Paths the plugin itself preloads on a screen.
	 *
	 * The Forms list asks for its first batch (100 rows, newest first) as soon
	 * as it mounts; this is that request, so the list is in the first paint.
	 * Keep it in step with the request built in FormsList.jsx.
	 *
	 * Settings asks for the settings and for the state of the email marketing
	 * services as it opens (`useSettings`, `useEmailMarketingServices`); both
	 * are sent with the page and put in the query cache, so Settings opens with
	 * no spinner. The Dashboard asks for `/dashboard`, which carries every figure
	 * it shows, and gets it the same way. Keep them in step with `resources/admin/data/seeds.js`.
	 *
	 * @param string $screen Screen slug (the `page` query value).
	 * @return string[]
	 */
	public static function defaultPaths( string $screen ): array {
		if ( 'subtleforms-forms' === $screen ) {
			return array( '/subtleforms/v1/forms?orderby=created_at&order=desc&page=1&per_page=100' );
		}
		if ( 'subtleforms' === $screen ) {
			// The Dashboard asks for this one request (`useDashboardStats`).
			return array( '/subtleforms/v1/dashboard' );
		}
		if ( 'subtleforms-settings' === $screen ) {
			return array(
				'/subtleforms/v1/settings',
				'/subtleforms/v1/integrations/email-marketing',
			);
		}
		return array();
	}

	/**
	 * The slug of the SubtleForms screen being loaded (`subtleforms`,
	 * `subtleforms-forms`, ...), or an empty string.
	 */
	public static function currentScreen(): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only admin screen slug.
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
		return ( 'subtleforms' === $page || 0 === strpos( $page, 'subtleforms-' ) ) ? $page : '';
	}

	/**
	 * Keep only well-formed paths below /subtleforms/v1/, without duplicates.
	 *
	 * @param mixed $paths Paths from the filter.
	 * @return string[]
	 */
	public static function acceptable( $paths ): array {
		if ( ! is_array( $paths ) ) {
			return array();
		}
		$out = array();
		foreach ( $paths as $path ) {
			if ( ! is_string( $path ) ) {
				continue;
			}
			$path = trim( $path );
			if ( 0 !== strpos( $path, self::PREFIX ) || strlen( $path ) <= strlen( self::PREFIX ) ) {
				continue;
			}
			// No scheme, host, fragment, dot segments or whitespace tricks.
			if ( preg_match( '#[\s\\\\\#]|\.\./|//#', substr( $path, 1 ) ) ) {
				continue;
			}
			$out[ $path ] = true;
			if ( count( $out ) >= self::MAX_PATHS ) {
				break;
			}
		}
		return array_keys( $out );
	}

	/**
	 * The paths to preload on a screen, after the filter.
	 *
	 * @param string $screen Screen slug.
	 * @return string[]
	 */
	public static function paths( string $screen ): array {
		/**
		 * Filter the REST paths preloaded with a SubtleForms admin screen.
		 *
		 * Each path is a GET route of this plugin with the exact query string
		 * the screen's script will request, for example
		 * `/subtleforms/v1/analytics/summary?days=30`. Paths outside
		 * `/subtleforms/v1/` are ignored. The answer is computed with the
		 * current user, so a route the user may not read is left out.
		 *
		 * @param string[] $paths  REST paths.
		 * @param string   $screen Screen slug, for example `subtleforms-forms`.
		 * @since 2.7.4
		 */
		$paths = apply_filters( 'subtleforms/admin/preload_paths', self::defaultPaths( $screen ), $screen );
		return self::acceptable( $paths );
	}

	/**
	 * Preloaded answers for a screen, keyed by path, in the shape
	 * `apiFetch.createPreloadingMiddleware()` takes: `{ body, headers }`.
	 *
	 * @param string $screen Screen slug.
	 * @return array<string,array<string,mixed>>
	 */
	public static function collect( string $screen ): array {
		if ( '' === $screen || ! is_user_logged_in() || ! function_exists( 'rest_preload_api_request' ) ) {
			return array();
		}
		$caps = new \SubtleForms\Support\Capabilities();
		if ( ! current_user_can( $caps->manage_cap() ) ) {
			return array();
		}
		$paths = self::paths( $screen );
		if ( array() === $paths ) {
			return array();
		}
		// The routes of this plugin ask for the REST nonce the browser would send.
		// Give each preloaded request the nonce of the current user, as the
		// browser's own request would carry, and take the filter off again.
		$nonce  = wp_create_nonce( 'wp_rest' );
		$attach = static function ( $result, $server, $request ) use ( $nonce ) {
			if ( $request instanceof \WP_REST_Request && '' === (string) $request->get_header( 'X-WP-Nonce' ) ) {
				$request->set_header( 'X-WP-Nonce', $nonce );
			}
			return $result;
		};
		add_filter( 'rest_pre_dispatch', $attach, 0, 3 );
		$preloaded = array_reduce( $paths, 'rest_preload_api_request', array() );
		remove_filter( 'rest_pre_dispatch', $attach, 0 );
		return is_array( $preloaded ) ? $preloaded : array();
	}
}
