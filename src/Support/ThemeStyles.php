<?php
/**
 * What the active theme offers a form: colours, fonts, sizes and the look of
 * its buttons.
 *
 * @package SubtleForms
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reads the theme's own data through WordPress (wp_get_global_settings() and
 * wp_get_global_styles()) so the builder can offer the theme's colours and
 * fonts first, and can draw a form with them in the preview.
 *
 * A block theme publishes everything in theme.json. A classic theme has no
 * theme.json; it may still declare an editor colour palette and editor font
 * sizes, which WordPress folds into the same settings, and those are used.
 * Classic themes do not share their fonts, so the lists of font families are
 * empty and the preview relies on the stylesheet of the theme.
 *
 * The result is kept in a transient per theme version and refreshed when the
 * theme or its global styles change.
 */
final class ThemeStyles {

	/** Option holding a number that changes whenever the cached result is stale. */
	private const REVISION_OPTION = 'subtleforms_theme_styles_rev';

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
		update_option( self::REVISION_OPTION, (int) get_option( self::REVISION_OPTION, 0 ) + 1, false );
	}

	/**
	 * The theme data, cached.
	 *
	 * @return array<string, mixed>
	 */
	public static function get(): array {
		$theme = function_exists( 'wp_get_theme' ) ? wp_get_theme() : null;
		$key   = 'subtleforms_theme_styles_' . md5(
			implode(
				'|',
				array(
					get_stylesheet(),
					$theme ? (string) $theme->get( 'Version' ) : '',
					get_bloginfo( 'version' ),
					SUBTLEFORMS_VERSION,
					(string) get_option( self::REVISION_OPTION, 0 ),
				)
			)
		);

		$cached = get_transient( $key );
		if ( is_array( $cached ) && isset( $cached['palette'] ) ) {
			return $cached;
		}

		$data = self::compute();
		set_transient( $key, $data, self::TTL );
		return $data;
	}

	/**
	 * Work the data out from WordPress.
	 *
	 * @return array<string, mixed>
	 */
	public static function compute( ?array $settings = null, ?array $styles = null, ?bool $is_block = null ): array {
		// The arguments let a test describe a theme WordPress is not running.
		$settings = $settings ?? ( function_exists( 'wp_get_global_settings' ) ? wp_get_global_settings() : array() );
		$settings = is_array( $settings ) ? $settings : array();
		$styles   = $styles ?? ( function_exists( 'wp_get_global_styles' ) ? wp_get_global_styles() : array() );
		$styles   = is_array( $styles ) ? $styles : array();

		$is_block = $is_block ?? ( function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() );

		$palette = self::fromOrigins( $settings['color']['palette'] ?? array(), array( 'theme', 'custom' ) );
		if ( ! $palette ) {
			$support = get_theme_support( 'editor-color-palette' );
			$palette = is_array( $support ) && isset( $support[0] ) && is_array( $support[0] ) ? $support[0] : array();
		}
		$palette_out = array();
		foreach ( $palette as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['slug'] ) || empty( $entry['color'] ) || ! is_string( $entry['color'] ) ) {
				continue;
			}
			$palette_out[] = array(
				'slug'  => sanitize_key( (string) $entry['slug'] ),
				'name'  => wp_strip_all_tags( (string) ( $entry['name'] ?? $entry['slug'] ) ),
				'color' => $entry['color'],
			);
		}

		$fonts     = self::fromOrigins( $settings['typography']['fontFamilies'] ?? array(), array( 'theme', 'custom' ) );
		$fonts_out = array();
		foreach ( $fonts as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['slug'] ) || empty( $entry['fontFamily'] ) || ! is_string( $entry['fontFamily'] ) ) {
				continue;
			}
			$fonts_out[] = array(
				'slug'       => sanitize_key( (string) $entry['slug'] ),
				'name'       => wp_strip_all_tags( (string) ( $entry['name'] ?? $entry['slug'] ) ),
				'fontFamily' => $entry['fontFamily'],
			);
		}

		$sizes = self::fromOrigins( $settings['typography']['fontSizes'] ?? array(), array( 'theme', 'custom' ) );
		if ( ! $sizes ) {
			$support = get_theme_support( 'editor-font-sizes' );
			$sizes   = is_array( $support ) && isset( $support[0] ) && is_array( $support[0] ) ? $support[0] : array();
		}
		$sizes_out = array();
		foreach ( $sizes as $entry ) {
			if ( ! is_array( $entry ) || empty( $entry['slug'] ) || ! isset( $entry['size'] ) ) {
				continue;
			}
			$size = is_array( $entry['size'] ) ? '' : (string) $entry['size'];
			if ( is_numeric( $size ) ) {
				$size .= 'px';
			}
			if ( '' === $size ) {
				continue;
			}
			$sizes_out[] = array(
				'slug' => sanitize_key( (string) $entry['slug'] ),
				'name' => wp_strip_all_tags( (string) ( $entry['name'] ?? $entry['slug'] ) ),
				'size' => $size,
			);
		}

		$body    = self::preset( $styles['typography']['fontFamily'] ?? '' );
		$heading = self::preset( $styles['elements']['heading']['typography']['fontFamily'] ?? '' );
		$button  = is_array( $styles['elements']['button'] ?? null ) ? $styles['elements']['button'] : array();

		return array(
			'isBlockTheme' => $is_block,
			'palette'      => $palette_out,
			'fontFamilies' => $fonts_out,
			'fontSizes'    => $sizes_out,
			'bodyFont'     => $body,
			'headingFont'  => '' !== $heading ? $heading : $body,
			'colors'       => array(
				'text'       => self::preset( $styles['color']['text'] ?? '' ),
				'background' => self::preset( $styles['color']['background'] ?? '' ),
				'link'       => self::preset( $styles['elements']['link']['color']['text'] ?? '' ),
			),
			'buttonStyles' => array(
				'background' => self::preset( $button['color']['background'] ?? '' ),
				'text'       => self::preset( $button['color']['text'] ?? '' ),
				'radius'     => self::preset( $button['border']['radius'] ?? '' ),
				'fontFamily' => self::preset( $button['typography']['fontFamily'] ?? '' ),
				'fontSize'   => self::preset( $button['typography']['fontSize'] ?? '' ),
			),
			// The preset variables as the front end prints them, so the
			// builder canvas can scope them to the form.
			'variablesCss' => function_exists( 'wp_get_global_stylesheet' ) ? (string) wp_get_global_stylesheet( array( 'variables' ) ) : '',
			// The @font-face rules of the theme's fonts, without the style tags.
			'fontFaceCss'  => self::fontFaceCss(),
		);
	}

	/**
	 * Join the entries of the wanted origins, in order.
	 *
	 * @param mixed    $by_origin Entries by origin, or a plain list.
	 * @param string[] $origins   Origins to take.
	 * @return array<int, mixed>
	 */
	private static function fromOrigins( $by_origin, array $origins ): array {
		if ( ! is_array( $by_origin ) ) {
			return array();
		}
		if ( array_is_list( $by_origin ) ) {
			return $by_origin;
		}
		$out = array();
		foreach ( $origins as $origin ) {
			if ( ! empty( $by_origin[ $origin ] ) && is_array( $by_origin[ $origin ] ) ) {
				foreach ( $by_origin[ $origin ] as $entry ) {
					$out[] = $entry;
				}
			}
		}
		return $out;
	}

	/**
	 * Turn theme.json's shorthand (var:preset|color|primary) into a CSS value.
	 *
	 * @param mixed $value Raw value.
	 * @return string
	 */
	public static function preset( $value ): string {
		if ( ! is_string( $value ) ) {
			return '';
		}
		$value = trim( $value );
		if ( preg_match( '/^var:preset\|([a-z-]+)\|([a-z0-9-]+)$/', $value, $m ) ) {
			return 'var(--wp--preset--' . $m[1] . '--' . $m[2] . ')';
		}
		return $value;
	}

	/**
	 * The @font-face rules for the theme's font files (theme.json fontFace),
	 * as plain CSS.
	 *
	 * @return string
	 */
	public static function fontFaceCss(): string {
		if ( ! function_exists( 'wp_print_font_faces' ) ) {
			return '';
		}
		ob_start();
		wp_print_font_faces();
		$html = (string) ob_get_clean();
		$css  = trim( (string) preg_replace( '#</?style[^>]*>#i', '', $html ) );
		return $css;
	}
}
