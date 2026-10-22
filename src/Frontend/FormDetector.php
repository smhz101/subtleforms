<?php
/**
 * Finds the forms a front-end page will show before it is drawn (2.6.0).
 *
 * The form assets are enqueued when a form renders, which always works but on
 * a classic theme happens after the page head is printed, so the stylesheet
 * lands at the end of the page. When the forms can be found up front (in the
 * posts of the main query or in a widget), the assets are enqueued from
 * `wp_enqueue_scripts` instead and the stylesheet goes in the head like any
 * other. Pages without a form load nothing either way.
 *
 * @package SubtleForms
 * @since   2.6.0
 */

declare(strict_types=1);

namespace SubtleForms\Frontend;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Form IDs in post content and widgets.
 */
final class FormDetector {

	/** Block name of the form block. */
	public const BLOCK = 'subtleforms/form';

	/**
	 * Form IDs in a piece of content: [subtleforms id="N"] shortcodes and form
	 * blocks, nested blocks included.
	 *
	 * @param string $content Post or widget content.
	 * @return int[] Unique IDs, in order of appearance.
	 */
	public static function formIdsInContent( string $content ): array {
		$ids = array();
		if ( '' === $content ) {
			return $ids;
		}

		if ( false !== strpos( $content, '[subtleforms' )
			&& preg_match_all( '/' . get_shortcode_regex( array( 'subtleforms' ) ) . '/', $content, $matches, PREG_SET_ORDER ) ) {
			foreach ( $matches as $match ) {
				// [[subtleforms]] is an escaped shortcode and prints as text.
				if ( '[' === $match[1] && ']' === $match[6] ) {
					continue;
				}
				$atts = shortcode_parse_atts( $match[3] );
				$id   = is_array( $atts ) ? (int) ( $atts['id'] ?? 0 ) : 0;
				if ( $id > 0 ) {
					$ids[] = $id;
				}
			}
		}

		if ( false !== strpos( $content, '<!-- wp:' . self::BLOCK ) && function_exists( 'parse_blocks' ) ) {
			$ids = array_merge( $ids, self::idsInBlocks( parse_blocks( $content ) ) );
		}

		return array_values( array_unique( $ids ) );
	}

	/**
	 * Form IDs the current front-end request is known to show: the posts of
	 * the main query and the active widgets.
	 *
	 * @return int[]
	 */
	public static function formIdsOnPage(): array {
		$ids = array();

		global $wp_query;
		if ( $wp_query instanceof \WP_Query && is_array( $wp_query->posts ) ) {
			foreach ( $wp_query->posts as $post ) {
				if ( $post instanceof \WP_Post && ! post_password_required( $post ) ) {
					$ids = array_merge( $ids, self::formIdsInContent( (string) $post->post_content ) );
				}
			}
		}

		$ids = array_merge( $ids, self::formIdsInWidgets() );

		/**
		 * Form IDs a page will show, found before it is drawn. A theme or
		 * plugin that prints a form from a template can add its ID here so
		 * the form's stylesheet goes in the page head. Forms that are not
		 * listed still get their assets when they render.
		 *
		 * @param int[] $ids Form IDs.
		 * @since 2.6.0
		 */
		$ids = (array) apply_filters( 'subtleforms/frontend/form_ids_on_page', $ids );

		return array_values( array_unique( array_filter( array_map( 'intval', $ids ) ) ) );
	}

	/**
	 * Form IDs in the widgets placed in active sidebars (block, text and
	 * custom HTML widgets).
	 *
	 * @return int[]
	 */
	public static function formIdsInWidgets(): array {
		$ids      = array();
		// The stored sidebar layout, through the same core filter that
		// is_active_sidebar() reads, without the core-only helper.
		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core filter.
		$sidebars = apply_filters( 'sidebars_widgets', get_option( 'sidebars_widgets', array() ) );
		if ( ! is_array( $sidebars ) ) {
			return $ids;
		}
		$options = array();
		foreach ( $sidebars as $sidebar => $widgets ) {
			if ( 'wp_inactive_widgets' === $sidebar || ! is_array( $widgets ) || ! is_active_sidebar( $sidebar ) ) {
				continue;
			}
			foreach ( $widgets as $widget ) {
				if ( ! is_string( $widget ) || ! preg_match( '/^(block|text|custom_html)-(\d+)$/', $widget, $m ) ) {
					continue;
				}
				$base = $m[1];
				if ( ! isset( $options[ $base ] ) ) {
					$value            = get_option( 'widget_' . $base, array() );
					$options[ $base ] = is_array( $value ) ? $value : array();
				}
				$instance = $options[ $base ][ (int) $m[2] ] ?? null;
				if ( ! is_array( $instance ) ) {
					continue;
				}
				$content = (string) ( 'block' === $base ? ( $instance['content'] ?? '' ) : ( $instance['text'] ?? ( $instance['content'] ?? '' ) ) );
				$ids     = array_merge( $ids, self::formIdsInContent( $content ) );
			}
		}
		return $ids;
	}

	/**
	 * Form IDs in parsed blocks, inner blocks included.
	 *
	 * @param array<int, array<string, mixed>> $blocks Parsed blocks.
	 * @return int[]
	 */
	private static function idsInBlocks( array $blocks ): array {
		$ids = array();
		foreach ( $blocks as $block ) {
			if ( ! is_array( $block ) ) {
				continue;
			}
			if ( self::BLOCK === ( $block['blockName'] ?? '' ) ) {
				$id = (int) ( $block['attrs']['formId'] ?? 0 );
				if ( $id > 0 ) {
					$ids[] = $id;
				}
			}
			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				$ids = array_merge( $ids, self::idsInBlocks( $block['innerBlocks'] ) );
			}
		}
		return $ids;
	}
}
