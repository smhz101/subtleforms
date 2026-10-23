<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * Free fixes after the QA review: masked CAPTCHA secrets, short-lived queued
 * job data, an atomic rate limiter without an object cache, and the privacy
 * export by IP and account.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Privacy\PrivacyLookup;
use SubtleForms\Security\RateLimiter;
use SubtleForms\Security\RateLimitStore;

final class FreeQa272Test extends TestCase {

	private $settingsBefore;

	protected function setUp(): void {
		parent::setUp();
		$this->settingsBefore = get_option( 'subtleforms_settings', null );
		\SubtleForms\Activator::activate();
		PrivacyLookup::resetColumnCheck();
	}

	protected function tearDown(): void {
		null === $this->settingsBefore ? delete_option( 'subtleforms_settings' ) : update_option( 'subtleforms_settings', $this->settingsBefore );
		remove_all_filters( 'pre_wp_mail' );
		parent::tearDown();
	}

	private function settingsRequest( string $method, array $body = array() ) {
		$this->asAdmin();
		$request = new \WP_REST_Request( 'POST' === $method ? 'PUT' : $method, '/subtleforms/v1/settings' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		if ( $body ) {
			$request->set_body( wp_json_encode( $body ) );
		}
		return rest_do_request( $request );
	}

	public function test_captcha_secrets_are_masked_and_kept_when_the_mask_comes_back(): void {
		$settings = get_option( 'subtleforms_settings', array() );
		$settings = is_array( $settings ) ? $settings : array();
		$settings['captcha_recaptcha_secret_key'] = 'real-secret-value';
		$settings['captcha_hcaptcha_secret_key']  = '';
		update_option( 'subtleforms_settings', $settings );

		$res = $this->settingsRequest( 'GET' );
		$this->assertSame( 200, $res->get_status() );
		$data = $res->get_data()['data']['data'] ?? $res->get_data()['data'];
		$this->assertSame( '********', $data['captcha_recaptcha_secret_key'] );
		$this->assertSame( '', $data['captcha_hcaptcha_secret_key'], 'an empty key stays empty' );
		$this->assertStringNotContainsString( 'real-secret-value', wp_json_encode( $res->get_data() ) );

		// The screen sends the mask back with its other changes: the key is kept.
		$save = $this->settingsRequest( 'POST', array( 'captcha_recaptcha_secret_key' => '********', 'captcha_recaptcha_site_key' => 'site-key-1' ) );
		$this->assertContains( $save->get_status(), array( 200, 201 ), wp_json_encode( $save->get_data() ) );
		$stored = get_option( 'subtleforms_settings' );
		$this->assertSame( 'real-secret-value', $stored['captcha_recaptcha_secret_key'] );
		$this->assertSame( 'site-key-1', $stored['captcha_recaptcha_site_key'] );
		$this->assertStringNotContainsString( 'real-secret-value', wp_json_encode( $save->get_data() ) );

		// A new value replaces it.
		$this->settingsRequest( 'POST', array( 'captcha_recaptcha_secret_key' => 'new-secret-value' ) );
		$this->assertSame( 'new-secret-value', get_option( 'subtleforms_settings' )['captcha_recaptcha_secret_key'] );
	}

	private function jobTransient( string $dispatchId ) {
		return get_transient( AsyncDispatcher::JOB_PREFIX . md5( $dispatchId ) );
	}

	public function test_queued_job_data_is_short_lived_minimal_and_deleted_when_the_job_runs(): void {
		wp_unschedule_hook( 'subtleforms_async_email' );
		$this->assertTrue( AsyncDispatcher::dispatchEmail( array( 'to' => 'a@example.com', 'subject' => 'Hello', 'body' => 'Body', 'submission_id' => 0, 'form_id' => 4 ) ) );
		$events = array();
		foreach ( _get_cron_array() as $list ) {
			foreach ( $list['subtleforms_async_email'] ?? array() as $event ) {
				$events[] = $event['args'][0];
			}
		}
		$this->assertCount( 1, $events );
		$ref = $events[0]['job_ref'];

		$stored = $this->jobTransient( $ref );
		$this->assertIsArray( $stored );
		foreach ( array( 'dispatch_id', 'submission_id', 'step_id', 'retry_count' ) as $key ) {
			$this->assertArrayNotHasKey( $key, $stored, $key . ' is in the reference already' );
		}
		$timeout = (int) get_option( '_transient_timeout_' . AsyncDispatcher::JOB_PREFIX . md5( $ref ) );
		$this->assertGreaterThan( time() + 5 * HOUR_IN_SECONDS, $timeout );
		$this->assertLessThanOrEqual( time() + 6 * HOUR_IN_SECONDS + 5, $timeout );

		$sent = array();
		add_filter( 'pre_wp_mail', function ( $null, $atts ) use ( &$sent ) {
			$sent[] = $atts;
			return true;
		}, 10, 2 );
		AsyncDispatcher::executeEmail( $events[0] );
		$this->assertCount( 1, $sent );
		$this->assertFalse( $this->jobTransient( $ref ), 'deleted as soon as the job runs' );
		wp_unschedule_hook( 'subtleforms_async_email' );
	}

	public function test_a_job_that_fails_for_good_leaves_nothing_behind(): void {
		wp_unschedule_hook( 'subtleforms_async_email' );
		add_filter( 'pre_wp_mail', '__return_false' );
		AsyncDispatcher::dispatchEmail( array( 'to' => 'a@example.com', 'subject' => 'Hello', 'body' => 'Body', 'retry_count' => 3 ) );
		$event = null;
		foreach ( _get_cron_array() as $list ) {
			foreach ( $list['subtleforms_async_email'] ?? array() as $found ) {
				$event = $found['args'][0];
			}
		}
		AsyncDispatcher::executeEmail( $event );
		$this->assertFalse( $this->jobTransient( $event['job_ref'] ) );
		wp_unschedule_hook( 'subtleforms_async_email' );
	}

	public function test_the_rate_limiter_counts_in_a_table_without_an_object_cache(): void {
		global $wpdb;
		$this->assertEmpty( wp_using_ext_object_cache(), 'the test site has no persistent object cache' );
		$this->assertTrue( RateLimitStore::ensure() );
		$table = RateLimitStore::table();
		$this->assertSame( $table, $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) );

		$key = 'sf272_bucket_' . wp_generate_password( 6, false );
		$out = array();
		for ( $i = 0; $i < 12; $i++ ) {
			$out[] = RateLimiter::check( $key, 10, 60 );
		}
		$this->assertTrue( $out[9]['allowed'] );
		$this->assertFalse( $out[10]['allowed'] );
		$this->assertFalse( $out[11]['allowed'] );
		$this->assertSame( 1, (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE bucket = %s", md5( preg_replace( '/[^a-zA-Z0-9_]/', '_', $key ) ) ) ), 'one row per bucket' );
		$this->assertSame( 12, (int) $wpdb->get_var( $wpdb->prepare( "SELECT hits FROM {$table} WHERE bucket = %s", md5( preg_replace( '/[^a-zA-Z0-9_]/', '_', $key ) ) ) ) );
		$this->assertGreaterThan( 0, $out[10]['retry_after'] );

		// The daily clean-up removes windows that ended long ago.
		$wpdb->update( $table, array( 'window_start' => time() - 3 * DAY_IN_SECONDS ), array( 'bucket' => md5( preg_replace( '/[^a-zA-Z0-9_]/', '_', $key ) ) ) );
		RateLimitStore::prune();
		$this->assertSame( 0, (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE bucket = %s", md5( preg_replace( '/[^a-zA-Z0-9_]/', '_', $key ) ) ) ) );
		$this->assertNotFalse( has_action( 'subtleforms_daily_cleanup', array( RateLimitStore::class, 'prune' ) ) );
	}

	private function entry( int $formId, array $payload, array $extra = array() ): int {
		global $wpdb;
		$wpdb->insert( $wpdb->prefix . 'subtleforms_submissions', array_merge( array( 'form_id' => $formId, 'payload' => wp_json_encode( $payload ), 'status' => 'completed', 'created_at' => current_time( 'mysql', true ) ), $extra ) );
		return (int) $wpdb->insert_id;
	}

	public function test_the_privacy_export_matches_by_account_and_email_never_by_ip_and_pages_by_id(): void {
		$formId = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$name   = strtolower( 'sf272_' . wp_generate_password( 6, false ) );
		$email  = $name . '@example.com';
		$userId = (int) wp_insert_user( array( 'user_login' => $name, 'user_pass' => wp_generate_password(), 'user_email' => $email ) );
		$ip     = '203.0.113.' . wp_rand( 10, 200 );

		$byAnswer  = $this->entry( $formId, array( 'email' => $email ) );
		$byAccount = $this->entry( $formId, array( 'name' => 'No email typed' ), array( 'user_id' => $userId, 'ip_address' => $ip ) );
		$byIp      = $this->entry( $formId, array( 'name' => 'Anonymous, same address' ), array( 'ip_address' => $ip ) );
		$someone   = $this->entry( $formId, array( 'email' => 'other@example.com' ), array( 'ip_address' => $ip ) );
		$stranger  = $this->entry( $formId, array( 'name' => 'Elsewhere' ), array( 'ip_address' => '198.51.100.9' ) );

		$all = array();
		$page = 1;
		do {
			$found = PrivacyLookup::page( $email, $page, 1 );
			$this->assertLessThanOrEqual( 1, count( $found['ids'] ) );
			$all = array_merge( $all, $found['ids'] );
			$page++;
		} while ( ! $found['done'] && $page < 10 );

		$this->assertSame( array( $byAccount, $byAnswer ), $all, 'newest first, one per page' );
		$this->assertNotContains( $byIp, $all, 'an anonymous entry from the same address is not proof of identity' );
		$this->assertNotContains( $someone, $all, 'an entry with another email address is not exported' );
		$this->assertNotContains( $stranger, $all );

		// A later page continues from the saved id without a new scan.
		$this->assertNotFalse( get_transient( 'subtleforms_privx_' . md5( $email ) . '_2' ) );
		$exporter = new \SubtleForms\Privacy\PrivacyExporter( new \SubtleForms\Repositories\SubmissionsRepository(), new \SubtleForms\Repositories\FormsRepository() );
		$first    = $exporter->export_user_data( $email, 1 );
		$this->assertCount( 2, $first['data'] );
		$this->assertTrue( $first['done'] );

		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $userId );
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $formId ) );
	}
}
