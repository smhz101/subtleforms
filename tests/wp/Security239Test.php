<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

use SubtleForms\Engine\SpamProtection;
use SubtleForms\Privacy\PrivacyEraser;
use SubtleForms\Privacy\PrivacyExporter;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Security\PublicRoutes;
use SubtleForms\Tools\TransferService;

/**
 * Package F239-3: security and data safety (2.3.9).
 */
class Security239Test extends TestCase {

	private function nameForm(): int {
		return $this->publish(
			array(
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name', 'required' => true ),
				array( 'id' => 'e', 'key' => 'email', 'type' => 'email', 'label' => 'Email' ),
			)
		);
	}

	private function entryCount( int $formId ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $formId ) );
	}

	private function rawSubmit( int $formId, array $data ): array {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId, 'data' => $data ) ) );
		$response = rest_do_request( $request );
		return array( 'status' => $response->get_status(), 'data' => $response->get_data() );
	}

	/** An HTML block never stores or serves a script, in content or in its settings. */
	public function test_html_block_markup_is_filtered() {
		$formId = $this->publish(
			array(
				array( 'id' => 'h', 'key' => 'h', 'type' => 'html', 'label' => 'H', 'content' => '<p>Hi</p><script>alert(1)</script>', 'config' => array( 'content' => '<b>ok</b><script>alert(2)</script>' ) ),
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
			)
		);
		wp_set_current_user( 0 );
		$response = rest_do_request( new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $formId . '/schema' ) );
		$json     = wp_json_encode( $response->get_data() );
		$this->assertSame( 200, $response->get_status() );
		$this->assertStringNotContainsString( '<script', $json );
		$this->assertStringNotContainsString( '<\/script', $json );
		$this->assertStringContainsString( '<b>ok<\/b>', $json );
	}

	/** FB-09, FF-13, FA-24, FLD2-17: rejected answers are never stored; the spam token never is. */
	public function test_rejected_submissions_are_not_stored() {
		$id  = $this->nameForm();
		$res = $this->submit( $id, array( 'email' => 'x@example.com', 'extra' => 'x' ) );
		$this->assertSame( 422, $res['status'] );
		$this->assertSame( 0, $this->entryCount( $id ), 'no failed entry is left behind' );

		$this->submit( $id, array( 'name' => 'Ada' ) );
		$this->assertSame( 1, $this->entryCount( $id ) );
		$this->assertArrayNotHasKey( 'form_rendered_at', $this->storedPayload( $id ) );
	}

	/** FF-12: a missing or forged time token is spam. FF-11: the server clock decides. */
	public function test_time_trap_uses_a_signed_server_token() {
		$id = $this->nameForm();

		$this->rawSubmit( $id, array( 'name' => 'Bot without token' ) );
		$this->rawSubmit( $id, array( 'name' => 'Bot with old style time', 'form_rendered_at' => (string) ( time() - 60 ) ) );
		$this->rawSubmit( $id, array( 'name' => 'Forged', 'form_rendered_at' => 'v1.' . ( time() - 60 ) . '.' . $id . '.' . str_repeat( 'a', 32 ) ) );
		$this->rawSubmit( $id, array( 'name' => 'Too fast', 'form_rendered_at' => SpamProtection::issue_token( $id ) ) );
		$this->rawSubmit( $id, array( 'name' => 'Other form', 'form_rendered_at' => SpamProtection::issue_token( $id + 1, time() - 60 ) ) );
		$this->assertSame( 0, $this->entryCount( $id ), 'spam is answered with thanks and not stored' );

		$res = $this->rawSubmit( $id, array( 'name' => 'Person', 'form_rendered_at' => SpamProtection::issue_token( $id, time() - 60 ) ) );
		$this->assertSame( 200, $res['status'] );
		$this->assertSame( 1, $this->entryCount( $id ) );
	}

	/** The public schema carries the token the live form sends back. */
	public function test_public_schema_has_a_spam_token() {
		$id      = $this->nameForm();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $id . '/schema' );
		$data    = rest_do_request( $request )->get_data();
		$token   = $data['data']['spam_token'] ?? '';
		$this->assertNotNull( SpamProtection::token_time( $token, $id ) );
	}

	/** FF-03: a stale nonce on a public route is treated as a visitor. */
	public function test_stale_nonce_on_public_routes_is_a_visitor() {
		$this->assertTrue( PublicRoutes::isPublicRoute( '/subtleforms/v1/submit' ) );
		$this->assertTrue( PublicRoutes::isPublicRoute( '/subtleforms/v1/forms/12/schema' ) );
		$this->assertTrue( PublicRoutes::isPublicRoute( '/subtleforms/v1/uploads' ) );
		$this->assertFalse( PublicRoutes::isPublicRoute( '/subtleforms/v1/settings' ) );
		$this->assertFalse( PublicRoutes::isPublicRoute( '/subtleforms/v1/forms/12' ) );

		global $wp;
		$wp->query_vars['rest_route'] = '/subtleforms/v1/submit';
		$error                        = new \WP_Error( 'rest_cookie_invalid_nonce', 'Cookie check failed', array( 'status' => 403 ) );
		$this->assertTrue( apply_filters( 'rest_authentication_errors', $error ) );
		$wp->query_vars['rest_route'] = '/subtleforms/v1/settings';
		$this->assertInstanceOf( \WP_Error::class, PublicRoutes::allowStaleNonce( $error ) );
		unset( $wp->query_vars['rest_route'] );
	}

	/** FA-19, FF2-21, FF-27: deleting a form deletes its entries, logs and schema versions. */
	public function test_deleting_a_form_deletes_its_data() {
		global $wpdb;
		$id = $this->nameForm();
		$this->submit( $id, array( 'name' => 'Ada' ) );
		$entry = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $id ) );
		( new LogsRepository() )->create( array( 'submission_id' => $entry, 'level' => 'info', 'message' => 'x', 'context' => array() ) );

		( new FormsRepository() )->delete( $id );

		$this->assertSame( 0, $this->entryCount( $id ) );
		$this->assertSame( '0', $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_form_schemas WHERE form_id = %d", $id ) ) );
		$this->assertSame( '0', $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_logs WHERE submission_id = %d", $entry ) ) );
	}

	/** FF-27: the retention purge takes the activity log with the entries. */
	public function test_retention_purge_removes_logs() {
		global $wpdb;
		$id = $this->nameForm();
		$this->submit( $id, array( 'name' => 'Old' ) );
		$entry = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $id ) );
		$wpdb->update( $wpdb->prefix . 'subtleforms_submissions', array( 'created_at' => '2000-01-01 00:00:00' ), array( 'id' => $entry ) );
		( new LogsRepository() )->create( array( 'submission_id' => $entry, 'level' => 'info', 'message' => 'x', 'context' => array() ) );

		( new SubmissionsRepository() )->delete_older_than( 3650 );

		$this->assertSame( 0, $this->entryCount( $id ) );
		$this->assertSame( '0', $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_logs WHERE submission_id = %d", $entry ) ) );
	}

	/** FF-20, FF-21: exact email matching, the form title in the export. */
	public function test_privacy_tools_match_the_exact_address() {
		$id = $this->nameForm();
		$this->submit( $id, array( 'name' => 'Ann', 'email' => 'ann239@example.com' ) );
		$this->submit( $id, array( 'name' => 'Joann', 'email' => 'joann239@example.com' ) );

		$exporter = new PrivacyExporter( new SubmissionsRepository(), new FormsRepository() );
		$export   = $exporter->export_user_data( 'ann239@example.com' );
		$this->assertCount( 1, $export['data'] );
		$this->assertSame( 'WP test', $export['data'][0]['data'][0]['value'] );

		$eraser = new PrivacyEraser( new SubmissionsRepository() );
		$result = $eraser->erase_user_data( 'ANN239@example.com' );
		$this->assertTrue( $result['items_removed'] );
		$this->assertSame( 1, $this->entryCount( $id ), "Joann's entry stays" );
		$this->assertSame( 'joann239@example.com', $this->storedPayload( $id )['email'] );
	}

	/** FF2-07: a never-published form exports its draft; a missing one is named. */
	public function test_form_export_is_never_silently_empty() {
		$repo  = new FormsRepository();
		$draft = $repo->create( array( 'title' => 'Draft only', 'status' => 'draft', 'config' => array() ) );
		$this->formIds[] = $draft;
		$repo->saveDraftSchema( $draft, array( 'schema_version' => 1, 'metadata' => array( 'title' => 'Draft only', 'name' => 'Draft only' ), 'fields' => array( array( 'id' => 'a', 'key' => 'a', 'type' => 'text', 'label' => 'A' ) ) ) );

		$service = new TransferService( new FormsRepository(), new SubmissionsRepository() );
		$package = $service->exportForms( array( $draft ) );
		$this->assertArrayNotHasKey( 'error', $package );
		$this->assertCount( 1, $package['forms'] );

		$missing = $service->exportForms( array( $draft, 99999999 ) );
		$this->assertStringContainsString( '#99999999', $missing['error'] ?? '' );
	}

	/** FF2-01: imports are cleaned like a builder save. */
	public function test_imports_are_cleaned() {
		$this->asAdmin();
		$service = new TransferService( new FormsRepository(), new SubmissionsRepository() );
		$result  = $service->importForms(
			array(
				'subtleforms' => 1,
				'kind'        => 'forms',
				'forms'       => array(
					array(
						'title'  => 'Imported',
						'status' => 'draft',
						'schema' => array(
							'metadata' => array( 'title' => 'Imported' ),
							'fields'   => array(
								array( 'id' => 'h', 'key' => 'h', 'type' => 'html', 'label' => 'H', 'content' => '<img src=x onerror="window.__x=1">hi' ),
								array( 'id' => 'n', 'key' => 'n', 'type' => 'text', 'label' => '<b onmouseover="x()">Name</b>' ),
							),
						),
					),
				),
			)
		);
		$this->assertCount( 1, $result['created'], $result['error'] );
		$formId          = (int) $result['created'][0]['id'];
		$this->formIds[] = $formId;
		$schema          = ( new FormsRepository() )->loadSchemaVersion( $formId );
		$json            = wp_json_encode( $schema );
		$this->assertStringNotContainsString( 'onerror', $json );
		$this->assertStringNotContainsString( 'onmouseover', $json );

		$clean = TransferService::cleanPayload(
			array( 'note' => '<img src=x onerror="a()">Hi', 'rich' => '<p onclick="b()"><strong>Bold</strong></p>' ),
			array( 'fields' => array( array( 'key' => 'rich', 'type' => 'rich_text' ) ) )
		);
		$this->assertSame( 'Hi', $clean['note'] );
		$this->assertStringNotContainsString( 'onclick', $clean['rich'] );
		$this->assertStringContainsString( '<strong>Bold</strong>', $clean['rich'] );
		wp_set_current_user( 0 );
	}

	/** FF-01, PRO2-01: a numeric HubSpot Portal ID does not block Settings. */
	public function test_numeric_portal_id_saves() {
		$this->asAdmin();
		foreach ( array( '12345678', 4455 ) as $value ) {
			$request = new \WP_REST_Request( 'PUT', '/subtleforms/v1/settings' );
			$request->set_header( 'content-type', 'application/json' );
			$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
			$request->set_body( wp_json_encode( array( 'ext_crm_portal_id' => $value ) ) );
			$response = rest_do_request( $request );
			$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		}
		wp_set_current_user( 0 );
	}

	/** FF-28: the live form's submit route has the strict limit. */
	public function test_submit_rate_limit_policy() {
		$policy = \SubtleForms\Security\RateLimiter::policy( '/subtleforms/v1/submit', 'POST' );
		$this->assertSame( 10, $policy['limit'] );
	}

	/** FF2-08: unknown routes and visitor traffic are not logged. */
	public function test_api_log_skips_noise() {
		$this->assertFalse( \SubtleForms\Tools\ApiLog::shouldLog( new \WP_Error( 'rest_no_route', 'x', array( 'status' => 404 ) ), 404, 1 ) );
		$this->assertFalse( \SubtleForms\Tools\ApiLog::shouldLog( null, 200, 0 ) );
		$this->assertTrue( \SubtleForms\Tools\ApiLog::shouldLog( null, 500, 0 ) );
		$this->assertTrue( \SubtleForms\Tools\ApiLog::shouldLog( null, 200, 1 ) );
	}

	/** FA-18, WP2-18: files go to a random private folder through WordPress APIs. */
	public function test_uploads_folder_is_private_and_uses_wordpress_apis() {
		$name = \SubtleForms\Uploads\Uploads::folderName();
		$this->assertMatchesRegularExpression( '/^subtleforms-uploads(-[a-z0-9]{16})?$/', $name );
		$source = (string) file_get_contents( dirname( __DIR__, 2 ) . '/src/Uploads/Uploads.php' );
		foreach ( array( 'move_uploaded_file(', 'readfile(', 'chmod(', 'rename(', 'file_put_contents(' ) as $raw ) {
			$this->assertStringNotContainsString( $raw, $source );
		}
		$this->assertStringContainsString( 'wp_handle_upload(', $source );
	}
}
