<?php
/**
 * Theme setup: editor styles, front-end styles, small front-end hygiene.
 *
 * @package SubtleFormsSite
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'after_setup_theme',
	function () {
		add_theme_support( 'editor-styles' );
		add_editor_style( 'assets/css/theme.css' );
		add_theme_support( 'html5', array( 'style', 'script', 'search-form', 'gallery', 'caption' ) );
		remove_theme_support( 'core-block-patterns' );
	}
);

add_action(
	'wp_enqueue_scripts',
	function () {
		wp_enqueue_style( 'subtleforms-site', SF_SITE_URI . '/assets/css/theme.css', array(), SF_SITE_VERSION );
	}
);

add_action(
	'wp_head',
	function () {
		$fonts = array(
			'bricolage-grotesque-latin-wght-normal.woff2',
			'geist-latin-wght-normal.woff2',
		);
		foreach ( $fonts as $font ) {
			printf(
				'<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n",
				esc_url( SF_SITE_URI . '/assets/fonts/' . $font )
			);
		}
	},
	1
);

// Emoji script and oEmbed discovery are dead weight on a marketing site.
add_action(
	'init',
	function () {
		remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
		remove_action( 'wp_print_styles', 'print_emoji_styles' );
		remove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
		remove_action( 'wp_head', 'wp_generator' );
	}
);

// Body class helps CSS tell the front page from the rest without touching content.
add_filter(
	'body_class',
	function ( $classes ) {
		$classes[] = 'sf-site';
		return $classes;
	}
);
