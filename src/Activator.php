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
use SubtleForms\Support\Settings;
/**
 * Handles plugin activation tasks.
 */
final class Activator {

	/**
	 * Run the activation steps again when the version stored on the site
	 * is not this build's version. This is how an update that is not a
	 * fresh activation creates tables, runs migrations and schedules
	 * background jobs such as the entry schema clean-up (FF-30).
	 *
	 * @param string|null $current Version of this build. Defaults to SUBTLEFORMS_VERSION.
	 * @return bool Whether the activation steps ran.
	 */
	public static function maybe_upgrade( ?string $current = null ): bool {
		$explicit = null !== $current;
		$current  = $current ?? SUBTLEFORMS_VERSION;
		if ( get_option( 'subtleforms_db_version' ) === $current ) {
			return false;
		}

		// The implicit call from plugins_loaded must not run schema work on a
		// visitor's request. It runs for admin screens, admin-ajax and WP-CLI;
		// front-end code guards the columns it needs until it has run.
		if ( ! $explicit && ! self::is_upgrade_context() ) {
			return false;
		}

		if ( ! self::acquire_upgrade_lock() ) {
			return false;
		}

		try {
			self::activate();
			update_option( 'subtleforms_db_version', $current );
			update_option( 'subtleforms_version', $current );
		} finally {
			delete_option( self::UPGRADE_LOCK );
		}
		return true;
	}

	/**
	 * Option that holds the upgrade lock (value: unix time it was taken).
	 */
	const UPGRADE_LOCK = 'subtleforms_upgrade_lock';

	/**
	 * Whether this request may run schema upgrades on its own.
	 */
	private static function is_upgrade_context(): bool {
		return ( function_exists( 'is_admin' ) && is_admin() )
			|| ( defined( 'WP_CLI' ) && WP_CLI );
	}

	/**
	 * Take the upgrade lock. add_option() fails when the row exists, so two
	 * concurrent requests cannot both pass. A lock older than five minutes is
	 * treated as left behind by a crashed request.
	 */
	private static function acquire_upgrade_lock(): bool {
		if ( add_option( self::UPGRADE_LOCK, time(), '', false ) ) {
			return true;
		}
		$taken = (int) get_option( self::UPGRADE_LOCK, 0 );
		if ( $taken > 0 && ( time() - $taken ) > 300 ) {
			delete_option( self::UPGRADE_LOCK );
			return (bool) add_option( self::UPGRADE_LOCK, time(), '', false );
		}
		return false;
	}

	/**
	 * Activate the plugin.
	 */
	public static function activate(): void {
		// Check PHP version requirement
		if ( version_compare( PHP_VERSION, '8.1', '<' ) ) {
			deactivate_plugins( SUBTLEFORMS_PLUGIN_BASENAME );
			wp_die(
				sprintf(
					/* translators: %s: Current PHP version */
					esc_html__( 'SubtleForms requires PHP 8.1 or higher. Your server is running PHP %s', 'subtleforms' ),
					PHP_VERSION
				),
				esc_html__( 'Plugin Activation Error', 'subtleforms' ),
				array( 'back_link' => true )
			);
		}

		// Check WordPress version requirement
		global $wp_version;
		if ( version_compare( $wp_version, '6.6', '<' ) ) {
			deactivate_plugins( SUBTLEFORMS_PLUGIN_BASENAME );
			wp_die(
				sprintf(
					/* translators: %s: Current WordPress version */
					esc_html__( 'SubtleForms requires WordPress 6.6 or higher. You are running %s', 'subtleforms' ),
					$wp_version // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $wp_version is a trusted WordPress core global.
				),
				esc_html__( 'Plugin Activation Error', 'subtleforms' ),
				array( 'back_link' => true )
			);
		}

		// Read before the tables store the database version (2.6.0).
		$fresh_install = \SubtleForms\Support\SpamDefaults::isFreshInstall();

		// Create database tables
		self::create_tables();

		// Migrate data if needed
		self::migrate_submissions_table();
		self::migrate_draft_schema_column();
		self::migrate_is_read_column();
		self::migrate_starred_column();
		self::migrate_trash_columns();
		self::migrate_form_types();
		// Entries reference their schema version; old schema copies are
		// removed in batches in the background (FF-30, 2.4.0).
		\SubtleForms\Tools\EntrySchemaMigration::schedule();

		// Set default options
		self::set_default_options();
		Settings::remove_ai_options();
		// New installs start with spam protection on; existing sites are
		// offered it once on the dashboard and nothing changes on its own.
		\SubtleForms\Support\SpamDefaults::afterActivate( $fresh_install );

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
  trashed_from varchar(20) DEFAULT NULL,
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
  starred tinyint(1) NOT NULL DEFAULT 0,
  trashed_from varchar(20) DEFAULT NULL,
  trashed_at datetime DEFAULT NULL,
  ip_address varchar(45),
  user_agent varchar(255),
  user_id bigint(20) unsigned NOT NULL DEFAULT 0,
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY form_id (form_id),
  KEY form_user (form_id, user_id),
  KEY status (status),
  KEY is_read (is_read),
  KEY starred (starred),
  KEY trashed_at (trashed_at),
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

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$results                = array();
		$results['forms']       = dbDelta( $forms_sql );
		$results['submissions'] = dbDelta( $submissions_sql );
		$results['schemas']     = dbDelta( $schemas_sql );
		$results['logs']        = dbDelta( $logs_sql );
		\SubtleForms\Tools\ApiLog::install();
		update_option( 'subtleforms_api_log_table', '1', false );

		// Verify tables were created
		$tables_to_check = array(
			'forms'       => $forms_table,
			'submissions' => $submissions_table,
			'schemas'     => $schemas_table,
			'logs'        => $logs_table,
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
			Logger::debug( 'dbDelta results: %s', wp_json_encode( $results ) );

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
	 * Add is_read column to submissions table (v2.0, separates admin read tracking from pipeline status).
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
			// Older builds stored read/unread in status. Map those rows so the new
			// column matches what admins already saw before this migration.
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is controlled from $wpdb->prefix.
			$wpdb->query( "UPDATE {$table_name} SET is_read = 1 WHERE status = 'read'" );
			Logger::info( 'Added is_read column to submissions table' );
		}
	}

	/**
	 * Add the starred column to the submissions table (2.3.0).
	 */
	private static function migrate_starred_column(): void {
		global $wpdb;
		$table_name = $wpdb->prefix . 'subtleforms_submissions';

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table name is controlled from $wpdb->prefix.
		$column_exists = $wpdb->get_results( "SHOW COLUMNS FROM {$table_name} LIKE 'starred'" );

		if ( empty( $column_exists ) ) {
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Table name is controlled from $wpdb->prefix; ALTER TABLE cannot use prepare().
			$wpdb->query( "ALTER TABLE {$table_name} ADD COLUMN starred tinyint(1) NOT NULL DEFAULT 0" );
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Table name is controlled from $wpdb->prefix; ALTER TABLE cannot use prepare().
			$wpdb->query( "ALTER TABLE {$table_name} ADD KEY starred (starred)" );
			Logger::info( 'Added starred column to submissions table' );
		}
	}

	/**
	 * Form types follow the structure (2.3.2).
	 *
	 * Before 2.3.2 adding a Page Break to a Standard form kept the type
	 * "Standard" everywhere (builder, All Forms, dashboard). Every stored
	 * schema (draft, published config and the active version) gets the type
	 * its structure gives: Multi-step when it has a Page Break, Standard when
	 * a Multi-step form has none. Conversational forms are not touched.
	 * Safe to run more than once.
	 *
	 * @return int Number of stored schemas changed.
	 */
	public static function migrate_form_types(): int {
		global $wpdb;
		$forms   = $wpdb->prefix . 'subtleforms_forms';
		$schemas = $wpdb->prefix . 'subtleforms_form_schemas';
		$changed = 0;

		$sync = static function ( $json ) {
			if ( ! is_string( $json ) || '' === $json ) {
				return null;
			}
			$schema = json_decode( $json, true );
			if ( ! is_array( $schema ) || ! isset( $schema['fields'] ) ) {
				return null;
			}
			list( $schema, $didChange ) = \SubtleForms\Support\SchemaRepair::syncType( $schema );
			return $didChange ? wp_json_encode( $schema ) : null;
		};

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Fixed table name; one-time upgrade.
		$rows = $wpdb->get_results( "SELECT id, config, draft_schema FROM {$forms}", ARRAY_A );
		foreach ( (array) $rows as $row ) {
			$update = array();
			$config = $sync( $row['config'] ?? null );
			if ( null !== $config ) {
				$update['config'] = $config;
			}
			$draft = $sync( $row['draft_schema'] ?? null );
			if ( null !== $draft ) {
				$update['draft_schema'] = $draft;
			}
			if ( $update ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time upgrade.
				$wpdb->update( $forms, $update, array( 'id' => (int) $row['id'] ) );
				wp_cache_delete( 'subtleforms_form_' . (int) $row['id'], 'subtleforms' );
				$changed += count( $update );
			}
		}

		// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Fixed table name; one-time upgrade.
		$active = $wpdb->get_results( "SELECT id, form_id, schema_data FROM {$schemas} WHERE active = 1", ARRAY_A );
		foreach ( (array) $active as $row ) {
			$data = $sync( $row['schema_data'] ?? null );
			if ( null !== $data ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One-time upgrade.
				$wpdb->update( $schemas, array( 'schema_data' => $data ), array( 'id' => (int) $row['id'] ) );
				wp_cache_delete( 'subtleforms_schema_' . (int) $row['form_id'], 'subtleforms' );
				++$changed;
			}
		}

		if ( $changed ) {
			Logger::info( 'Form types: %d stored schema(s) now follow their structure.', $changed );
		}
		return $changed;
	}

	/**
	 * Trash columns (2.3.1).
	 *
	 * - forms.trashed_from: the status a form had before it was trashed, so
	 *   Restore returns it to that status.
	 * - submissions.trashed_from / trashed_at: entries in the Trash keep their
	 *   previous status and the time they were trashed, for Restore and for
	 *   emptying the Trash after the retention period.
	 */
	private static function migrate_trash_columns(): void {
		global $wpdb;
		$columns = array(
			array( $wpdb->prefix . 'subtleforms_forms', 'trashed_from', 'varchar(20) DEFAULT NULL' ),
			array( $wpdb->prefix . 'subtleforms_submissions', 'trashed_from', 'varchar(20) DEFAULT NULL' ),
			array( $wpdb->prefix . 'subtleforms_submissions', 'trashed_at', 'datetime DEFAULT NULL' ),
		);
		foreach ( $columns as list( $table, $column, $definition ) ) {
			// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Table and column names are fixed strings.
			$exists = $wpdb->get_results( "SHOW COLUMNS FROM {$table} LIKE '{$column}'" );
			if ( empty( $exists ) ) {
				// phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange -- Fixed table/column names; ALTER TABLE cannot use prepare().
				$wpdb->query( "ALTER TABLE {$table} ADD COLUMN {$column} {$definition}" );
				Logger::info( 'Added %s column to %s', $column, $table );
			}
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
