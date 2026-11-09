<?php
// phpcs:disable -- Test fixture; not shipped in production plugin.
/**
 * Switches on a pretend HubSpot for the browser test. It is the must-use
 * plugin crm-mock-mu.php (wp-env maps it into wp-content/mu-plugins; on
 * another site this script copies it there):
 *
 *   wp eval-file tests/browser/fixtures/crm-mock.php install
 *   wp eval-file tests/browser/fixtures/crm-mock.php requests
 *   wp eval-file tests/browser/fixtures/crm-mock.php remove
 *
 * @package SubtleForms\Tests
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$subtleforms_mock_action = isset( $args[0] ) ? (string) $args[0] : 'install';
$subtleforms_mock_dir    = defined( 'WPMU_PLUGIN_DIR' ) ? WPMU_PLUGIN_DIR : WP_CONTENT_DIR . '/mu-plugins';
$subtleforms_mock_file   = $subtleforms_mock_dir . '/subtleforms-crm-mock.php';

if ( 'remove' === $subtleforms_mock_action ) {
	if ( get_option( 'sf_mock_crm_copied' ) && file_exists( $subtleforms_mock_file ) ) {
		unlink( $subtleforms_mock_file );
	}
	delete_option( 'sf_mock_crm_copied' );
	delete_option( 'sf_mock_crm_on' );
	delete_option( 'sf_mock_crm_requests' );
	delete_option( 'subtleforms_hubspot_connection' );
	echo wp_json_encode( array( 'removed' => true ) );
	return;
}

if ( 'requests' === $subtleforms_mock_action ) {
	wp_cache_delete( 'sf_mock_crm_requests', 'options' );
	echo wp_json_encode( array( 'requests' => get_option( 'sf_mock_crm_requests', array() ) ) );
	return;
}

if ( ! is_dir( $subtleforms_mock_dir ) ) {
	mkdir( $subtleforms_mock_dir, 0777, true );
}
if ( ! file_exists( $subtleforms_mock_file ) ) {
	copy( __DIR__ . '/crm-mock-mu.php', $subtleforms_mock_file );
	update_option( 'sf_mock_crm_copied', 1, false );
}
update_option( 'sf_mock_crm_on', 1, false );
delete_option( 'sf_mock_crm_requests' );
delete_option( 'subtleforms_hubspot_connection' );
foreach ( get_users( array( 'fields' => 'ID' ) ) as $uid ) {
	delete_user_meta( $uid, 'subtleforms_crm_banner_dismissed' );
}
echo wp_json_encode( array( 'installed' => file_exists( $subtleforms_mock_file ) ) );
