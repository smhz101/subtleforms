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
	 * User meta that remembers which add-on version a person dismissed the
	 * outdated add-on notice for. The notice returns when the installed
	 * version changes.
	 */
	public const OUTDATED_DISMISSED_META = 'subtleforms_dismissed_outdated_addon';

	/**
	 * Nonce action and AJAX action for dismissing that notice.
	 */
	public const OUTDATED_DISMISS_ACTION = 'subtleforms_dismiss_outdated_addon';

	/**
	 * Register WordPress hooks.
	 */
	public static function register(): void {
		add_action( 'admin_notices', array( self::class, 'maybe_show_permalink_notice' ) );
		add_action( 'admin_notices', array( self::class, 'maybe_show_outdated_add_on_notice' ) );
		add_action( 'network_admin_notices', array( self::class, 'maybe_show_outdated_add_on_notice' ) );
		add_action( 'wp_ajax_' . self::OUTDATED_DISMISS_ACTION, array( self::class, 'dismiss_outdated_add_on_notice' ) );
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

		// A person who dismissed the notice for this installed version does not
		// see it again until the version changes.
		if ( get_user_meta( get_current_user_id(), self::OUTDATED_DISMISSED_META, true ) === $blocked ) {
			return;
		}

		printf(
			'<div class="notice notice-error is-dismissible sf-outdated-add-on-notice" data-version="%1$s" data-nonce="%2$s"><p>%3$s</p></div>',
			esc_attr( $blocked ),
			esc_attr( wp_create_nonce( self::OUTDATED_DISMISS_ACTION ) ),
			esc_html(
				sprintf(
					/* translators: 1: installed SubtleForms Pro version, 2: first compatible version */
					__( 'SubtleForms Pro %1$s is not compatible with this version of SubtleForms. Update SubtleForms Pro to version %2$s or later.', 'subtleforms' ),
					$blocked,
					OutdatedAddOnGuard::minimum_version()
				)
			)
		);

		// Remember the dismissal. The button is WordPress's own; this only
		// tells the server which version was dismissed.
		wp_print_inline_script_tag(
			'document.addEventListener("click",function(e){var b=e.target.closest(".sf-outdated-add-on-notice .notice-dismiss");if(!b){return;}var n=b.closest(".sf-outdated-add-on-notice");var d=new FormData();d.append("action",' . wp_json_encode( self::OUTDATED_DISMISS_ACTION ) . ');d.append("nonce",n.getAttribute("data-nonce"));d.append("version",n.getAttribute("data-version"));fetch(' . wp_json_encode( admin_url( 'admin-ajax.php' ) ) . ',{method:"POST",body:d,credentials:"same-origin"});});'
		);
	}

	/**
	 * Remember that the current person dismissed the outdated add-on notice
	 * for the add-on version that is installed now.
	 */
	public static function dismiss_outdated_add_on_notice(): void {
		check_ajax_referer( self::OUTDATED_DISMISS_ACTION, 'nonce' );
		if ( ! current_user_can( 'activate_plugins' ) ) {
			wp_send_json_error( null, 403 );
		}
		// Only the version that is blocked now can be dismissed, so a stale or
		// forged value cannot hide a later, different notice.
		$blocked = OutdatedAddOnGuard::blocked_version();
		$sent    = isset( $_POST['version'] ) ? sanitize_text_field( wp_unslash( $_POST['version'] ) ) : '';
		if ( '' === $blocked || $sent !== $blocked ) {
			wp_send_json_error( null, 400 );
		}
		update_user_meta( get_current_user_id(), self::OUTDATED_DISMISSED_META, $blocked );
		wp_send_json_success();
	}
}
