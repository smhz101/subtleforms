<?php


/**
 * Admin Notices
 *
 * Displays actionable admin notices on SubtleForms screens.
 *
 * @package SubtleForms\Admin
 */

namespace SubtleForms\Admin;

use SubtleForms\Compat\OutdatedAddOnGuard;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Registers and renders admin notices for the SubtleForms plugin.
 */
class AdminNotices {

	/**
	 * Register WordPress hooks.
	 */
	public static function register(): void {
		add_action( 'admin_notices', array( self::class, 'maybe_show_permalink_notice' ) );
		add_action( 'admin_notices', array( self::class, 'maybe_show_outdated_add_on_notice' ) );
		add_action( 'network_admin_notices', array( self::class, 'maybe_show_outdated_add_on_notice' ) );
	}

	/**
	 * Show a notice when plain permalinks are active, which breaks the REST API.
	 *
	 * The notice is only shown on SubtleForms admin screens so it does not
	 * clutter unrelated pages.
	 */
	public static function maybe_show_permalink_notice(): void {
		// Only show on SubtleForms screens.
		$screen = get_current_screen();
		if ( ! $screen || strpos( $screen->id, 'subtleforms' ) === false ) {
			return;
		}

		// Plain permalinks (empty string) break pretty REST API URLs.
		if ( get_option( 'permalink_structure' ) !== '' ) {
			return;
		}

		$permalink_url = admin_url( 'options-permalink.php' );

		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			wp_kses(
				sprintf(
					/* translators: %s: URL to the Permalinks settings page */
					__( '<strong>SubtleForms:</strong> The REST API requires pretty permalinks to be enabled. <a href="%s">Update your permalink settings</a> and choose any option other than "Plain".', 'subtleforms' ),
					esc_url( $permalink_url )
				),
				array(
					'strong' => array(),
					'a'      => array( 'href' => array() ),
				)
			)
		);
	}

	/**
	 * Say that an installed add-on was stopped because it is too old.
	 *
	 * Shown on SubtleForms screens and on the Plugins screen (where the add-on
	 * is updated) to people who can manage plugins. See OutdatedAddOnGuard.
	 */
	public static function maybe_show_outdated_add_on_notice(): void {
		$blocked = OutdatedAddOnGuard::blocked_version();
		if ( '' === $blocked || ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		$screen = get_current_screen();
		if ( ! $screen ) {
			return;
		}
		if ( strpos( $screen->id, 'subtleforms' ) === false && ! in_array( $screen->id, array( 'plugins', 'plugins-network' ), true ) ) {
			return;
		}

		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			esc_html(
				sprintf(
					/* translators: 1: installed SubtleForms Pro version, 2: first compatible version */
					__( 'SubtleForms Pro %1$s is not compatible with this version of SubtleForms. Update SubtleForms Pro to version %2$s or later.', 'subtleforms' ),
					$blocked,
					OutdatedAddOnGuard::minimum_version()
				)
			)
		);
	}
}
