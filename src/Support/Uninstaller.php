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
 * SubtleForms Pro are never removed here: Pro names most of them with the
 * subtleforms_pro_ prefix, and the few that do not (coupons, stats, funnel,
 * the license options) are listed in the PRO_* constants below.
 */
final class Uninstaller {

	/** Prefix of everything SubtleForms Pro owns (without the leading subtleforms). */
	private const PRO_SUFFIX = '_pro_';

	/**
	 * Pro options that do not carry the Pro prefix.
	 */
	private const PRO_OPTIONS = array( 'subtleforms_license_key', 'subtleforms_license_data' );

	/**
	 * Pro tables and their "installed version" options that do not carry the
	 * Pro prefix. Names are the part after "subtleforms_"; the table is
	 * <site prefix>subtleforms_<stem> and the option subtleforms_<stem>_db
	 * (coupons, stats and funnel; the coupon use rows live in coupon_uses).
	 */
	private const PRO_STEMS = array( 'coupons', 'coupon_uses', 'stats', 'funnel' );

	/**
	 * Pro option, transient and cron names that start with these are kept
	 * (rate limit counters of Pro's view and funnel beacons, the stats prune event).
	 */
	private const PRO_NAME_PREFIXES = array( 'subtleforms_rl_funnel_', 'subtleforms_rl_view_', 'subtleforms_stats_prune' );

	/**
	 * Every Pro option without the Pro prefix.
	 *
	 * @return string[]
	 */
	private static function pro_options(): array {
		$options = self::PRO_OPTIONS;
		foreach ( self::PRO_STEMS as $stem ) {
			$options[] = 'subtleforms_' . $stem . '_db';
		}
		return $options;
	}

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
		$kept_options = implode( ', ', array_fill( 0, count( self::pro_options() ), '%s' ) );
		foreach ( $option_bases as $base ) {
			$pattern = $wpdb->esc_like( 'subtleforms' === $base ? 'subtleforms_' : $base ) . '%';
			$sql     = "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s AND option_name NOT LIKE %s AND option_name NOT IN ({$kept_options})";
			$args    = array( $pattern, $wpdb->esc_like( $base . self::PRO_SUFFIX ) . '%', ...self::pro_options() );
			foreach ( self::PRO_NAME_PREFIXES as $name_prefix ) {
				$sql   .= ' AND option_name NOT LIKE %s';
				$args[] = $wpdb->esc_like( preg_replace( '/^subtleforms/', $base, $name_prefix ) ) . '%';
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- The IN list and the extra conditions hold only placeholders.
			$wpdb->query( $wpdb->prepare( $sql, ...$args ) );
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
		if ( str_starts_with( $table, $wpdb->prefix . 'subtleforms' . self::PRO_SUFFIX ) ) {
			return true;
		}
		foreach ( self::PRO_STEMS as $stem ) {
			if ( $table === $wpdb->prefix . 'subtleforms_' . $stem ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Whether a hook or key name belongs to SubtleForms Pro.
	 *
	 * @param string $name Name such as a cron hook.
	 */
	private static function is_pro_name( string $name ): bool {
		if ( str_starts_with( $name, 'subtleforms' . self::PRO_SUFFIX ) ) {
			return true;
		}
		foreach ( self::PRO_NAME_PREFIXES as $prefix ) {
			if ( str_starts_with( $name, $prefix ) ) {
				return true;
			}
		}
		return false;
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
				if ( is_string( $hook ) && str_starts_with( $hook, 'subtleforms' ) && ! self::is_pro_name( $hook ) ) {
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
