<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Field IDs (2.4.1): a form saved with a custom ID publishes and takes
 * entries under it, and the builder learns how many entries a form has.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class FieldKeys241Test extends TestCase {

	public function test_a_custom_id_with_a_hyphen_takes_answers(): void {
		$form = $this->publish( array( array( 'type' => 'text', 'key' => 'crm-id', 'label' => 'CRM ID' ) ) );
		$this->assertSame( 200, $this->submit( $form, array( 'crm-id' => 'A-7' ) )['status'] );
		$this->assertSame( 'A-7', $this->storedPayload( $form )['crm-id'] );
	}

	public function test_the_form_tells_the_builder_how_many_entries_it_has(): void {
		$form = $this->publish( array( array( 'type' => 'text', 'key' => 'name', 'label' => 'Name' ) ) );
		$this->submit( $form, array( 'name' => 'Ann' ) );
		$this->submit( $form, array( 'name' => 'Bob' ) );
		$this->asAdmin();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $form );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$data = rest_do_request( $request )->get_data();
		$this->assertSame( 2, $data['data']['submission_count'] );
	}
}
