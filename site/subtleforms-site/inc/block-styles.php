<?php
/**
 * Block styles. Each one shows up in the editor's style picker.
 * The CSS for every style lives in assets/css/theme.css so the editor
 * and the front end share one source of truth.
 *
 * @package SubtleFormsSite
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	function () {
		$styles = array(
			// Group looks.
			array( 'core/group', 'sf-card', __( 'Card', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-card-dark', __( 'Card (dark)', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-grain', __( 'Grain overlay', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-glow', __( 'Glow section', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-stage', __( 'Throughline stage', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-form-card', __( 'Form mockup', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-field', __( 'Form field (mockup)', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-outcome-card', __( 'Outcome card', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-window', __( 'App window', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-tier', __( 'Pricing tier', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-tier-featured', __( 'Pricing tier (featured)', 'subtleforms-site' ) ),
			array( 'core/group', 'sf-step', __( 'Numbered step', 'subtleforms-site' ) ),
			// Text looks.
			array( 'core/paragraph', 'sf-eyebrow', __( 'Eyebrow', 'subtleforms-site' ) ),
			array( 'core/paragraph', 'sf-badge', __( 'Badge', 'subtleforms-site' ) ),
			array( 'core/paragraph', 'sf-fine', __( 'Fine print', 'subtleforms-site' ) ),
			array( 'core/paragraph', 'sf-price', __( 'Price', 'subtleforms-site' ) ),
			array( 'core/paragraph', 'sf-lead', __( 'Lead', 'subtleforms-site' ) ),
			array( 'core/heading', 'sf-balance', __( 'Balanced wrap', 'subtleforms-site' ) ),
			// Buttons.
			array( 'core/button', 'sf-ghost', __( 'Ghost', 'subtleforms-site' ) ),
			array( 'core/button', 'sf-signal', __( 'Signal (lime)', 'subtleforms-site' ) ),
			array( 'core/button', 'sf-link', __( 'Text link', 'subtleforms-site' ) ),
			// Misc.
			array( 'core/details', 'sf-faq', __( 'FAQ row', 'subtleforms-site' ) ),
			array( 'core/table', 'sf-matrix', __( 'Comparison matrix', 'subtleforms-site' ) ),
			array( 'core/list', 'sf-checks', __( 'Check list', 'subtleforms-site' ) ),
			array( 'core/site-title', 'sf-wordmark', __( 'Wordmark with mark', 'subtleforms-site' ) ),
			array( 'core/separator', 'sf-hair', __( 'Hairline', 'subtleforms-site' ) ),
			array( 'core/columns', 'sf-bleed-right', __( 'Bleed right', 'subtleforms-site' ) ),
		);
		foreach ( $styles as $style ) {
			register_block_style( $style[0], array( 'name' => $style[1], 'label' => $style[2] ) );
		}
	}
);
