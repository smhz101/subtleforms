<?php
/**
 * Plugin Name: SubtleForms Mailchimp mock
 * Description: Test only. Answers api.mailchimp.com from inside WordPress while the option sf_mock_mailchimp_on is set. wp-env maps this file into mu-plugins (see .wp-env.json); tests/browser/fixtures/mailchimp-mock.php copies it on a site that does not.
 */
// phpcs:disable -- Test fixture; not shipped in production plugin.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
add_filter(
	'pre_http_request',
	static function ( $pre, $args, $url ) {
		if ( false === strpos( (string) $url, '.api.mailchimp.com/' ) || ! get_option( 'sf_mock_mailchimp_on' ) ) {
			return $pre;
		}
		$body = isset( $args['body'] ) ? json_decode( (string) $args['body'], true ) : null;
		$log  = get_option( 'sf_mock_mailchimp_requests', array() );
		$log  = is_array( $log ) ? $log : array();
		$log[] = array( 'method' => $args['method'], 'url' => $url, 'body' => $body );
		update_option( 'sf_mock_mailchimp_requests', array_slice( $log, -50 ), false );

		$code  = 200;
		$reply = array();
		if ( preg_match( '#/3\.0/\?fields#', $url ) ) {
			$reply = array( 'account_name' => 'Acme Studio', 'email' => 'owner@example.com' );
		} elseif ( false !== strpos( $url, '/merge-fields' ) ) {
			$reply = array(
				'merge_fields' => array(
					array( 'tag' => 'EMAIL', 'name' => 'Email Address', 'type' => 'email', 'required' => true ),
					array( 'tag' => 'FNAME', 'name' => 'First Name', 'type' => 'text', 'required' => false ),
					array( 'tag' => 'LNAME', 'name' => 'Last Name', 'type' => 'text', 'required' => false ),
					array( 'tag' => 'COMPANY', 'name' => 'Company', 'type' => 'text', 'required' => false ),
					array( 'tag' => 'PHONE', 'name' => 'Phone', 'type' => 'phone', 'required' => false ),
				),
			);
		} elseif ( preg_match( '#/3\.0/lists\?#', $url ) ) {
			$reply = array(
				'lists' => array(
					array( 'id' => 'abc123', 'name' => 'Newsletter', 'stats' => array( 'member_count' => 42 ) ),
					array( 'id' => 'def456', 'name' => 'Customers', 'stats' => array( 'member_count' => 7 ) ),
				),
			);
		} elseif ( 'PUT' === $args['method'] ) {
			$reply = array(
				'id'     => md5( strtolower( (string) ( $body['email_address'] ?? '' ) ) ),
				'status' => 'pending' === ( $body['status_if_new'] ?? '' ) ? 'pending' : 'subscribed',
			);
		}
		return array(
			'headers'  => array(),
			'body'     => wp_json_encode( $reply ),
			'response' => array( 'code' => $code, 'message' => 'OK' ),
			'cookies'  => array(),
			'filename' => null,
		);
	},
	10,
	3
);
