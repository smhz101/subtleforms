<?php
/**
 * Custom blocks. Each block folder holds block.json, an editor script
 * (plain JS, no build step), a stylesheet and a render.php.
 *
 * @package SubtleFormsSite
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	function () {
		foreach ( array( 'path', 'hero-media' ) as $block ) {
			register_block_type( SF_SITE_DIR . '/blocks/' . $block );
		}
	}
);

/**
 * Path geometry presets shared by the path block render and the hero CSS.
 * Coordinates live in a 1000 x 700 viewBox for the hero fan and 1000 x 120 for dividers.
 *
 * @return array<string, array<string, mixed>>
 */
function sf_site_path_presets() {
	return array(
		'hero'    => array(
			'viewBox' => '0 0 1000 780',
			'paths'   => array(
				'M 440 630 C 510 630, 500 120, 580 120',
				'M 440 630 C 510 630, 500 390, 580 390',
				'M 440 630 C 510 630, 500 660, 580 660',
			),
			'nodes'   => array( array( 440, 630 ) ),
			'ends'    => array( array( 580, 120 ), array( 580, 390 ), array( 580, 660 ) ),
		),
		'divider' => array(
			'viewBox' => '0 0 1000 120',
			'paths'   => array( 'M 0 60 C 250 60, 300 20, 520 20 S 760 100, 1000 100' ),
			'nodes'   => array( array( 0, 60 ) ),
			'ends'    => array( array( 1000, 100 ) ),
		),
		'stop'    => array(
			'viewBox' => '0 0 1000 120',
			'paths'   => array( 'M 0 60 C 200 60, 240 30, 420 30 S 600 90, 640 60' ),
			'nodes'   => array( array( 0, 60 ) ),
			'ends'    => array( array( 640, 60 ) ),
		),
		'steps'   => array(
			'viewBox' => '0 0 1000 120',
			'paths'   => array( 'M 40 60 L 960 60' ),
			'nodes'   => array( array( 40, 60 ), array( 500, 60 ) ),
			'ends'    => array( array( 960, 60 ) ),
		),
	);
}
