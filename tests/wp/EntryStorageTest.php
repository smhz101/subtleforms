<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.2.1 bugs 4, 5, 6, 14 and 15: answers are stored as the visitor gave them,
 * passwords never are.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Support\EntryValues;

final class EntryStorageTest extends TestCase {

	private function answerForm( array $passwordExtra = array() ): int {
		return $this->publish(
			array(
				array( 'id' => 'a1', 'key' => 'notes', 'type' => 'textarea', 'label' => 'Notes' ),
				array( 'id' => 'a2', 'key' => 'bio', 'type' => 'rich_text', 'label' => 'Bio' ),
				array_merge( array( 'id' => 'a3', 'key' => 'secret', 'type' => 'password', 'label' => 'Password', 'minLength' => 0 ), $passwordExtra ),
				array( 'id' => 'a4', 'key' => 'tog', 'type' => 'toggle', 'label' => 'Toggle' ),
				array( 'id' => 'a5', 'key' => 'sca', 'type' => 'scale', 'label' => 'Scale' ),
				array( 'id' => 'a6', 'key' => 'pic', 'type' => 'picture_choice', 'label' => 'Pic', 'options' => array( array( 'label' => 'A', 'value' => 'a' ) ) ),
				array( 'id' => 'a7', 'key' => 'sig', 'type' => 'signature', 'label' => 'Sig' ),
				array( 'id' => 'a8', 'key' => 'calc', 'type' => 'calculation', 'label' => 'Calc', 'formula' => '{sca} * 2', 'decimals' => 0 ),
			)
		);
	}

	public function test_paragraph_keeps_line_breaks() {
		$id  = $this->answerForm();
		$res = $this->submit( $id, array( 'notes' => "Multi\nline\r\nthird" ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( "Multi\nline\nthird", $this->storedPayload( $id )['notes'] );
	}

	public function test_rich_text_keeps_the_allowed_tags_only() {
		$id = $this->answerForm();
		$this->submit(
			$id,
			array( 'bio' => '<b>Bold</b> rich <em>em</em> <u>u</u> <script>alert(1)</script><a href="javascript:alert(1)">bad</a> <a href="https://example.com" onclick="x()">ok</a><ul><li>one</li></ul>' )
		);
		$bio = $this->storedPayload( $id )['bio'];
		$this->assertStringContainsString( '<b>Bold</b> rich', $bio );
		$this->assertStringContainsString( '<em>em</em>', $bio );
		$this->assertStringContainsString( '<ul><li>one</li></ul>', $bio );
		$this->assertStringContainsString( '<a href="https://example.com">ok</a>', $bio );
		$this->assertStringNotContainsString( '<u>', $bio );
		$this->assertStringNotContainsString( '<script', $bio );
		$this->assertStringNotContainsString( 'javascript:', $bio );
		$this->assertStringNotContainsString( 'onclick', $bio );
	}

	public function test_password_is_not_stored_by_default() {
		$id = $this->answerForm();
		$this->submit( $id, array( 'secret' => 's3cret<>!' ) );
		$this->assertTrue( $this->storedPayload( $id )['secret'] );
		$this->assertStringNotContainsString( 's3cret', $this->storedRow( $id ) );
	}

	public function test_password_can_be_stored_as_a_hash() {
		$id = $this->answerForm( array( 'storeHash' => true ) );
		$this->submit( $id, array( 'secret' => 's3cret<>!' ) );
		$stored = $this->storedPayload( $id )['secret'];
		$this->assertIsString( $stored );
		$this->assertNotSame( 's3cret<>!', $stored );
		$this->assertTrue( wp_check_password( 's3cret<>!', $stored ), 'hash matches what was typed, symbols included' );
		$this->assertStringNotContainsString( 's3cret', $this->storedRow( $id ) );
	}

	public function test_password_is_not_stored_when_the_entry_fails_validation() {
		$id = $this->publish(
			array(
				array( 'id' => 'r1', 'key' => 'name', 'type' => 'text', 'label' => 'Name', 'required' => true ),
				array( 'id' => 'r2', 'key' => 'secret', 'type' => 'password', 'label' => 'Password', 'minLength' => 0 ),
			)
		);
		$res = $this->submit( $id, array( 'secret' => 'hunter2' ) );
		$this->assertSame( 422, $res['status'] );
		$this->assertSame( 'Name is required.', $res['data']['error']['meta']['fields']['name'] ?? null );
		$this->assertStringNotContainsString( 'hunter2', $this->storedRow( $id ) );
	}

	public function test_toggle_scale_picture_signature_and_calculation_are_stored() {
		$id = $this->answerForm();
		$this->submit(
			$id,
			array(
				'tog' => 'yes',
				'sca' => 4,
				'pic' => 'a',
				'sig' => 'data:image/png;base64,iVBORw0KGgo=',
				'calc' => 999,
			)
		);
		$p = $this->storedPayload( $id );
		$this->assertSame( 'yes', $p['tog'] );
		$this->assertSame( '4', (string) $p['sca'] );
		$this->assertSame( 'a', $p['pic'] );
		$this->assertStringStartsWith( 'data:image/png;base64,', $p['sig'] );
		$this->assertSame( '8', (string) $p['calc'], 'calculations are recomputed on the server' );
	}

	public function test_entry_api_shows_password_provided_never_the_value() {
		$id = $this->answerForm( array( 'storeHash' => true ) );
		$this->submit( $id, array( 'secret' => 'topsecret' ) );
		global $wpdb;
		$entryId = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1", $id ) );

		$this->asAdmin();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/submissions/' . $entryId );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$data = rest_do_request( $request )->get_data();
		$this->assertSame( 'Password provided (stored as a hash)', $data['data']['payload']['secret'] ?? null, wp_json_encode( $data ) );

		$list = new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $id . '/submissions' );
		$list->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$this->assertStringNotContainsString( '$', wp_json_encode( rest_do_request( $list )->get_data()['data'][0]['payload']['secret'] ?? '' ) );
	}

	public function test_csv_export_leaves_passwords_out() {
		$id = $this->answerForm();
		$this->submit( $id, array( 'notes' => "Line one\nLine two", 'secret' => 'topsecret' ) );
		$this->asAdmin();

		// Export is a Pro capability; the test turns it on for its own gate.
		$caps = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		$api  = new \SubtleForms\Api\SubmissionsApi( new \SubtleForms\Repositories\FormsRepository(), new \SubtleForms\Repositories\SubmissionsRepository(), new \SubtleForms\Support\FeatureGate( $caps ) );

		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submissions/export' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $id ) ) );
		$data = $api->export_submissions_csv( $request )->get_data();
		$csv  = base64_decode( $data['data']['csv'] );
		$this->assertStringContainsString( "Line one\nLine two", $csv );
		$this->assertStringNotContainsString( 'Password', $csv );
		$this->assertStringNotContainsString( 'topsecret', $csv );
		$this->assertStringNotContainsString( 'secret', $csv );
	}

	public function test_text_and_html_formatting_helpers() {
		$field = array( 'type' => 'textarea' );
		$this->assertSame( "a\nb", EntryValues::toText( "a\nb", $field ) );
		$this->assertSame( "a&lt;b<br />\nc", EntryValues::toHtml( "a<b\nc", $field ) );
		$this->assertSame( 'Bold rich', EntryValues::toText( '<b>Bold</b> rich', array( 'type' => 'rich_text' ) ) );
	}
}
