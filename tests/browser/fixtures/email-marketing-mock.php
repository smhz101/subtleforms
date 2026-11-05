<?php
// phpcs:disable -- Test fixture; not shipped in production plugin.
/**
 * Switches on pretend Mailchimp, Brevo and Kit for the browser test. They are
 * the must-use plugin email-marketing-mock-mu.php (wp-env maps it into
 * wp-content/mu-plugins; on another site this script copies it there):
 *
 *   wp eval-file tests/browser/fixtures/email-marketing-mock.php install
 *   wp eval-file tests/browser/fixtures/email-marketing-mock.php requests
 *   wp eval-file tests/browser/fixtures/email-marketing-mock.php remove
 *
 * It answers every request to the three services from a script in the site
 * (pre_http_request), so nothing leaves the machine, and keeps the requests it
 * saw in an option so the test can read them back.
 *
 * @package SubtleForms\Tests
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$subtleforms_mock_action = isset( $args[0] ) ? (string) $args[0] : 'install';
$subtleforms_mock_dir    = defined( 'WPMU_PLUGIN_DIR' ) ? WPMU_PLUGIN_DIR : WP_CONTENT_DIR . '/mu-plugins';
$subtleforms_mock_file   = $subtleforms_mock_dir . '/subtleforms-email-marketing-mock.php';

if ( 'remove' === $subtleforms_mock_action ) {
	// A file this script copied goes again; one wp-env mapped stays and goes quiet.
	if ( get_option( 'sf_mock_em_copied' ) && file_exists( $subtleforms_mock_file ) ) {
		unlink( $subtleforms_mock_file );
	}
	delete_option( 'sf_mock_em_copied' );
	delete_option( 'sf_mock_em_on' );
	delete_option( 'sf_mock_em_requests' );
	foreach ( array( 'mailchimp', 'brevo', 'kit' ) as $slug ) {
		delete_option( 'subtleforms_' . $slug . '_connection' );
	}
	echo wp_json_encode( array( 'removed' => true ) );
	return;
}

if ( 'requests' === $subtleforms_mock_action ) {
	wp_cache_delete( 'sf_mock_em_requests', 'options' );
	echo wp_json_encode( array( 'requests' => get_option( 'sf_mock_em_requests', array() ) ) );
	return;
}

if ( ! is_dir( $subtleforms_mock_dir ) ) {
	mkdir( $subtleforms_mock_dir, 0777, true );
}

$subtleforms_mock_source = __DIR__ . '/email-marketing-mock-mu.php';
if ( ! file_exists( $subtleforms_mock_file ) ) {
	if ( ! is_dir( $subtleforms_mock_dir ) ) {
		mkdir( $subtleforms_mock_dir, 0777, true );
	}
	copy( $subtleforms_mock_source, $subtleforms_mock_file );
	update_option( 'sf_mock_em_copied', 1, false );
}
update_option( 'sf_mock_em_on', 1, false );
delete_option( 'sf_mock_em_requests' );
foreach ( array( 'mailchimp', 'brevo', 'kit' ) as $slug ) {
	delete_option( 'subtleforms_' . $slug . '_connection' );
}
foreach ( get_users( array( 'fields' => 'ID' ) ) as $uid ) {
	delete_user_meta( $uid, 'subtleforms_email_marketing_banner_dismissed' );
}
echo wp_json_encode( array( 'installed' => file_exists( $subtleforms_mock_file ) ) );
