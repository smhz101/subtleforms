<?php
/**
 * Plugin Name: SubtleForms CRM mock
 * Description: Test only. Answers HubSpot from inside WordPress while the option sf_mock_crm_on is set. wp-env maps this file into mu-plugins (see .wp-env.json); tests/browser/fixtures/crm-mock.php copies it on a site that does not.
 */
// phpcs:disable -- Test fixture; not shipped in production plugin.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
add_filter(
	'pre_http_request',
	static function ( $pre, $args, $url ) {
		$url = (string) $url;
		if ( ! get_option( 'sf_mock_crm_on' ) || 0 !== strpos( $url, 'https://api.hubapi.com/' ) ) {
			return $pre;
		}
		$body  = isset( $args['body'] ) ? json_decode( (string) $args['body'], true ) : null;
		$log   = get_option( 'sf_mock_crm_requests', array() );
		$log   = is_array( $log ) ? $log : array();
		$log[] = array( 'method' => $args['method'], 'url' => $url, 'body' => $body );
		update_option( 'sf_mock_crm_requests', array_slice( $log, -80 ), false );

		$code  = 200;
		$reply = array();
		if ( false !== strpos( $url, '/account-info/v3/details' ) ) {
			$reply = array( 'portalId' => 123456, 'companyName' => 'Acme Portal' );
		} elseif ( false !== strpos( $url, '/crm/v3/properties/contacts' ) ) {
			$reply = array(
				'results' => array(
					array( 'name' => 'email', 'label' => 'Email' ),
					array( 'name' => 'jobtitle', 'label' => 'Job title' ),
					array( 'name' => 'city', 'label' => 'City' ),
				),
			);
		} elseif ( false !== strpos( $url, '/batch/upsert' ) ) {
			$code  = 200;
			$reply = array( 'results' => array( array( 'id' => '9001', 'new' => true ) ), 'errors' => array() );
		} elseif ( preg_match( '#/crm/v3/objects/contacts$#', $url ) ) {
			$code  = 201;
			$reply = array( 'id' => '9002' );
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
