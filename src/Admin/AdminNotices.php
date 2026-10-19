<?php


/**
 * Admin Notices
 *
 * Displays actionable admin notices on SubtleForms screens.
 *
 * @package SubtleForms\Admin
 */

namespace SubtleForms\Admin;

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
		add_action( 'admin_notices', array( self::class, 'maybe_show_pro_update_notice' ) );
	}

	/**
	 * Oldest SubtleForms Pro that registers its own Signature, Calculation and
	 * Card Payment fields (these left the free plugin in 2.3.9).
	 */
	const MIN_PRO_VERSION = '2.4.0';

	/**
	 * Ask for a SubtleForms Pro update when an older Pro is active.
	 */
	public static function maybe_show_pro_update_notice(): void {
		if ( ! self::pro_needs_update() || ! current_user_can( 'update_plugins' ) ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || ( false === strpos( (string) $screen->id, 'subtleforms' ) && 'plugins' !== $screen->id ) ) {
			return;
		}
		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			esc_html(
				sprintf(
					/* translators: %s: minimum SubtleForms Pro version */
					__( 'SubtleForms: please update SubtleForms Pro to %s or later. Older versions do not add the Signature, Calculation and Card Payment fields to this version of SubtleForms, so forms that use them will not show those fields until you update.', 'subtleforms' ),
					self::MIN_PRO_VERSION
				)
			)
		);
	}

	/**
	 * Whether an active SubtleForms Pro is older than MIN_PRO_VERSION.
	 */
	public static function pro_needs_update(): bool {
		return defined( 'SUBTLEFORMS_PRO_VERSION' )
			&& version_compare( (string) constant( 'SUBTLEFORMS_PRO_VERSION' ), self::MIN_PRO_VERSION, '<' );
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
