<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

/**
 * 2.4.1: a saved settings value can be cleared through the settings route.
 */
class SettingsClear241Test extends TestCase {

	private function put( array $body ): \WP_REST_Response {
		$request = new \WP_REST_Request( 'PUT', '/subtleforms/v1/settings' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_body( wp_json_encode( $body ) );
		return rest_do_request( $request );
	}

	public function test_a_saved_value_can_be_cleared() {
		$this->asAdmin();
		$this->assertSame( 200, $this->put( array( 'ext_crm_api_key' => 'pat-' . 'fixture', 'sender_name' => 'Shop' ) )->get_status() );
		$this->assertSame( 'pat-fixture', get_option( 'subtleforms_settings' )['ext_crm_api_key'] );

		$response = $this->put( array( 'ext_crm_api_key' => '' ) );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		$saved = get_option( 'subtleforms_settings' );
		$this->assertSame( '', $saved['ext_crm_api_key'] );
		$this->assertSame( 'Shop', $saved['sender_name'], 'Settings that were not sent are kept.' );
		wp_set_current_user( 0 );
	}
}
