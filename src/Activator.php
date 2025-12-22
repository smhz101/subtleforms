<?php
/**
 * SubtleForms Activator
 *
 * @package   SubtleForms
 * @version   0.1.0
 */

namespace SubtleForms;

/**
 * Handles plugin activation tasks.
 */
final class Activator
{
    /**
     * Activate the plugin.
     */
    public static function activate(): void
    {
        // Check PHP version requirement
        if (version_compare(PHP_VERSION, '7.2', '<')) {
            deactivate_plugins(SUBTLEFORMS_PLUGIN_BASENAME);
            wp_die(
                'SubtleForms requires PHP 7.2 or higher. Your server is running PHP ' . PHP_VERSION,
                'Plugin Activation Error',
                ['back_link' => true]
            );
        }

        // Check WordPress version requirement
        global $wp_version;
        if (version_compare($wp_version, '5.0', '<')) {
            deactivate_plugins(SUBTLEFORMS_PLUGIN_BASENAME);
            wp_die(
                'SubtleForms requires WordPress 5.0 or higher. You are running ' . $wp_version,
                'Plugin Activation Error',
                ['back_link' => true]
            );
        }

        // Create database tables
        self::create_tables();

        // Set default options
        self::set_default_options();

        // Flush rewrite rules
        flush_rewrite_rules();

        // Store activation timestamp
        update_option('subtleforms_activated_at', time());
    }

    /**
     * Create plugin database tables.
     */
    private static function create_tables(): void
    {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        // Forms table - dbDelta requires exact syntax (no IF NOT EXISTS, two spaces after PRIMARY KEY)
        $forms_table = $wpdb->prefix . 'subtleforms_forms';
        $forms_sql = "CREATE TABLE {$forms_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  title varchar(255) NOT NULL,
  config longtext NOT NULL,
  active_version int unsigned DEFAULT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY status (status)
) {$charset_collate};";

        // Submissions table
        $submissions_table = $wpdb->prefix . 'subtleforms_submissions';
        $submissions_sql = "CREATE TABLE {$submissions_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  form_id bigint(20) unsigned NOT NULL,
  form_version int unsigned DEFAULT NULL,
  payload longtext NOT NULL,
  meta longtext,
  status varchar(20) NOT NULL DEFAULT 'pending',
  ip_address varchar(45),
  user_agent varchar(255),
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY form_id (form_id),
  KEY status (status),
  KEY created_at (created_at)
) {$charset_collate};";

        // Schemas table (versioned form schemas)
        $schemas_table = $wpdb->prefix . 'subtleforms_form_schemas';
        $schemas_sql = "CREATE TABLE {$schemas_table} (
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
        $logs_sql = "CREATE TABLE {$logs_table} (
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
        
        $results = [];
        $results['forms'] = dbDelta($forms_sql);
        $results['submissions'] = dbDelta($submissions_sql);
        $results['schemas'] = dbDelta($schemas_sql);
        $results['logs'] = dbDelta($logs_sql);

        // Verify tables were created
        $tables_to_check = [
            'forms' => $forms_table,
            'submissions' => $submissions_table,
            'schemas' => $schemas_table,
            'logs' => $logs_table,
        ];

        $missing_tables = [];
        foreach ($tables_to_check as $name => $table_name) {
            $table_exists = $wpdb->get_var("SHOW TABLES LIKE '{$table_name}'");
            if ($table_exists !== $table_name) {
                $missing_tables[] = $name;
            }
        }

        if (!empty($missing_tables)) {
            $error_message = sprintf(
                'SubtleForms failed to create the following database tables: %s. Please check your database permissions or contact your hosting provider.',
                implode(', ', $missing_tables)
            );
            
            // Log the error
            error_log('SubtleForms Activation Error: ' . $error_message);
            error_log('dbDelta results: ' . print_r($results, true));
            
            // Show admin notice instead of wp_die to allow debugging
            add_option('subtleforms_activation_error', $error_message);
            
            deactivate_plugins(SUBTLEFORMS_PLUGIN_BASENAME);
            wp_die(
                $error_message . '<br><br>Debug info has been logged to your error log.',
                'Database Creation Error',
                ['back_link' => true]
            );
        }

        // Store database version
        update_option('subtleforms_db_version', SUBTLEFORMS_VERSION);
    }

    /**
     * Set default plugin options.
     */
    private static function set_default_options(): void
    {
        $defaults = [
            'subtleforms_version' => SUBTLEFORMS_VERSION,
            'subtleforms_capabilities' => [],
            'subtleforms_extensions_enabled' => [],
        ];

        foreach ($defaults as $key => $value) {
            if (get_option($key) === false) {
                add_option($key, $value);
            }
        }
    }
}
