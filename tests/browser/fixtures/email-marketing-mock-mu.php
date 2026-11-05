<?php
/**
 * Plugin Name: SubtleForms email marketing mock
 * Description: Test only. Answers Mailchimp, Brevo and Kit from inside WordPress while the option sf_mock_em_on is set. wp-env maps this file into mu-plugins (see .wp-env.json); tests/browser/fixtures/email-marketing-mock.php copies it on a site that does not.
 */
// phpcs:disable -- Test fixture; not shipped in production plugin.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
add_filter(
	'pre_http_request',
	static function ( $pre, $args, $url ) {
		$url = (string) $url;
		if ( ! get_option( 'sf_mock_em_on' ) || ! preg_match( '#^https://([a-z0-9]+\.api\.mailchimp\.com|api\.brevo\.com|api\.kit\.com)/#', $url ) ) {
			return $pre;
		}
		$body  = isset( $args['body'] ) ? json_decode( (string) $args['body'], true ) : null;
		$log   = get_option( 'sf_mock_em_requests', array() );
		$log   = is_array( $log ) ? $log : array();
		$log[] = array( 'method' => $args['method'], 'url' => $url, 'body' => $body );
		update_option( 'sf_mock_em_requests', array_slice( $log, -80 ), false );

		$code  = 200;
		$reply = array();
		if ( false !== strpos( $url, 'api.brevo.com' ) ) {
			if ( false !== strpos( $url, '/v3/account' ) ) {
				$reply = array( 'companyName' => 'Acme Studio', 'email' => 'owner@example.com' );
			} elseif ( false !== strpos( $url, '/contacts/lists' ) ) {
				$reply = array( 'lists' => array( array( 'id' => 7, 'name' => 'Newsletter', 'uniqueSubscribers' => 42 ), array( 'id' => 8, 'name' => 'Customers', 'uniqueSubscribers' => 7 ) ) );
			} elseif ( false !== strpos( $url, '/contacts/attributes' ) ) {
				$reply = array( 'attributes' => array(
					array( 'name' => 'FIRSTNAME', 'category' => 'normal', 'type' => 'text' ),
					array( 'name' => 'COMPANY', 'category' => 'normal', 'type' => 'text' ),
					array( 'name' => 'PHONE', 'category' => 'normal', 'type' => 'text' ),
				) );
			} elseif ( false !== strpos( $url, '/smtp/templates' ) ) {
				$reply = array( 'templates' => array( array( 'id' => 12, 'name' => 'Confirm your subscription' ) ) );
			} elseif ( 'GET' === $args['method'] ) {
				$code = 404;
			} else {
				$code  = 201;
				$reply = array( 'id' => 321 );
			}
		} elseif ( false !== strpos( $url, 'api.kit.com' ) ) {
			if ( false !== strpos( $url, '/v4/account' ) ) {
				$reply = array( 'account' => array( 'name' => 'Acme Studio' ), 'user' => array( 'email' => 'owner@example.com' ) );
			} elseif ( false !== strpos( $url, '/v4/forms' ) ) {
				$reply = array( 'forms' => array( array( 'id' => 99, 'name' => 'Landing page' ), array( 'id' => 100, 'name' => 'Footer' ) ) );
			} elseif ( false !== strpos( $url, '/custom_fields' ) ) {
				$reply = array( 'custom_fields' => array( array( 'key' => 'company', 'label' => 'Company' ), array( 'key' => 'phone_number', 'label' => 'Phone number' ) ) );
			} elseif ( preg_match( '#/v4/tags$#', $url ) ) {
				$code  = 201;
				$reply = array( 'tag' => array( 'id' => 55, 'name' => (string) ( $body['name'] ?? '' ) ) );
			} elseif ( preg_match( '#/v4/subscribers$#', $url ) ) {
				$code  = 201;
				$reply = array( 'subscriber' => array( 'id' => 777 ) );
			}
		} elseif ( preg_match( '#/3\.0/\?fields#', $url ) ) {
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
