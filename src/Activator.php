<?php
/**
 * SubtleForms Activator
 *
 * @package   SubtleForms
 * @version   0.1.0
 */

namespace SubtleForms;

if ( ! defined( 'ABSPATH' ) ) { exit; }

use SubtleForms\Support\Logger;
/**
 * Handles plugin activation tasks.
 */
final class Activator {

	/**
	 * Activate the plugin.
	 */
	public static function activate(): void {
		// Check PHP version requirement
		if ( version_compare( PHP_VERSION, '7.4', '<' ) ) {
			deactivate_plugins( SUBTLEFORMS_PLUGIN_BASENAME );
			wp_die(
				sprintf(
					/* translators: %s: Current PHP version */
					esc_html__( 'SubtleForms requires PHP 7.4 or higher. Your server is running PHP %s', 'subtleforms' ),
					PHP_VERSION
				),
				esc_html__( 'Plugin Activation Error', 'subtleforms' ),
				array( 'back_link' => true )
			);
		}

		// Check WordPress version requirement
		global $wp_version;
		if ( version_compare( $wp_version, '5.0', '<' ) ) {
			deactivate_plugins( SUBTLEFORMS_PLUGIN_BASENAME );
			wp_die(
				sprintf(
					/* translators: %s: Current WordPress version */
					esc_html__( 'SubtleForms requires WordPress 5.0 or higher. You are running %s', 'subtleforms' ),
					$wp_version // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $wp_version is a trusted WordPress core global.
				),
				esc_html__( 'Plugin Activation Error', 'subtleforms' ),
				array( 'back_link' => true )
			);
		}

		// Create database tables
		self::create_tables();

		// Migrate data if needed
		self::migrate_submissions_table();
		self::migrate_draft_schema_column();
		self::migrate_is_read_column();

		// Set default options
		self::set_default_options();

		// Schedule privacy cron jobs
		if ( ! wp_next_scheduled( 'subtleforms_daily_cleanup' ) ) {
			wp_schedule_event( time(), 'daily', 'subtleforms_daily_cleanup' );
		}

		// Flush rewrite rules
		flush_rewrite_rules();

		// Store activation timestamp
		update_option( 'subtleforms_activated_at', time() );
	}

	/**
	 * Create plugin database tables.
	 */
	private static function create_tables(): void {
		global $wpdb;
		$charset_collate = $wpdb->get_charset_collate();

		// Forms table - dbDelta requires exact syntax (no IF NOT EXISTS, two spaces after PRIMARY KEY)
		$forms_table = $wpdb->prefix . 'subtleforms_forms';
		$forms_sql   = "CREATE TABLE {$forms_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  title varchar(255) NOT NULL,
  config longtext NOT NULL,
  draft_schema longtext DEFAULT NULL,
  active_version int unsigned DEFAULT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY status (status)
) {$charset_collate};";

		// Submissions table
		$submissions_table = $wpdb->prefix . 'subtleforms_submissions';
		$submissions_sql   = "CREATE TABLE {$submissions_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  form_id bigint(20) unsigned NOT NULL,
  schema_version int unsigned DEFAULT NULL,
  payload longtext NOT NULL,
  meta longtext,
  status varchar(20) NOT NULL DEFAULT 'pending',
  is_read tinyint(1) NOT NULL DEFAULT 0,
  ip_address varchar(45),
  user_agent varchar(255),
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY form_id (form_id),
  KEY status (status),
  KEY is_read (is_read),
  KEY created_at (created_at)
) {$charset_collate};";

		// Schemas table (versioned form schemas)
		$schemas_table = $wpdb->prefix . 'subtleforms_form_schemas';
		$schemas_sql   = "CREATE TABLE {$schemas_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  form_id bigint(20) unsigned NOT NULL,
  version int unsigned NOT NULL,
  schema_data longtext NOT NULL,
  active tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY form_id (form_id),
  KEY version (version),
  KEY active (active)
) {$charset_collate};";

		// Logs table
		$logs_table = $wpdb->prefix . 'subtleforms_logs';
		$logs_sql   = "CREATE TABLE {$logs_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  submission_id bigint(20) unsigned NOT NULL,
  level varchar(20) NOT NULL DEFAULT 'info',
  message text NOT NULL,
  context longtext,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY submission_id (submission_id),
  KEY level (level),
  KEY created_at (created_at)
) {$charset_collate};";

		// License metadata table (Pro version)
		$license_table = $wpdb->prefix . 'subtleforms_license_meta';
		$license_sql   = "CREATE TABLE {$license_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  license_key varchar(255) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'inactive',
  plan varchar(50) NOT NULL DEFAULT 'free',
  domain varchar(255) NOT NULL,
  activations int unsigned NOT NULL DEFAULT 0,
  activation_limit int unsigned NOT NULL DEFAULT 1,
  expires_at int unsigned DEFAULT NULL,
  activated_at int unsigned DEFAULT NULL,
  last_checked int unsigned DEFAULT NULL,
  metadata longtext,
  PRIMARY KEY  (id),
  UNIQUE KEY license_key (license_key),
  KEY status (status),
  KEY domain (domain),
  KEY expires_at (expires_at)
) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$results                = array();
		$results['forms']       = dbDelta( $forms_sql );
		$results['submissions'] = dbDelta( $submissions_sql );
		$results['schemas']     = dbDelta( $schemas_sql );
		$results['logs']        = dbDelta( $logs_sql );
		$results['license']     = dbDelta( $license_sql );

		// Verify tables were created
		$tables_to_check = array(
			'forms'       => $forms_table,
			'submissions' => $submissions_table,
			'schemas'     => $schemas_table,
			'logs'        => $logs_table,
			'license'     => $license_table,
		);

		$missing_tables = array();
		foreach ( $tables_to_check as $name => $table_name ) {
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is controlled from $wpdb->prefix.
			$table_exists = $wpdb->get_var( "SHOW TABLES LIKE '{$table_name}'" );
			if ( $table_exists !== $table_name ) {
				$missing_tables[] = $name;
			}
		}

		if ( ! empty( $missing_tables ) ) {
			$error_message = sprintf(
				'SubtleForms failed to create the following database tables: %s. Please check your database permissions or contact your hosting provider.',
				implode( ', ', $missing_tables )
			);

			// Log the error
			Logger::error( 'Activation Error: ' . $error_message );
			Logger::error( 'dbDelta results: ' . print_r( $results, true ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_print_r

			// Show admin notice instead of wp_die to allow debugging
			add_option( 'subtleforms_activation_error', $error_message );

			deactivate_plugins( SUBTLEFORMS_PLUGIN_BASENAME );
			wp_die(
				$error_message . '<br><br>Debug info has been logged to your error log.', // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Internal activation error, not user-supplied.
				esc_html__( 'Database Creation Error', 'subtleforms' ),
				array( 'back_link' => true )
			);
		}

		// Store database version
		update_option( 'subtleforms_db_version', SUBTLEFORMS_VERSION );
	}

	/**
	 * Migrate submissions table data.
	 */
	private static function migrate_submissions_table(): void {
		global $wpdb;
		$table_name = $wpdb->prefix . 'subtleforms_submissions';

		// Check if form_version column exists (it might remain after dbDelta)
		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is controlled from $wpdb->prefix.
		$column_exists = $wpdb->get_results( "SHOW COLUMNS FROM {$table_name} LIKE 'form_version'" );

		if ( ! empty( $column_exists ) ) {
			// Copy form_version to schema_version where schema_version is NULL
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is controlled from $wpdb->prefix; no user-supplied values.
			$wpdb->query( "UPDATE {$table_name} SET schema_version = form_version WHERE schema_version IS NULL AND form_version IS NOT NULL" );
		}
	}

	/**
	 * Add is_read column to submissions table (v2.0 — separates admin read tracking from pipeline status).
	 */
	private static function migrate_is_read_column(): void {
		global $wpdb;
		$table_name = $wpdb->prefix . 'subtleforms_submissions';

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is controlled from $wpdb->prefix.
		$column_exists = $wpdb->get_results( "SHOW COLUMNS FROM {$table_name} LIKE 'is_read'" );

		if ( empty( $column_exists ) ) {
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Table name is controlled from $wpdb->prefix; ALTER TABLE cannot use prepare().
			$wpdb->query( "ALTER TABLE {$table_name} ADD COLUMN is_read tinyint(1) NOT NULL DEFAULT 0 AFTER status" );
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Table name is controlled from $wpdb->prefix; ALTER TABLE cannot use prepare().
			$wpdb->query( "ALTER TABLE {$table_name} ADD KEY is_read (is_read)" );
			Logger::info( 'Added is_read column to submissions table' );
		}
	}

	/**
	 * Migrate forms table to add draft_schema column.
	 * Added in version 1.4.0 to support draft/active schema separation.
	 */
	private static function migrate_draft_schema_column(): void {
		global $wpdb;
		$table_name = $wpdb->prefix . 'subtleforms_forms';

		// Check if draft_schema column exists
		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is controlled from $wpdb->prefix.
		$column_exists = $wpdb->get_results( "SHOW COLUMNS FROM {$table_name} LIKE 'draft_schema'" );

		if ( empty( $column_exists ) ) {
			// Add draft_schema column
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Table name is controlled from $wpdb->prefix; ALTER TABLE cannot use prepare().
			$wpdb->query( "ALTER TABLE {$table_name} ADD COLUMN draft_schema longtext DEFAULT NULL AFTER config" );
			Logger::info( 'Added draft_schema column to forms table' );
		}
	}

	/**
	 * Set default plugin options.
	 */
	private static function set_default_options(): void {
		$defaults = array(
			'subtleforms_version'            => SUBTLEFORMS_VERSION,
			'subtleforms_capabilities'       => array(),
			'subtleforms_extensions_enabled' => array(),
		);

		foreach ( $defaults as $key => $value ) {
			if ( get_option( $key ) === false ) {
				add_option( $key, $value );
			}
		}
	}
}
