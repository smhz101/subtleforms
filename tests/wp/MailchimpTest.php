<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Mailchimp in the free plugin: REST permissions, the key never leaves the
 * server, the option is not autoloaded, and a saved entry is sent by the
 * queued job and logged. Mailchimp is mocked with pre_http_request.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Integrations\Mailchimp\Connection;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;

final class MailchimpTest extends TestCase {

	/** @var array[] Requests made to Mailchimp. */
	private array $http = array();

	/** @var array[] Cron events queued. */
	private array $jobs = array();

	/** @var callable|null Decides the answer: ( method, url, body ) => array( code, body ). */
	private $answer;

	protected function setUp(): void {
		parent::setUp();
		$this->http   = array();
		$this->jobs   = array();
		$this->answer = null;
		delete_option( Connection::OPTION );
		add_filter( 'pre_http_request', array( $this, 'mock' ), 10, 3 );
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_http_request', array( $this, 'mock' ), 10 );
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		remove_all_filters( 'subtleforms/admin/integrations' );
		remove_all_filters( 'subtleforms/mailchimp/feeds' );
		remove_all_filters( 'subtleforms/mailchimp/skip_reason' );
		remove_all_filters( 'subtleforms/mailchimp/member_body' );
		delete_option( Connection::OPTION );
		parent::tearDown();
	}

	public function mock( $pre, $args, $url ) {
		if ( false === strpos( (string) $url, 'api.mailchimp.com' ) ) {
			return $pre;
		}
		$body           = isset( $args['body'] ) ? json_decode( (string) $args['body'], true ) : null;
		$this->http[]   = array(
			'method' => $args['method'],
			'url'    => $url,
			'body'   => $body,
			'auth'   => $args['headers']['Authorization'] ?? '',
			'timeout' => $args['timeout'] ?? 0,
		);
		$reply = $this->answer ? call_user_func( $this->answer, $args['method'], $url, $body ) : $this->defaultAnswer( $args['method'], $url, $body );
		return array(
			'headers'  => array(),
			'body'     => wp_json_encode( $reply[1] ),
			'response' => array( 'code' => $reply[0], 'message' => '' ),
			'cookies'  => array(),
			'filename' => null,
		);
	}

	private function defaultAnswer( string $method, string $url, $body ): array {
		if ( preg_match( '#/3\.0/\?fields#', $url ) ) {
			return array( 200, array( 'account_name' => 'Acme Studio', 'email' => 'owner@example.com' ) );
		}
		if ( false !== strpos( $url, '/merge-fields' ) ) {
			return array( 200, array( 'merge_fields' => array(
				array( 'tag' => 'EMAIL', 'name' => 'Email Address', 'type' => 'email', 'required' => true ),
				array( 'tag' => 'FNAME', 'name' => 'First Name', 'type' => 'text', 'required' => false ),
				array( 'tag' => 'COMPANY', 'name' => 'Company', 'type' => 'text', 'required' => false ),
				array( 'tag' => 'ADDR', 'name' => 'Address', 'type' => 'address', 'required' => false ),
			) ) );
		}
		if ( preg_match( '#/lists\?#', $url ) ) {
			return array( 200, array( 'lists' => array( array( 'id' => 'abc123', 'name' => 'Newsletter', 'stats' => array( 'member_count' => 42 ) ) ) ) );
		}
		if ( 'PUT' === $method ) {
			return array( 200, array( 'id' => md5( strtolower( (string) ( $body['email_address'] ?? '' ) ) ), 'status' => 'pending' === ( $body['status_if_new'] ?? '' ) ? 'pending' : 'subscribed' ) );
		}
		return array( 200, array() );
	}

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_mailchimp' === $event->hook ) {
			$this->jobs[] = $event->args[0];
			return true;
		}
		return $pre;
	}

	private function key(): string {
		return str_repeat( 'b2', 8 ) . '-us21';
	}

	private function rest( string $method, string $route, array $params = array(), bool $nonce = true ) {
		$request = new \WP_REST_Request( $method, '/subtleforms/v1' . $route );
		foreach ( $params as $k => $v ) {
			$request->set_param( $k, $v );
		}
		if ( $nonce ) {
			$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		}
		return rest_do_request( $request );
	}

	private function connect(): void {
		Connection::save( $this->key(), array( 'name' => 'Acme Studio', 'email' => 'owner@example.com' ) );
	}

	/** A form with Mailchimp on. */
	private function mailchimpForm( array $config = array(), array $extraFields = array() ): int {
		$repo   = new FormsRepository();
		$schema = array(
			'metadata'       => array(
				'type'         => 'regular',
				'name'         => 'Newsletter',
				'title'        => 'Newsletter',
				'integrations' => array(
					'mailchimp' => array_merge(
						array(
							'enabled'      => true,
							'list_id'      => 'abc123',
							'fields'       => array( 'email' => 'email', 'first_name' => 'fname' ),
							'merge_fields' => array( array( 'field' => 'company', 'target' => 'COMPANY' ) ),
							'tags'         => 'website, newsletter',
						),
						$config
					),
				),
			),
			'schema_version' => 1,
			'fields'         => array_merge(
				array(
					array( 'id' => 'f1', 'key' => 'fname', 'type' => 'text', 'label' => 'First name' ),
					array( 'id' => 'f2', 'key' => 'email', 'type' => 'email', 'label' => 'Email', 'required' => true ),
					array( 'id' => 'f3', 'key' => 'company', 'type' => 'text', 'label' => 'Company' ),
					array( 'id' => 'f4', 'key' => 'news', 'type' => 'checkbox', 'label' => 'Send me news' ),
				),
				$extraFields
			),
		);
		$id = $repo->create( array( 'title' => 'Newsletter', 'status' => 'published', 'schema' => $schema ) );
		$repo->saveSchemaVersion( $id, $schema, true );
		$this->formIds[] = $id;
		return $id;
	}

	private function lines( int $submissionId ): array {
		$out = array();
		foreach ( ( new LogsRepository() )->findBySubmission( $submissionId ) as $row ) {
			if ( 'mailchimp' === ( $row['context']['action_type'] ?? '' ) ) {
				$out[] = $row['message'];
			}
		}
		return $out;
	}

	private function submitAndRun( int $formId, array $data ): int {
		$res = $this->submit( $formId, $data );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$id = (int) ( $res['data']['data']['submission_id'] ?? $res['data']['submission_id'] ?? 0 );
		$this->assertGreaterThan( 0, $id );
		foreach ( $this->jobs as $job ) {
			AsyncDispatcher::executeMailchimp( $job );
		}
		return $id;
	}

	// ── REST ────────────────────────────────────────────────────────

	public function test_routes_refuse_visitors_and_people_without_manage_options(): void {
		$routes = array(
			array( 'GET', '/integrations/mailchimp' ),
			array( 'DELETE', '/integrations/mailchimp' ),
			array( 'POST', '/integrations/mailchimp/connect' ),
			array( 'POST', '/integrations/mailchimp/test' ),
			array( 'GET', '/integrations/mailchimp/audiences' ),
			array( 'GET', '/integrations/mailchimp/audiences/abc123/fields' ),
		);
		foreach ( array( 0, self::factory_user( 'editor' ) ) as $user ) {
			wp_set_current_user( $user );
			foreach ( $routes as $r ) {
				$res = $this->rest( $r[0], $r[1], array( 'api_key' => $this->key() ) );
				$this->assertContains( $res->get_status(), array( 401, 403 ), $r[0] . ' ' . $r[1] );
			}
		}
		$this->assertSame( array(), $this->http, 'nothing reached Mailchimp' );
		$this->assertFalse( Connection::hasKey() );
	}

	public function test_a_request_without_the_nonce_is_refused(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/mailchimp/connect', array( 'api_key' => $this->key() ), false );
		$this->assertSame( 403, $res->get_status() );
		$this->assertFalse( Connection::hasKey() );
	}

	public function test_connect_saves_the_key_and_never_returns_it(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/mailchimp/connect', array( 'api_key' => $this->key() ) );
		$this->assertSame( 200, $res->get_status() );
		$data = $res->get_data()['data'];
		$this->assertSame( 'connected', $data['status'] );
		$this->assertSame( 'Acme Studio', $data['account_name'] );
		$this->assertSame( 'us21', $data['last4'] );
		$this->assertSame( $this->key(), Connection::apiKey() );

		foreach ( array(
			$res,
			$this->rest( 'GET', '/integrations/mailchimp' ),
			$this->rest( 'POST', '/integrations/mailchimp/test' ),
			$this->rest( 'GET', '/integrations/mailchimp/audiences' ),
		) as $answer ) {
			$json = wp_json_encode( $answer->get_data() );
			$this->assertStringNotContainsString( $this->key(), $json );
			$this->assertStringNotContainsString( 'b2b2b2', $json );
		}
		// The page data carries no key either.
		$this->assertStringNotContainsString( 'b2b2b2', wp_json_encode( \SubtleForms\Integrations\Registry::all() ) );
	}

	public function test_a_key_that_mailchimp_refuses_is_not_saved(): void {
		$this->asAdmin();
		$this->answer = static fn() => array( 401, array( 'title' => 'API Key Invalid' ) );
		$res          = $this->rest( 'POST', '/integrations/mailchimp/connect', array( 'api_key' => $this->key() ) );
		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( 'Mailchimp did not accept this API key.', $res->get_data()['error']['message'] );
		$this->assertFalse( Connection::hasKey() );
	}

	public function test_a_malformed_key_never_reaches_mailchimp(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/mailchimp/connect', array( 'api_key' => 'not a key' ) );
		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( array(), $this->http );
	}

	public function test_the_option_is_not_autoloaded(): void {
		$this->connect();
		global $wpdb;
		$autoload = $wpdb->get_var( $wpdb->prepare( "SELECT autoload FROM {$wpdb->options} WHERE option_name = %s", Connection::OPTION ) );
		$this->assertNotNull( $autoload );
		$yes = function_exists( 'wp_autoload_values_to_autoload' ) ? wp_autoload_values_to_autoload() : array( 'yes' );
		$this->assertNotContains( $autoload, $yes );
		// And updating it keeps it that way.
		Connection::recordCheck( true, array( 'name' => 'Acme' ) );
		$autoload = $wpdb->get_var( $wpdb->prepare( "SELECT autoload FROM {$wpdb->options} WHERE option_name = %s", Connection::OPTION ) );
		$this->assertNotContains( $autoload, $yes );
	}

	public function test_test_connection_reports_the_account_or_a_plain_error_and_updates_the_status(): void {
		$this->asAdmin();
		$this->connect();
		$ok = $this->rest( 'POST', '/integrations/mailchimp/test' )->get_data()['data'];
		$this->assertTrue( $ok['ok'] );
		$this->assertStringContainsString( 'Acme Studio', $ok['message'] );
		$this->assertStringContainsString( 'owner@example.com', $ok['message'] );

		$this->answer = static fn() => array( 401, array() );
		$bad          = $this->rest( 'POST', '/integrations/mailchimp/test' )->get_data()['data'];
		$this->assertFalse( $bad['ok'] );
		$this->assertSame( 'Mailchimp did not accept this API key.', $bad['message'] );
		$this->assertSame( 'error', Connection::status() );
		$this->assertSame( 'error', $bad['state']['status'] );
	}

	public function test_audiences_and_fields_are_listed_and_cached(): void {
		$this->asAdmin();
		$this->connect();
		$lists = $this->rest( 'GET', '/integrations/mailchimp/audiences' )->get_data()['data'];
		$this->assertSame( array( array( 'id' => 'abc123', 'name' => 'Newsletter', 'count' => 42 ) ), $lists );
		$count = count( $this->http );
		$this->rest( 'GET', '/integrations/mailchimp/audiences' );
		$this->assertCount( $count, $this->http, 'the second call is served from the saved list' );
		$this->rest( 'GET', '/integrations/mailchimp/audiences', array( 'refresh' => true ) );
		$this->assertCount( $count + 1, $this->http, 'refresh asks Mailchimp again' );

		$fields = $this->rest( 'GET', '/integrations/mailchimp/audiences/abc123/fields' )->get_data()['data'];
		$this->assertSame( array( 'COMPANY' ), array_column( $fields, 'tag' ), 'email, first name and address fields are not offered' );
	}

	public function test_lookups_need_a_connection(): void {
		$this->asAdmin();
		$res = $this->rest( 'GET', '/integrations/mailchimp/audiences' );
		$this->assertSame( 400, $res->get_status() );
	}

	public function test_disconnect_removes_the_key(): void {
		$this->asAdmin();
		$this->connect();
		$this->rest( 'DELETE', '/integrations/mailchimp' );
		$this->assertFalse( Connection::hasKey() );
		$this->assertFalse( get_option( Connection::OPTION, false ) );
	}

	// ── Sending ─────────────────────────────────────────────────────

	public function test_a_saved_entry_queues_a_job_that_subscribes_and_logs(): void {
		$this->connect();
		$form = $this->mailchimpForm();
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'Ada@Example.com', 'company' => 'Engines', 'news' => true ) );

		$this->assertCount( 1, $this->jobs );
		$this->assertCount( 2, $this->http );
		$put = $this->http[0];
		$this->assertSame( 'PUT', $put['method'] );
		$this->assertSame( 'https://us21.api.mailchimp.com/3.0/lists/abc123/members/' . md5( 'ada@example.com' ) . '?skip_merge_validation=true', $put['url'] );
		$this->assertSame( 'subscribed', $put['body']['status_if_new'] );
		$this->assertSame( 'Ada', $put['body']['merge_fields']['FNAME'] );
		$this->assertSame( 'Engines', $put['body']['merge_fields']['COMPANY'] );
		$this->assertSame( 'POST', $this->http[1]['method'] );
		$this->assertStringEndsWith( '/tags', $this->http[1]['url'] );
		$this->assertSame( 15, $put['timeout'] );
		$this->assertSame( array( 'Mailchimp: subscribed' ), $this->lines( $id ) );
	}

	public function test_double_opt_in_logs_pending(): void {
		$this->connect();
		$form = $this->mailchimpForm( array( 'double_optin' => true ) );
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( 'pending', $this->http[0]['body']['status_if_new'] );
		$this->assertSame( array( 'Mailchimp: pending (double opt-in)' ), $this->lines( $id ) );
	}

	public function test_nothing_is_sent_when_consent_is_not_given(): void {
		$this->connect();
		$form = $this->mailchimpForm( array( 'consent_field' => 'news' ) );
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array(), $this->http );
		$this->assertSame( array( 'Mailchimp: skipped (consent not given)' ), $this->lines( $id ) );

		$id = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com', 'news' => true ) );
		$this->assertNotEmpty( $this->http );
	}

	public function test_without_update_existing_a_member_is_left_alone(): void {
		$this->connect();
		$form         = $this->mailchimpForm( array( 'update_existing' => false ) );
		$this->answer = function ( $method, $url ) {
			return 'GET' === $method ? array( 200, array( 'id' => 'x', 'status' => 'subscribed' ) ) : $this->defaultAnswer( $method, $url, null );
		};
		$id = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array( 'GET' ), array_column( $this->http, 'method' ) );
		$this->assertSame( array( 'Mailchimp: skipped (already in the audience)' ), $this->lines( $id ) );
	}

	public function test_a_mailchimp_error_is_logged_and_never_fails_the_submission(): void {
		$this->connect();
		$form         = $this->mailchimpForm();
		$this->answer = static fn() => array( 400, array( 'title' => 'Invalid Resource', 'detail' => 'Please provide a valid email address.' ) );
		$id           = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$lines        = $this->lines( $id );
		$this->assertCount( 1, $lines );
		$this->assertStringStartsWith( 'Mailchimp: failed: ', $lines[0] );
		$this->assertStringContainsString( 'Please provide a valid email address.', $lines[0] );
		$this->assertCount( 1, $this->jobs, 'a 400 is not tried again' );
	}

	public function test_a_server_error_is_tried_again_later(): void {
		$this->connect();
		$form         = $this->mailchimpForm();
		$this->answer = static fn() => array( 503, array() );
		$id           = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertCount( 2, $this->jobs, 'a retry was queued' );
		$retry = $this->jobs[1];
		$this->assertSame( 1, $retry['retry_count'] );
		$this->assertStringContainsString( 'trying again in 2 minutes', $this->lines( $id )[0] );

		// The retry succeeds.
		$this->answer = null;
		AsyncDispatcher::executeMailchimp( $retry );
		$this->assertSame( 'Mailchimp: subscribed', $this->lines( $id )[1] );
	}

	public function test_an_unreachable_mailchimp_is_logged_not_thrown(): void {
		$this->connect();
		$form = $this->mailchimpForm();
		remove_filter( 'pre_http_request', array( $this, 'mock' ), 10 );
		add_filter( 'pre_http_request', static fn( $pre, $a, $url ) => false !== strpos( (string) $url, 'mailchimp' ) ? new \WP_Error( 'http_request_failed', 'cURL error 28: timed out' ) : $pre, 10, 3 );
		$id = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		remove_all_filters( 'pre_http_request' );
		$this->assertStringContainsString( 'Mailchimp: failed: Could not reach Mailchimp: cURL error 28', $this->lines( $id )[0] );
	}

	public function test_a_form_with_mailchimp_off_queues_nothing(): void {
		$this->connect();
		$form = $this->mailchimpForm( array( 'enabled' => false ) );
		$this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array(), $this->jobs );
		$this->assertSame( array(), $this->http );
	}

	public function test_without_a_connection_the_entry_says_why(): void {
		$form = $this->mailchimpForm();
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array(), $this->http );
		$this->assertStringContainsString( 'Mailchimp: skipped (not connected', $this->lines( $id )[0] );
	}

	public function test_a_spam_entry_is_never_sent(): void {
		$this->connect();
		$form = $this->mailchimpForm();
		$res  = $this->submit( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$id   = (int) ( $res['data']['data']['submission_id'] ?? $res['data']['submission_id'] ?? 0 );
		( new \SubtleForms\Repositories\SubmissionsRepository() )->update( $id, array( 'status' => 'spam' ) );
		$this->http = array();
		foreach ( $this->jobs as $job ) {
			AsyncDispatcher::executeMailchimp( $job );
		}
		$this->assertSame( array(), $this->http );
		$this->assertStringContainsString( 'skipped', $this->lines( $id )[0] );
	}

	public function test_an_add_on_that_lists_its_own_mailchimp_takes_over_and_this_plugin_sends_nothing(): void {
		$this->connect();
		$form = $this->mailchimpForm();
		add_filter(
			'subtleforms/admin/integrations',
			static function ( $list ) {
				$list['mailchimp'] = array( 'slug' => 'mailchimp', 'label' => 'Mailchimp', 'available' => true, 'enabled' => true, 'configured' => true );
				return $list;
			}
		);
		$this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array(), $this->jobs );
		$this->assertSame( array(), $this->http );
		// A job already queued also steps aside.
		AsyncDispatcher::executeMailchimp( array( 'submission_id' => 1 ) );
		$this->assertSame( array(), $this->http );
	}

	public function test_add_ons_can_add_a_feed_skip_a_feed_and_change_the_body(): void {
		$this->connect();
		$form = $this->mailchimpForm();
		add_filter(
			'subtleforms/mailchimp/feeds',
			static function ( $feeds ) {
				$second           = $feeds[0];
				$second['id']     = 'second';
				$second['list_id'] = 'zzz999';
				$feeds[]          = $second;
				return $feeds;
			}
		);
		add_filter( 'subtleforms/mailchimp/skip_reason', static fn( $reason, $feed ) => 'second' === $feed['id'] ? null : $reason, 10, 2 );
		add_filter( 'subtleforms/mailchimp/member_body', static function ( $body ) {
			$body['interests'] = array( 'g1' => true );
			return $body;
		} );
		$id = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$puts = array_values( array_filter( $this->http, static fn( $r ) => 'PUT' === $r['method'] ) );
		$this->assertCount( 2, $puts );
		$this->assertStringContainsString( '/lists/zzz999/', $puts[1]['url'] );
		$this->assertSame( array( 'g1' => true ), $puts[0]['body']['interests'] );
		$this->assertCount( 2, $this->lines( $id ) );

		// A skip reason skips the feed and says why.
		$this->http = array();
		remove_all_filters( 'subtleforms/mailchimp/skip_reason' );
		add_filter( 'subtleforms/mailchimp/skip_reason', static fn() => 'the rule did not match' );
		$this->jobs = array();
		$id2 = $this->submitAndRun( $form, array( 'fname' => 'Bob', 'email' => 'bob@example.com' ) );
		$this->assertSame( array(), $this->http );
		$this->assertSame( 'Mailchimp: skipped (the rule did not match)', $this->lines( $id2 )[0] );
	}
}
