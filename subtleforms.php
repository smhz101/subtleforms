<?php

/**
 * Plugin Name: SubtleForms
 * Description: Logic-first, workflow-driven form platform with extension architecture.
 * Version: 1.6.13
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
define( 'SUBTLEFORMS_VERSION', '1.6.13' );
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

// Add REST API nonce verification for authenticated endpoints
add_filter(
	'rest_authentication_errors',
	function ( $result ) {
		// Skip if already authenticated or error exists
		if ( ! empty( $result ) ) {
			return $result;
		}

		// Skip for non-logged-in users (public endpoints)
		if ( ! is_user_logged_in() ) {
			return $result;
		}

		// Get current endpoint
		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';

		// Only check SubtleForms endpoints
		if ( strpos( $request_uri, '/wp-json/subtleforms/v1' ) === false ) {
			return $result;
		}

		// Allow GET requests (read-only, less risk)
		if ( isset( $_SERVER['REQUEST_METHOD'] ) && $_SERVER['REQUEST_METHOD'] === 'GET' ) {
			return $result;
		}

		// Verify nonce from header or cookie
		$nonce = '';

		// Check X-WP-Nonce header (used by wp-api-fetch)
		if ( isset( $_SERVER['HTTP_X_WP_NONCE'] ) ) {
			$nonce = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_WP_NONCE'] ) );
		} elseif ( isset( $_COOKIE['wp_rest'] ) ) {
			// Fallback to REST cookie
			$nonce = sanitize_text_field( wp_unslash( $_COOKIE['wp_rest'] ) );
		}

		// Verify nonce
		if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error(
				'rest_cookie_invalid_nonce',
				__( 'Cookie nonce is invalid. Please refresh and try again.', 'subtleforms' ),
				array( 'status' => 403 )
			);
		}

		return $result;
	},
	99
);

// Register privacy policy content
add_action(
	'admin_init',
	function () {
		if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
			$content = sprintf(
				'<h2>%s</h2><p>%s</p><ul><li>%s</li><li>%s</li><li>%s</li></ul><p>%s</p>',
				esc_html__( 'SubtleForms Data Collection', 'subtleforms' ),
				esc_html__( 'When you submit a form on this website, SubtleForms collects and stores the following information:', 'subtleforms' ),
				esc_html__( 'Form field data (as entered by you)', 'subtleforms' ),
				esc_html__( 'Your IP address (for spam prevention)', 'subtleforms' ),
				esc_html__( 'Your browser user agent (for spam prevention)', 'subtleforms' ),
				esc_html__( 'This data is stored according to the configured data retention policy. Contact the site administrator for more information about data retention and deletion.', 'subtleforms' )
			);

			wp_add_privacy_policy_content( 'SubtleForms', $content );
		}
	}
);
