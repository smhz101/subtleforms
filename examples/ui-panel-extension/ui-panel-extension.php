<?php
/**
 * Plugin Name: SubtleForms UI Panel Extension
 * Plugin URI: https://subtleforms.com/extensions/ui-panel
 * Description: Example extension demonstrating UI components and capability checks
 * Version: 1.0.0
 * Author: SubtleForms Team
 * Author URI: https://subtleforms.com
 * License: GPL v2 or later
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: subtleforms
 * Text Domain: subtleforms-ui-panel-extension
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Load extension assets
 */
function subtleforms_ui_panel_extension_load() {
    // Check if SubtleForms is active
    if (!function_exists('subtleforms')) {
        add_action('admin_notices', function() {
            echo '<div class="error"><p>';
            echo esc_html__('SubtleForms UI Panel Extension requires SubtleForms to be installed and activated.', 'subtleforms-ui-panel-extension');
            echo '</p></div>';
        });
        return;
    }

    // Enqueue extension script and styles
    add_action('admin_enqueue_scripts', function($hook) {
        // Only load on SubtleForms pages
        if (strpos($hook, 'subtleforms') === false) {
            return;
        }

        // Enqueue JavaScript
        wp_enqueue_script(
            'subtleforms-ui-panel-extension',
            plugin_dir_url(__FILE__) . 'index.js',
            ['subtleforms-admin', 'react', 'react-dom'],
            '1.0.0',
            true
        );

        // Enqueue CSS
        wp_enqueue_style(
            'subtleforms-ui-panel-extension',
            plugin_dir_url(__FILE__) . 'style.css',
            ['subtleforms-admin'],
            '1.0.0'
        );
    });
}
add_action('plugins_loaded', 'subtleforms_ui_panel_extension_load');
