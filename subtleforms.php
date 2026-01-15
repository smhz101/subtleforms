<?php

/**
 * Plugin Name: SubtleForms
 * Description: Logic-first, workflow-driven form platform with extension architecture.
 * Version: 1.6.7
 * Author: Muzammil Hussain
 * Requires PHP: 7.4
 * Text Domain: subtleforms
 * Domain Path: /languages
 */

/**
 * Subtle Forms
 *
 * @package SubtleForms
 * @version 1.0.0
 * @author Muzammil Hussain
 * @license GPL-2.0+
 * @link https://muzammil.dev
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) {
	wp_die( esc_html__( 'Direct access not allowed.', 'subtleforms' ) );
}

// Define plugin constants.
define( 'SUBTLEFORMS_VERSION', '1.6.7' );
define( 'SUBTLEFORMS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SUBTLEFORMS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'SUBTLEFORMS_PLUGIN_FILE', __FILE__ );
define( 'SUBTLEFORMS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Load all classes
require_once SUBTLEFORMS_PLUGIN_DIR . 'src/load.php';

// Activation hook
register_activation_hook(
	__FILE__,
	function () {
		SubtleForms\Activator::activate();
	}
);

// Deactivation hook
register_deactivation_hook(
	__FILE__,
	function () {
		SubtleForms\Deactivator::deactivate();
	}
);

// Initialize plugin after WordPress loads
add_action(
	'plugins_loaded',
	function () {
		// Load text domain for translations
		load_plugin_textdomain( 'subtleforms', false, dirname( SUBTLEFORMS_PLUGIN_BASENAME ) . '/languages' );

		// Check for DB updates
		$installed_version = get_option( 'subtleforms_version' );
		if ( version_compare( $installed_version, SUBTLEFORMS_VERSION, '<' ) ) {
			SubtleForms\Activator::activate();
			update_option( 'subtleforms_version', SUBTLEFORMS_VERSION );
		}

		SubtleForms\init();
	}
);
