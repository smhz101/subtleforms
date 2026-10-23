<?php
/**
 * Removes SubtleForms data when the plugin is deleted.
 *
 * @package SubtleForms\Support
 */

namespace SubtleForms\Support;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Site cleanup used by uninstall.php. The "Keep my data when the plugin is
 * deleted" setting (keep_data_on_uninstall, off by default) skips the site it
 * is set on. Options, tables, user meta and cron events that belong to
 * SubtleForms Pro are never removed here: Pro names them with the
 * subtleforms_pro_ prefix, and its license key and license data options are
 * listed in PRO_OPTIONS.
 */
final class Uninstaller {

	/** Prefix of everything SubtleForms Pro owns (without the leading subtleforms). */
	private const PRO_SUFFIX = '_pro_';

	/**
	 * Pro options that do not carry the Pro prefix.
	 */
	private const PRO_OPTIONS = array( 'subtleforms_license_key', 'subtleforms_license_data' );

	/**
	 * Clean every site. On a network, each site is cleaned on its own.
	 */
	public static function run(): void {
		if ( function_exists( 'is_multisite' ) && is_multisite() && function_exists( 'get_sites' ) ) {
			$sites = get_sites(
				array(
					'number' => 0,
					'fields' => 'ids',
				)
			);
			$kept = false;
			foreach ( (array) $sites as $blog_id ) {
				switch_to_blog( (int) $blog_id );
				if ( self::keeps_data() ) {
					$kept = true;
				}
				self::clean_site();
				restore_current_blog();
			}
			// Network options stay while any site keeps its data.
			if ( ! $kept ) {
				self::clean_network();
			}
			return;
		}

		self::clean_site();
	}

	/**
	 * Whether this site asked to keep its SubtleForms data.
	 */
	public static function keeps_data(): bool {
		$settings = get_option( 'subtleforms_settings', array() );
		return is_array( $settings ) && ! empty( $settings['keep_data_on_uninstall'] );
	}

	/**
	 * Drop this site's tables, options, transients, user meta and cron.
	 */
	public static function clean_site(): void {
		if ( self::keeps_data() ) {
			return;
		}

		global $wpdb;

		// Read the private uploads folder name before its option is deleted.
		$upload_folder = (string) get_option( 'subtleforms_upload_folder', '' );

		$like = $wpdb->esc_like( $wpdb->prefix . 'subtleforms_' ) . '%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$tables = $wpdb->get_col( $wpdb->prepare( 'SHOW TABLES LIKE %s', $like ) );
		foreach ( (array) $tables as $table ) {
			if ( self::is_pro_table( (string) $table ) ) {
				continue;
			}
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Table names come from SHOW TABLES for this plugin's prefix.
			$wpdb->query( "DROP TABLE IF EXISTS {$table}" );
		}

		// Each base also has a Pro form (subtleforms_pro_, _transient_subtleforms_pro_)
		// that is kept, as are the Pro options without the prefix.
		$option_bases = array( 'subtleforms', '_transient_subtleforms', '_transient_timeout_subtleforms', '_site_transient_subtleforms', '_site_transient_timeout_subtleforms' );
		$kept_options = implode( ', ', array_fill( 0, count( self::PRO_OPTIONS ), '%s' ) );
		foreach ( $option_bases as $base ) {
			$pattern = $wpdb->esc_like( 'subtleforms' === $base ? 'subtleforms_' : $base ) . '%';
			$pro     = $wpdb->esc_like( $base . self::PRO_SUFFIX ) . '%';
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- The IN list holds only placeholders.
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s AND option_name NOT LIKE %s AND option_name NOT IN ({$kept_options})", $pattern, $pro, ...self::PRO_OPTIONS ) );
		}

		$meta_like = $wpdb->esc_like( 'subtleforms' ) . '%';
		$meta_pro  = $wpdb->esc_like( 'subtleforms' . self::PRO_SUFFIX ) . '%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE %s AND meta_key NOT LIKE %s", $meta_like, $meta_pro ) );

		self::clear_cron();
		self::remove_uploads( $upload_folder );

		if ( function_exists( 'flush_rewrite_rules' ) ) {
			flush_rewrite_rules();
		}
	}

	/**
	 * Network-level options, which are not stored on a single site.
	 */
	private static function clean_network(): void {
		global $wpdb;
		if ( empty( $wpdb->sitemeta ) ) {
			return;
		}
		$like = $wpdb->esc_like( 'subtleforms' ) . '%';
		$pro  = $wpdb->esc_like( 'subtleforms' . self::PRO_SUFFIX ) . '%';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->sitemeta} WHERE meta_key LIKE %s AND meta_key NOT LIKE %s", $like, $pro ) );
	}

	/**
	 * Whether a table belongs to SubtleForms Pro.
	 *
	 * @param string $table Full table name, with the site prefix.
	 */
	private static function is_pro_table( string $table ): bool {
		global $wpdb;
		return str_starts_with( $table, $wpdb->prefix . 'subtleforms' . self::PRO_SUFFIX );
	}

	/**
	 * Clear every scheduled SubtleForms hook, including events that carry arguments.
	 */
	private static function clear_cron(): void {
		if ( ! function_exists( '_get_cron_array' ) || ! function_exists( 'wp_clear_scheduled_hook' ) ) {
			return;
		}
		$crons = _get_cron_array();
		if ( ! is_array( $crons ) ) {
			return;
		}
		$hooks = array();
		foreach ( $crons as $events ) {
			if ( ! is_array( $events ) ) {
				continue;
			}
			foreach ( array_keys( $events ) as $hook ) {
				if ( is_string( $hook ) && str_starts_with( $hook, 'subtleforms' ) && ! str_starts_with( $hook, 'subtleforms' . self::PRO_SUFFIX ) ) {
					$hooks[ $hook ] = true;
				}
			}
		}
		foreach ( array_keys( $hooks ) as $hook ) {
			wp_clear_scheduled_hook( $hook );
		}
	}

	/**
	 * Delete privately stored uploads for this site.
	 */
	private static function remove_uploads( string $folder = '' ): void {
		if ( ! function_exists( 'wp_upload_dir' ) ) {
			return;
		}
		$uploads = wp_upload_dir( null, false );
		if ( empty( $uploads['basedir'] ) ) {
			return;
		}
		// New sites store files in a folder with a random name (2.3.9).
		$folders = array( 'subtleforms-uploads', 'subtleforms-pdf-tmp' );
		if ( 1 === preg_match( '/^subtleforms-uploads-[a-z0-9]{16}$/', $folder ) ) {
			$folders[] = $folder;
		}
		$dirs = array();
		foreach ( $folders as $name ) {
			$dir = trailingslashit( $uploads['basedir'] ) . $name;
			if ( is_dir( $dir ) ) {
				$dirs[] = $dir;
			}
		}
		if ( ! $dirs ) {
			return;
		}
		if ( ! function_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		if ( ! WP_Filesystem() ) {
			return;
		}
		global $wp_filesystem;
		foreach ( $dirs as $dir ) {
			$wp_filesystem->rmdir( $dir, true );
		}
	}
}
