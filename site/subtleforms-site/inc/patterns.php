<?php
/**
 * Pattern categories. Patterns themselves are files in /patterns and are
 * registered automatically by WordPress from their file headers.
 *
 * @package SubtleFormsSite
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	function () {
		register_block_pattern_category( 'subtleforms', array( 'label' => __( 'SubtleForms', 'subtleforms-site' ) ) );
		register_block_pattern_category( 'subtleforms-hero', array( 'label' => __( 'SubtleForms: Heroes', 'subtleforms-site' ) ) );
		register_block_pattern_category( 'subtleforms-sections', array( 'label' => __( 'SubtleForms: Sections', 'subtleforms-site' ) ) );
		register_block_pattern_category( 'subtleforms-pricing', array( 'label' => __( 'SubtleForms: Pricing', 'subtleforms-site' ) ) );
		register_block_pattern_category( 'subtleforms-pages', array( 'label' => __( 'SubtleForms: Full pages', 'subtleforms-site' ) ) );
	}
);
