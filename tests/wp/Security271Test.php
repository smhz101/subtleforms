<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * Free security fixes (2.7.1): contributor schema access, per-user limit,
 * single-use time token, privacy lookup, shortcode message, queued jobs.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Engine\SpamProtection;
use SubtleForms\Privacy\PrivacyLookup;

final class Security271Test extends TestCase {

	private $settingsBefore;

	protected function setUp(): void {
		parent::setUp();
		$this->settingsBefore = get_option( 'subtleforms_settings', null );
		// The test site predates the 2.7.1 column; run the schema step.
		\SubtleForms\Activator::activate();
		PrivacyLookup::resetColumnCheck();
	}

	protected function tearDown(): void {
		null === $this->settingsBefore ? delete_option( 'subtleforms_settings' ) : update_option( 'subtleforms_settings', $this->settingsBefore );
		parent::tearDown();
	}

	private function render( int $formId ): string {
		return \SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Frontend\Shortcode::class )->render( array( 'id' => $formId ) );
	}

	private function makeUser( string $role ): int {
		$name = 'sf271_' . $role . '_' . wp_generate_password( 6, false );
		return (int) wp_insert_user( array( 'user_login' => $name, 'user_pass' => wp_generate_password(), 'user_email' => $name . '@example.com', 'role' => $role ) );
	}

	private function nameForm(): int {
		return $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
	}

	private function entries( int $formId ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $formId ) );
	}

	public function test_a_contributor_gets_the_public_schema_only(): void {
		$id = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$contributor = $this->makeUser( 'contributor' );
		wp_set_current_user( $contributor );
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $id . '/schema' );
		$request->set_param( 'context', 'builder' );
		$data = rest_do_request( $request )->get_data()['data'] ?? array();
		$this->assertArrayHasKey( 'spam_token', $data, 'the public payload, not the admin one' );
		$this->assertArrayNotHasKey( 'draft', $data );
		$this->assertArrayNotHasKey( 'config', $data['form'] ?? array() );
	}

	public function test_the_submissions_table_has_user_id_and_the_per_user_limit_works(): void {
		global $wpdb;
		PrivacyLookup::resetColumnCheck();
		$this->assertTrue( PrivacyLookup::hasUserIdColumn() );
		$cols = $wpdb->get_col( "SHOW INDEX FROM {$wpdb->prefix}subtleforms_submissions", 2 );
		$this->assertContains( 'form_user', $cols );

		update_option( 'subtleforms_settings', array_merge( (array) get_option( 'subtleforms_settings', array() ), array( 'submission_limit_enabled' => true, 'submission_limit' => 1 ) ) );
		$id   = $this->nameForm();
		$user = $this->makeUser( 'subscriber' );
		$send = function () use ( $id, $user ) {
			wp_set_current_user( $user );
			$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( wp_json_encode( array( 'form_id' => $id, 'data' => array( 'name' => 'A', 'form_rendered_at' => SpamProtection::issue_token( $id, time() - 100 - mt_rand( 1, 5000 ) ) ) ) ) );
			return rest_do_request( $request )->get_status();
		};
		$this->assertSame( 200, $send() );
		$this->assertSame( 1, (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d AND user_id = %d", $id, $user ) ) );
		$this->assertSame( 403, $send(), 'the second entry from the same account is refused' );
		$this->assertSame( 1, $this->entries( $id ) );
	}

	public function test_a_time_token_is_single_use_and_a_correction_can_resend(): void {
		$id    = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name', 'required' => true ) ) );
		$token = SpamProtection::issue_token( $id, time() - 60 );

		$bad = $this->rawSubmit( $id, array( 'form_rendered_at' => $token ) );
		$this->assertContains( $bad['status'], array( 400, 422 ) );
		$this->assertSame( 0, $this->entries( $id ) );

		$this->rawSubmit( $id, array( 'name' => 'Ada', 'form_rendered_at' => $token ) );
		$this->assertSame( 1, $this->entries( $id ), 'the same token works after a rejected try' );
		$this->rawSubmit( $id, array( 'name' => 'Replay', 'form_rendered_at' => $token ) );
		$this->assertSame( 1, $this->entries( $id ), 'a replay is dropped' );
	}

	private function rawSubmit( int $formId, array $data ): array {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId, 'data' => $data ) ) );
		$response = rest_do_request( $request );
		return array( 'status' => $response->get_status(), 'data' => $response->get_data() );
	}

	public function test_the_privacy_lookup_reuses_its_scan_for_later_pages(): void {
		global $wpdb;
		$id = $this->nameForm();
		$wpdb->insert( $wpdb->prefix . 'subtleforms_submissions', array( 'form_id' => $id, 'payload' => wp_json_encode( array( 'email' => 'jose271@example.com' ) ), 'status' => 'completed', 'created_at' => current_time( 'mysql', true ) ) );
		$entry = (int) $wpdb->insert_id;
		$this->assertContains( $entry, PrivacyLookup::submissionIds( 'jose271@example.com' ) );
		$wpdb->delete( $wpdb->prefix . 'subtleforms_submissions', array( 'id' => $entry ) );
		$this->assertContains( $entry, PrivacyLookup::submissionIds( 'jose271@example.com', true ), 'a later page reuses the scan' );
		PrivacyLookup::forget( 'jose271@example.com' );
		$this->assertNotContains( $entry, PrivacyLookup::submissionIds( 'jose271@example.com' ), 'a new request rescans' );
	}

	public function test_a_visitor_gets_one_message_for_a_missing_or_draft_form(): void {
		$id = $this->nameForm();
		global $wpdb;
		$wpdb->update( $wpdb->prefix . 'subtleforms_forms', array( 'status' => 'draft' ), array( 'id' => $id ) );
		wp_cache_flush();
		$draft   = $this->render( $id );
		$missing = $this->render( 99999999 );
		$this->assertSame( $draft, $missing );
		$this->assertStringNotContainsString( 'published', $draft );
	}

	public function test_queued_jobs_keep_their_details_out_of_the_cron_option(): void {
		wp_unschedule_hook( 'subtleforms_async_email' );
		$this->assertTrue( AsyncDispatcher::dispatchEmail( array( 'to' => 'victim-test@example.com', 'subject' => 'Secret subject', 'body' => 'Private body', 'submission_id' => 5, 'form_id' => 1 ) ) );
		$cron = wp_json_encode( _get_cron_array() );
		$this->assertStringNotContainsString( 'victim-test@example.com', $cron );
		$this->assertStringNotContainsString( 'Private body', $cron );

		// Running the queued job loads the stored details.
		$sent = array();
		add_filter( 'pre_wp_mail', function ( $null, $atts ) use ( &$sent ) {
			$sent[] = $atts;
			return true;
		}, 10, 2 );
		foreach ( _get_cron_array() as $events ) {
			foreach ( $events['subtleforms_async_email'] ?? array() as $event ) {
				AsyncDispatcher::executeEmail( $event['args'][0] );
			}
		}
		remove_all_filters( 'pre_wp_mail' );
		$this->assertNotEmpty( $sent );
		$this->assertSame( 'Secret subject', $sent[0]['subject'] );
		wp_unschedule_hook( 'subtleforms_async_email' );
	}
}
