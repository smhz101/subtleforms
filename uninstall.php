<?php
/**
 * SubtleForms Uninstall
 *
 * Fired when the plugin is deleted (not deactivated) from the WordPress admin.
 * Cleans up all database tables, options, transients, user meta, and cron jobs
 * created by the plugin.
 *
 * @package SubtleForms
 * @since   1.9.0
 */

// Abort if not called by WordPress uninstall process.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

// ── 1. Drop custom database tables ──────────────────────────────────────────
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Uninstall script scope; not a global.
$tables = array(
	$wpdb->prefix . 'subtleforms_forms',
	$wpdb->prefix . 'subtleforms_submissions',
	$wpdb->prefix . 'subtleforms_form_schemas',
	$wpdb->prefix . 'subtleforms_logs',
	$wpdb->prefix . 'subtleforms_license_meta',
);

// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Uninstall script scope.
foreach ( $tables as $table ) {
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- DROP TABLE at uninstall; table names from $wpdb->prefix.
	$wpdb->query( "DROP TABLE IF EXISTS {$table}" );
}

// ── 2. Delete plugin options ─────────────────────────────────────────────────
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Uninstall script scope; not a global.
$options = array(
	'subtleforms_version',
	'subtleforms_db_version',
	'subtleforms_activated_at',
	'subtleforms_deactivated_at',
	'subtleforms_activation_error',
	'subtleforms_settings',
	'subtleforms_settings_version',
	'subtleforms_capabilities',
	'subtleforms_extensions_enabled',
	'subtleforms_license_key',
	'subtleforms_license_data',
	'subtleforms_license_grace_period',
	'subtleforms_onboarding_dismissed',
);

// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Uninstall script scope.
foreach ( $options as $option ) {
	delete_option( $option );
}

// ── 3. Delete transients ────────────────────────────────────────────────────
delete_transient( 'subtleforms_dashboard_stats' );

// Clean up rate limiter transients (pattern: sf_rl_*)
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	"DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_sf_rl_%' OR option_name LIKE '_transient_timeout_sf_rl_%'"
);

// Clean up license check transients
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	"DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_subtleforms_license_%' OR option_name LIKE '_transient_timeout_subtleforms_license_%'"
);

// ── 4. Delete user meta ─────────────────────────────────────────────────────
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Uninstall script scope; not a global.
$user_meta_keys = array(
	'subtleforms_onboarding_dismissed',
	'subtleforms_create_wizard_dismissed',
	'subtleforms_tour_completed',
);

// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Uninstall script scope; not a global.
foreach ( $user_meta_keys as $meta_key ) {
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Intentional meta_key delete at uninstall.
	$wpdb->delete( $wpdb->usermeta, array( 'meta_key' => $meta_key ) );
}

// ── 5. Clear scheduled cron events ──────────────────────────────────────────
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Uninstall script scope; not a global.
$cron_hooks = array(
	'subtleforms_daily_cleanup',
	'subtleforms_daily_license_check',
	'subtleforms_async_email',
	'subtleforms_async_webhook',
);

// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Uninstall script scope; not a global.
foreach ( $cron_hooks as $hook ) {
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Uninstall script scope; not a global.
	$timestamp = wp_next_scheduled( $hook );
	if ( $timestamp ) {
		wp_unschedule_event( $timestamp, $hook );
	}
}

// ── 6. Flush rewrite rules ──────────────────────────────────────────────────
flush_rewrite_rules();
