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
		$this->assertSame( 200, $this->put( array( 'ext_webhooks_signing_secret' => 'pat-' . 'fixture', 'sender_name' => 'Shop' ) )->get_status() );
		$this->assertSame( 'pat-fixture', get_option( 'subtleforms_settings' )['ext_webhooks_signing_secret'] );

		$response = $this->put( array( 'ext_webhooks_signing_secret' => '' ) );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		$saved = get_option( 'subtleforms_settings' );
		$this->assertSame( '', $saved['ext_webhooks_signing_secret'] );
		$this->assertSame( 'Shop', $saved['sender_name'], 'Settings that were not sent are kept.' );
		wp_set_current_user( 0 );
	}

	/** 2.8.0: Keep my data when the plugin is deleted can be saved, and is off until then. */
	public function test_keep_data_on_uninstall_saves_over_rest() {
		$this->asAdmin();
		delete_option( 'subtleforms_settings' );
		$this->assertFalse( ( new \SubtleForms\Support\Settings() )->get( 'keep_data_on_uninstall' ) );
		$response = $this->put( array( 'keep_data_on_uninstall' => true ) );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		$this->assertTrue( get_option( 'subtleforms_settings' )['keep_data_on_uninstall'] );
		$this->assertTrue( \SubtleForms\Support\Uninstaller::keeps_data() );
		wp_set_current_user( 0 );
	}

	/** 2.8.0: an add-on's ext_ values come back with the settings and must not block a save. */
	public function test_add_on_ext_values_do_not_block_a_save_and_are_kept() {
		$this->asAdmin();
		update_option( 'subtleforms_settings', array( 'ext_crm_api_key' => 'kept-by-the-add-on' ) );
		$response = $this->put( array( 'ext_crm_api_key' => 'changed', 'sender_name' => 'Shop' ) );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		$saved = get_option( 'subtleforms_settings' );
		$this->assertSame( 'kept-by-the-add-on', $saved['ext_crm_api_key'] );
		$this->assertSame( 'Shop', $saved['sender_name'] );
		wp_set_current_user( 0 );
	}
}
