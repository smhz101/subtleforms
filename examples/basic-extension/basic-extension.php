<?php
/**
 * Plugin Name: SubtleForms Basic Extension
 * Plugin URI: https://subtleforms.com/extensions/basic
 * Description: Example extension demonstrating hook usage
 * Version: 1.0.0
 * Author: SubtleForms Team
 * Author URI: https://subtleforms.com
 * License: GPL v2 or later
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: subtleforms
 * Text Domain: subtleforms-basic-extension
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Load extension assets
 */
function subtleforms_basic_extension_load() {
    // Check if SubtleForms is active
    if (!function_exists('subtleforms')) {
        add_action('admin_notices', function() {
            echo '<div class="error"><p>';
            echo esc_html__('SubtleForms Basic Extension requires SubtleForms to be installed and activated.', 'subtleforms-basic-extension');
            echo '</p></div>';
        });
        return;
    }

    // Enqueue extension script
    add_action('admin_enqueue_scripts', function($hook) {
        // Only load on SubtleForms pages
        if (strpos($hook, 'subtleforms') === false) {
            return;
        }

        wp_enqueue_script(
            'subtleforms-basic-extension',
            plugin_dir_url(__FILE__) . 'index.js',
            ['subtleforms-admin'], // Dependency on SubtleForms
            '1.0.0',
            true
        );
    });
}
add_action('plugins_loaded', 'subtleforms_basic_extension_load');
