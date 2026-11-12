<?php
/**
 * What a page of the active theme loads, for the builder preview.
 *
 * @package SubtleForms\Admin
 * @since   2.9.0
 */

namespace SubtleForms\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Support\ThemeStyles;

/**
 * Collects the stylesheets, inline styles, fonts and global styles that a page
 * of the active theme loads, plus the body and content classes the theme's
 * templates would put around a form, so the preview frame can look like the
 * page instead of an approximation of it.
 *
 * The theme's own enqueue callbacks run once, here, in isolation: the style
 * and script queues are replaced for the run and put back afterwards, so
 * nothing that was queued for the admin screen is touched and nothing is
 * printed. Only files that belong to the theme (parent or child) or to
 * WordPress itself are kept: other plugins' styles are not part of how a
 * theme looks. A theme that assumes the main query throws or warns; the result
 * is then the two stylesheet files the preview used before, marked degraded.
 *
 * The answer is kept in a transient per theme and version and recomputed when
 * the theme or its settings change.
 */
final class ThemePreviewAssets {

	/** Option holding a number that changes whenever the cached result is stale. */
	private const REVISION_OPTION = 'subtleforms_theme_assets_rev';

	/** Cache lifetime in seconds. */
	private const TTL = DAY_IN_SECONDS;

	/**
	 * Hook the cache refresh.
	 */
	public static function register(): void {
		add_action( 'switch_theme', array( self::class, 'flush' ) );
		add_action( 'customize_save_after', array( self::class, 'flush' ) );
		add_action( 'save_post_wp_global_styles', array( self::class, 'flush' ) );
		add_action( 'upgrader_process_complete', array( self::class, 'flush' ) );
	}

	/**
	 * Make the next read recompute.
	 */
	public static function flush(): void {
		delete_transient( self::cacheKey() );
		update_option( self::REVISION_OPTION, (int) get_option( self::REVISION_OPTION, 0 ) + 1, false );
	}

	/**
	 * Name of the transient for the active theme.
	 *
	 * @return string
	 */
	private static function cacheKey(): string {
		$theme = wp_get_theme();
		return 'subtleforms_theme_assets_' . md5(
			implode(
				'|',
				array(
					get_stylesheet(),
					(string) $theme->get( 'Version' ),
					get_bloginfo( 'version' ),
					defined( 'SUBTLEFORMS_VERSION' ) ? SUBTLEFORMS_VERSION : '',
					(string) get_option( self::REVISION_OPTION, 0 ),
				)
			)
		);
	}

	/**
	 * The assets, cached.
	 *
	 * @return array{stylesheets:string[],inlineCss:string,globalCss:string,fontFaces:string,isBlockTheme:bool,bodyClasses:string[],contentClass:string,degraded:bool}
	 */
	public static function collect(): array {
		$key    = self::cacheKey();
		$cached = get_transient( $key );
		if ( is_array( $cached ) && isset( $cached['stylesheets'], $cached['bodyClasses'] ) ) {
			return $cached;
		}

		$data = self::compute();
		// A degraded answer is not kept: the next request tries again.
		if ( empty( $data['degraded'] ) ) {
			set_transient( $key, $data, self::TTL );
		}
		return $data;
	}

	/**
	 * Run the theme's enqueue and read the result. Never throws.
	 *
	 * @return array
	 */
	public static function compute(): array {
		$base = self::baseData();
		try {
			$found = self::runEnqueue();
		} catch ( \Throwable $e ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
				// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
				error_log( 'SubtleForms: theme preview assets fell back to the stylesheet files: ' . $e->getMessage() );
			}
			return array_merge( $base, array( 'stylesheets' => self::fallbackStylesheets() ), array( 'degraded' => true ) );
		}

		if ( array() === $found['stylesheets'] ) {
			// A theme that enqueues nothing of its own still has its stylesheet file.
			$found['stylesheets'] = self::fallbackStylesheets();
		}
		return array_merge( $base, $found, array( 'degraded' => false ) );
	}

	/**
	 * The parts that do not depend on running the enqueue.
	 *
	 * @return array
	 */
	private static function baseData(): array {
		$is_block = function_exists( 'wp_is_block_theme' ) && wp_is_block_theme();
		$slug     = sanitize_html_class( get_stylesheet() );

		if ( $is_block ) {
			$body    = array( 'wp-singular', 'page', 'wp-embed-responsive', 'wp-theme-' . $slug );
			$content = 'wp-block-post-content is-layout-constrained has-global-padding entry-content';
		} else {
			$body    = array( 'page', 'wp-embed-responsive', $slug );
			$content = 'entry-content';
		}

		return array(
			'stylesheets'  => array(),
			'inlineCss'    => '',
			'globalCss'    => function_exists( 'wp_get_global_stylesheet' ) ? (string) wp_get_global_stylesheet() : '',
			'fontFaces'    => ThemeStyles::fontFaceCss(),
			'isBlockTheme' => $is_block,
			'bodyClasses'  => $body,
			'contentClass' => $content,
			'degraded'     => false,
		);
	}

	/**
	 * The theme's parent and child stylesheet files, as the preview loaded
	 * them before it ran the theme's enqueue.
	 *
	 * @return string[]
	 */
	private static function fallbackStylesheets(): array {
		$hrefs = array();
		if ( is_child_theme() ) {
			$hrefs[] = get_template_directory_uri() . '/style.css';
		}
		$own = get_stylesheet_uri();
		if ( is_string( $own ) && '' !== $own && ! in_array( $own, $hrefs, true ) ) {
			$hrefs[] = $own;
		}
		return $hrefs;
	}

	/**
	 * Whether a stylesheet address belongs to the theme or to WordPress.
	 *
	 * @param string $href Address.
	 * @return bool
	 */
	private static function isKept( string $href ): bool {
		$strip = static function ( string $url ): string {
			return (string) preg_replace( '#^https?:#i', '', $url );
		};
		$href  = $strip( $href );
		foreach ( array( get_template_directory_uri(), get_stylesheet_directory_uri(), includes_url() ) as $root ) {
			$root = trailingslashit( $strip( (string) $root ) );
			if ( 0 === strpos( $href, $root ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Run the enqueue hook with the queues swapped out and read what it queued.
	 *
	 * @return array{stylesheets:string[],inlineCss:string}
	 * @throws \Throwable When a theme's callback fails.
	 */
	private static function runEnqueue(): array {
		$saved_styles  = $GLOBALS['wp_styles'] ?? null;
		$saved_scripts = $GLOBALS['wp_scripts'] ?? null;
		$level         = ob_get_level();
		$quiet         = '__return_false';

		// A theme that checks the main query before it exists says so with a notice.
		add_filter( 'doing_it_wrong_trigger_error', $quiet );
		ob_start();
		try {
			// A fresh queue, with WordPress's own styles registered as on the front end.
			$GLOBALS['wp_styles']  = null;
			$GLOBALS['wp_scripts'] = null;
			$styles                = wp_styles();

			do_action( 'wp_enqueue_scripts' );

			$styles->all_deps( $styles->queue );
			$hrefs  = array();
			$inline = array();
			foreach ( $styles->to_do as $handle ) {
				$item = $styles->registered[ $handle ] ?? null;
				if ( ! $item || ! is_string( $item->src ) || '' === $item->src ) {
					continue;
				}
				if ( ! empty( $item->extra['conditional'] ) || ( ! empty( $item->args ) && 'print' === $item->args ) ) {
					continue;
				}
				$href = (string) $styles->_css_href( $item->src, $item->ver, $handle );
				if ( '' === $href || ! self::isKept( $href ) || in_array( $href, $hrefs, true ) ) {
					continue;
				}
				$hrefs[] = $href;
				$after   = $styles->get_data( $handle, 'after' );
				if ( is_array( $after ) ) {
					foreach ( $after as $rule ) {
						if ( is_string( $rule ) && '' !== trim( $rule ) ) {
							$inline[] = trim( $rule );
						}
					}
				}
			}
		} finally {
			while ( ob_get_level() > $level ) {
				ob_end_clean();
			}
			remove_filter( 'doing_it_wrong_trigger_error', $quiet );
			$GLOBALS['wp_styles']  = $saved_styles;
			$GLOBALS['wp_scripts'] = $saved_scripts;
		}

		return array(
			'stylesheets' => $hrefs,
			'inlineCss'   => implode( "\n", $inline ),
		);
	}
}
