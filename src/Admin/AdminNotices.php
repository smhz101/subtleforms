<?php
/**
 * Admin Notices
 *
 * Displays actionable admin notices on SubtleForms screens.
 *
 * @package SubtleForms\Admin
 */

namespace SubtleForms\Admin;

/**
 * Registers and renders admin notices for the SubtleForms plugin.
 */
class AdminNotices {

	/**
	 * Register WordPress hooks.
	 */
	public static function register(): void {
		add_action( 'admin_notices', array( self::class, 'maybe_show_permalink_notice' ) );
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
}
