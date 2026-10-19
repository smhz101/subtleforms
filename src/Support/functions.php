<?php
/**
 * SubtleForms global helper functions.
 *
 * @package SubtleForms\Support
 * @since   1.9.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'subtleforms_is_pro_active' ) ) {
	/**
	 * Whether the SubtleForms Pro plugin is active and loaded.
	 *
	 * SubtleForms Pro returns true from the `subtleforms_is_pro_active` filter.
	 * Use it to show or hide information about Pro, never to switch off code
	 * that ships in this plugin.
	 *
	 * @since 2.3.9 Renamed from sf_is_pro_active().
	 *
	 * @return bool
	 */
	function subtleforms_is_pro_active(): bool {
		return (bool) apply_filters( 'subtleforms_is_pro_active', false );
	}
}
