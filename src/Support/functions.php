<?php
/**
 * SubtleForms Global Helper Functions
 *
 * Provides a clean filter-based API for Pro detection and feature gating.
 * The free plugin has zero knowledge of any Pro implementation — everything
 * is delegated via standard WordPress filters.
 *
 * @package SubtleForms\Support
 * @since   1.9.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'sf_is_pro_active' ) ) {
	/**
	 * Whether the SubtleForms Pro plugin is active and loaded.
	 *
	 * The Pro plugin overrides `subtleforms_is_pro_active` to return true.
	 *
	 * @return bool
	 */
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- sf_ is the intentional short prefix for public API functions.
	function sf_is_pro_active(): bool {
		return (bool) apply_filters( 'subtleforms_is_pro_active', false );
	}
}

if ( ! function_exists( 'sf_is_feature_enabled' ) ) {
	/**
	 * Whether a named Pro feature is available on this site.
	 *
	 * The Pro plugin hooks `subtleforms_feature_enabled` to unlock features.
	 * The free plugin always returns false; Pro overrides per-feature.
	 *
	 * @param string $feature Feature key, e.g. 'webhooks', 'email_marketing', 'payments'.
	 * @return bool
	 */
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- sf_ is the intentional short prefix for public API functions.
	function sf_is_feature_enabled( string $feature ): bool {
		return (bool) apply_filters( 'subtleforms_feature_enabled', false, $feature );
	}
}

if ( ! function_exists( 'sf_show_upgrade_notice' ) ) {
	/**
	 * Output an upgrade-to-Pro notice with a CTA.
	 *
	 * Produces a simple, professional notice — no aggressive marketing.
	 * Safe to call inside any admin context where HTML output is appropriate.
	 *
	 * @param string $message Human-readable description of the locked feature.
	 * @return void
	 */
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- sf_ is the intentional short prefix for public API functions.
	function sf_show_upgrade_notice( string $message ): void {
		$upgrade_url = 'https://subtleforms.com/pricing';

		printf(
			'<div class="sf-upgrade-notice">'
			. '<p class="sf-upgrade-notice__message">%s</p>'
			. '<a href="%s" target="_blank" rel="noopener noreferrer" class="button button-primary sf-upgrade-notice__cta">%s</a>'
			. '</div>',
			esc_html( $message ),
			esc_url( $upgrade_url ),
			esc_html__( 'Upgrade to Pro', 'subtleforms' )
		);
	}
}
