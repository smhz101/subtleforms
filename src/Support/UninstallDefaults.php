<?php
/**
 * What happens to the data when the plugin is deleted (2.10.0).
 *
 * New sites keep their forms and entries by default, and the Plugins screen
 * says whether deleting the plugin will remove them. Sites that already have
 * SubtleForms keep whatever they chose before.
 *
 * @package SubtleForms\Support
 * @since   2.10.0
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Default for "Keep my data when the plugin is deleted" and the Plugins screen note.
 */
final class UninstallDefaults {

	/**
	 * Register hooks. Called once from Plugin::init().
	 */
	public static function register(): void {
		add_filter( 'plugin_row_meta', array( __CLASS__, 'rowMeta' ), 10, 2 );
	}

	/**
	 * After the activation steps: a new install keeps its data when the
	 * plugin is deleted. An existing site is left as it is, including a site
	 * whose settings do not have the key, which means off.
	 *
	 * @param bool $fresh From SpamDefaults::isFreshInstall(), read before activation.
	 */
	public static function afterActivate( bool $fresh ): void {
		if ( ! $fresh ) {
			return;
		}
		$settings = get_option( Settings::OPTION_NAME, array() );
		$settings = is_array( $settings ) ? $settings : array();
		if ( array_key_exists( 'keep_data_on_uninstall', $settings ) ) {
			return;
		}
		$settings['keep_data_on_uninstall'] = true;
		update_option( Settings::OPTION_NAME, $settings );
	}

	/**
	 * Where the choice lives: the Advanced tab of Settings.
	 */
	public static function settingsUrl(): string {
		return admin_url( 'admin.php?page=subtleforms-settings' ) . '#tab=advanced';
	}

	/**
	 * Add one line to the SubtleForms row on the Plugins screen.
	 *
	 * @param array  $meta Row meta items.
	 * @param string $file Plugin basename of the row.
	 * @return array
	 */
	public static function rowMeta( $meta, $file = '' ) {
		if ( ! is_array( $meta ) || ! defined( 'SUBTLEFORMS_PLUGIN_BASENAME' ) || SUBTLEFORMS_PLUGIN_BASENAME !== $file ) {
			return $meta;
		}
		if ( ! current_user_can( 'delete_plugins' ) ) {
			return $meta;
		}

		$link = '<a href="' . esc_url( self::settingsUrl() ) . '">' . esc_html__( 'Change', 'subtleforms' ) . '</a>';
		if ( Uninstaller::keeps_data() ) {
			$meta[] = '<span class="subtleforms-keep-note">' . esc_html__( 'Forms and entries are kept if the plugin is deleted.', 'subtleforms' ) . '</span> ' . $link;
		} else {
			$meta[] = '<span class="subtleforms-delete-warning" style="color:#d63638">' . esc_html__( 'Deleting removes all forms and entries.', 'subtleforms' ) . '</span> ' . $link;
		}
		return $meta;
	}
}
