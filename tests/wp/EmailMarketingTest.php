<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Email marketing in the free plugin (Mailchimp, Brevo, Kit): REST
 * permissions, keys never leave the server, options are not autoloaded, and a
 * saved entry is sent by the queued job and logged. The services are mocked
 * with pre_http_request.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;

final class EmailMarketingTest extends TestCase {

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
		$this->wipe();
		add_filter( 'pre_http_request', array( $this, 'mock' ), 10, 3 );
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_http_request', array( $this, 'mock' ), 10 );
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		remove_all_filters( 'subtleforms/admin/integrations' );
		remove_all_filters( 'subtleforms/email/marketing/services' );
		remove_all_filters( 'subtleforms/email/marketing/extras' );
		remove_all_filters( 'subtleforms/email/marketing/feeds' );
		remove_all_filters( 'subtleforms/email/marketing/skip_reason' );
		remove_all_filters( 'subtleforms/email/marketing/request_body' );
		$this->wipe();
		parent::tearDown();
	}

	public function mock( $pre, $args, $url ) {
		if ( ! preg_match( '#^https://([a-z0-9]+\.api\.mailchimp\.com|api\.brevo\.com|api\.kit\.com)/#', (string) $url ) ) {
			return $pre;
		}
		$body           = isset( $args['body'] ) ? json_decode( (string) $args['body'], true ) : null;
		$this->http[]   = array(
			'method' => $args['method'],
			'url'    => $url,
			'body'   => $body,
			'auth'   => $args['headers']['Authorization'] ?? ( $args['headers']['api-key'] ?? ( $args['headers']['X-Kit-Api-Key'] ?? '' ) ),
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
		if ( false !== strpos( $url, 'api.brevo.com' ) ) {
			return $this->brevoAnswer( $method, $url, $body );
		}
		if ( false !== strpos( $url, 'api.kit.com' ) ) {
			return $this->kitAnswer( $method, $url, $body );
		}
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

	private function brevoAnswer( string $method, string $url, $body ): array {
		if ( false !== strpos( $url, '/v3/account' ) ) {
			return array( 200, array( 'companyName' => 'Acme Studio', 'email' => 'owner@example.com' ) );
		}
		if ( false !== strpos( $url, '/contacts/lists' ) ) {
			return array( 200, array( 'lists' => array( array( 'id' => 7, 'name' => 'Newsletter', 'uniqueSubscribers' => 42 ) ) ) );
		}
		if ( false !== strpos( $url, '/contacts/attributes' ) ) {
			return array( 200, array( 'attributes' => array(
				array( 'name' => 'FIRSTNAME', 'category' => 'normal', 'type' => 'text' ),
				array( 'name' => 'COMPANY', 'category' => 'normal', 'type' => 'text' ),
				array( 'name' => 'DOUBLE_OPT-IN', 'category' => 'category', 'type' => 'category' ),
			) ) );
		}
		if ( false !== strpos( $url, '/smtp/templates' ) ) {
			return array( 200, array( 'templates' => array( array( 'id' => 12, 'name' => 'Confirm' ) ) ) );
		}
		if ( 'GET' === $method && false !== strpos( $url, '/v3/contacts/' ) ) {
			return array( 404, array( 'code' => 'document_not_found' ) );
		}
		if ( false !== strpos( $url, 'doubleOptinConfirmation' ) ) {
			return array( 204, array() );
		}
		return array( 201, array( 'id' => 321 ) );
	}

	private function kitAnswer( string $method, string $url, $body ): array {
		if ( false !== strpos( $url, '/v4/account' ) ) {
			return array( 200, array( 'account' => array( 'name' => 'Acme Studio' ), 'user' => array( 'email' => 'owner@example.com' ) ) );
		}
		if ( false !== strpos( $url, '/v4/forms' ) && 'GET' === $method ) {
			return array( 200, array( 'forms' => array( array( 'id' => 99, 'name' => 'Landing page' ) ) ) );
		}
		if ( false !== strpos( $url, '/custom_fields' ) ) {
			return array( 200, array( 'custom_fields' => array(
				array( 'key' => 'company', 'label' => 'Company' ),
				array( 'key' => 'last_name', 'label' => 'Last name' ),
			) ) );
		}
		if ( false !== strpos( $url, '/v4/subscribers?' ) ) {
			return array( 200, array( 'subscribers' => array() ) );
		}
		if ( preg_match( '#/v4/tags$#', $url ) ) {
			return array( 201, array( 'tag' => array( 'id' => 55, 'name' => (string) ( $body['name'] ?? '' ) ) ) );
		}
		if ( preg_match( '#/v4/subscribers$#', $url ) ) {
			return array( 201, array( 'subscriber' => array( 'id' => 777 ) ) );
		}
		return array( 200, array() );
	}

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_email_marketing' === $event->hook ) {
			$this->jobs[] = $event->args[0];
			return true;
		}
		return $pre;
	}

	private function key(): string {
		return str_repeat( 'b2', 8 ) . '-us21';
	}

	private function brevoKey(): string {
		return 'xkeysib-' . str_repeat( 'c3', 12 );
	}

	private function kitKey(): string {
		return 'kit_' . str_repeat( 'd4', 10 );
	}

	private function keyFor( string $slug ): string {
		return array( 'mailchimp' => $this->key(), 'brevo' => $this->brevoKey(), 'kit' => $this->kitKey() )[ $slug ];
	}

	private function conn( string $slug = 'mailchimp' ): Connection {
		return new Connection( $slug );
	}

	private function wipe(): void {
		foreach ( array( 'mailchimp', 'brevo', 'kit' ) as $slug ) {
			delete_option( Connection::optionName( $slug ) );
		}
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

	private function connect( string $slug = 'mailchimp', bool $enabled = true ): void {
		$this->conn( $slug )->save( $this->keyFor( $slug ), array( 'name' => 'Acme Studio', 'email' => 'owner@example.com' ), $enabled );
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

	private function lines( int $submissionId, string $service = 'mailchimp' ): array {
		$out = array();
		foreach ( ( new LogsRepository() )->findBySubmission( $submissionId ) as $row ) {
			if ( $service === ( $row['context']['action_type'] ?? '' ) ) {
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
			AsyncDispatcher::executeEmailMarketing( $job );
		}
		return $id;
	}

	// ── REST ────────────────────────────────────────────────────────

	public function test_routes_refuse_visitors_and_people_without_manage_options(): void {
		$routes = array(
			array( 'GET', '/integrations/email-marketing/mailchimp' ),
			array( 'DELETE', '/integrations/email-marketing/mailchimp' ),
			array( 'POST', '/integrations/email-marketing/mailchimp/connect' ),
			array( 'POST', '/integrations/email-marketing/mailchimp/test' ),
			array( 'GET', '/integrations/email-marketing/mailchimp/lists' ),
			array( 'GET', '/integrations/email-marketing/mailchimp/fields' ),
		);
		foreach ( array( 0, self::factory_user( 'editor' ) ) as $user ) {
			wp_set_current_user( $user );
			foreach ( $routes as $r ) {
				$res = $this->rest( $r[0], $r[1], array( 'api_key' => $this->key() ) );
				$this->assertContains( $res->get_status(), array( 401, 403 ), $r[0] . ' ' . $r[1] );
			}
		}
		$this->assertSame( array(), $this->http, 'nothing reached Mailchimp' );
		$this->assertFalse( $this->conn()->hasKey() );
	}

	public function test_a_request_without_the_nonce_is_refused(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/email-marketing/mailchimp/connect', array( 'api_key' => $this->key() ), false );
		$this->assertSame( 403, $res->get_status() );
		$this->assertFalse( $this->conn()->hasKey() );
	}

	public function test_connect_saves_the_key_and_never_returns_it(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/email-marketing/mailchimp/connect', array( 'api_key' => $this->key() ) );
		$this->assertSame( 200, $res->get_status() );
		$data = $res->get_data()['data'];
		$this->assertSame( 'connected', $data['status'] );
		$this->assertSame( 'Acme Studio', $data['account_name'] );
		$this->assertSame( 'us21', $data['last4'] );
		$this->assertSame( $this->key(), $this->conn()->apiKey() );

		foreach ( array(
			$res,
			$this->rest( 'GET', '/integrations/email-marketing/mailchimp' ),
			$this->rest( 'POST', '/integrations/email-marketing/mailchimp/test' ),
			$this->rest( 'GET', '/integrations/email-marketing/mailchimp/lists' ),
		) as $answer ) {
			$json = wp_json_encode( $answer->get_data() );
			$this->assertStringNotContainsString( $this->key(), $json );
			$this->assertStringNotContainsString( 'b2b2b2', $json );
		}
		// The page data carries no key either.
		$this->assertStringNotContainsString( 'b2b2b2', wp_json_encode( \SubtleForms\Integrations\Registry::all() ) );
		$this->assertStringNotContainsString( 'b2b2b2', wp_json_encode( \SubtleForms\Integrations\EmailMarketing\Services::all() ) );
	}

	public function test_a_key_that_mailchimp_refuses_is_not_saved(): void {
		$this->asAdmin();
		$this->answer = static fn() => array( 401, array( 'title' => 'API Key Invalid' ) );
		$res          = $this->rest( 'POST', '/integrations/email-marketing/mailchimp/connect', array( 'api_key' => $this->key() ) );
		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( 'Mailchimp did not accept this API key.', $res->get_data()['error']['message'] );
		$this->assertFalse( $this->conn()->hasKey() );
	}

	public function test_a_malformed_key_never_reaches_mailchimp(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/email-marketing/mailchimp/connect', array( 'api_key' => 'not a key' ) );
		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( array(), $this->http );
	}

	public function test_the_option_is_not_autoloaded(): void {
		$this->connect();
		global $wpdb;
		$autoload = $wpdb->get_var( $wpdb->prepare( "SELECT autoload FROM {$wpdb->options} WHERE option_name = %s", Connection::optionName( 'mailchimp' ) ) );
		$this->assertNotNull( $autoload );
		$yes = function_exists( 'wp_autoload_values_to_autoload' ) ? wp_autoload_values_to_autoload() : array( 'yes' );
		$this->assertNotContains( $autoload, $yes );
		// And updating it keeps it that way.
		$this->conn()->recordCheck( true, array( 'name' => 'Acme' ) );
		$autoload = $wpdb->get_var( $wpdb->prepare( "SELECT autoload FROM {$wpdb->options} WHERE option_name = %s", Connection::optionName( 'mailchimp' ) ) );
		$this->assertNotContains( $autoload, $yes );
	}

	public function test_test_connection_reports_the_account_or_a_plain_error_and_updates_the_status(): void {
		$this->asAdmin();
		$this->connect();
		$ok = $this->rest( 'POST', '/integrations/email-marketing/mailchimp/test' )->get_data()['data'];
		$this->assertTrue( $ok['ok'] );
		$this->assertStringContainsString( 'Acme Studio', $ok['message'] );
		$this->assertStringContainsString( 'owner@example.com', $ok['message'] );

		$this->answer = static fn() => array( 401, array() );
		$bad          = $this->rest( 'POST', '/integrations/email-marketing/mailchimp/test' )->get_data()['data'];
		$this->assertFalse( $bad['ok'] );
		$this->assertSame( 'Mailchimp did not accept this API key.', $bad['message'] );
		$this->assertSame( 'error', $this->conn()->status() );
		$this->assertSame( 'error', $bad['state']['status'] );
	}

	public function test_audiences_and_fields_are_listed_and_cached(): void {
		$this->asAdmin();
		$this->connect();
		$lists = $this->rest( 'GET', '/integrations/email-marketing/mailchimp/lists' )->get_data()['data'];
		$this->assertSame( array( array( 'id' => 'abc123', 'name' => 'Newsletter', 'count' => 42 ) ), $lists );
		$count = count( $this->http );
		$this->rest( 'GET', '/integrations/email-marketing/mailchimp/lists' );
		$this->assertCount( $count, $this->http, 'the second call is served from the saved list' );
		$this->rest( 'GET', '/integrations/email-marketing/mailchimp/lists', array( 'refresh' => true ) );
		$this->assertCount( $count + 1, $this->http, 'refresh asks Mailchimp again' );

		$fields = $this->rest( 'GET', '/integrations/email-marketing/mailchimp/fields', array( 'list_id' => 'abc123' ) )->get_data()['data'];
		$this->assertSame( array( 'COMPANY' ), array_column( $fields, 'tag' ), 'email, first name and address fields are not offered' );
	}

	public function test_lookups_need_a_connection(): void {
		$this->asAdmin();
		$res = $this->rest( 'GET', '/integrations/email-marketing/mailchimp/lists' );
		$this->assertSame( 400, $res->get_status() );
	}

	public function test_disconnect_removes_the_key(): void {
		$this->asAdmin();
		$this->connect();
		$this->rest( 'DELETE', '/integrations/email-marketing/mailchimp' );
		$this->assertFalse( $this->conn()->hasKey() );
		$this->assertTrue( $this->conn()->isEnabled(), 'the switch and the settings stay' );
		$this->assertSame( '', get_option( Connection::optionName( 'mailchimp' ) )['api_key'] );
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
		$this->assertSame( array( 'Mailchimp: skipped (already in the list)' ), $this->lines( $id ) );
	}

	public function test_a_retry_after_a_half_finished_send_still_adds_the_tags(): void {
		$this->connect();
		$form = $this->mailchimpForm( array( 'update_existing' => false ) );

		// The person is new, the add works, the tags request fails.
		$this->answer = function ( $method, $url, $body ) {
			if ( 'GET' === $method ) {
				return array( 404, array() );
			}
			if ( false !== strpos( $url, '/tags' ) ) {
				return array( 503, array() );
			}
			return $this->defaultAnswer( $method, $url, $body );
		};
		$id    = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$retry = $this->jobs[1];

		// On the retry the person exists, because this job added them.
		$this->http   = array();
		$this->answer = function ( $method, $url, $body ) {
			return 'GET' === $method ? array( 200, array( 'id' => 'x', 'status' => 'subscribed' ) ) : $this->defaultAnswer( $method, $url, $body );
		};
		AsyncDispatcher::executeEmailMarketing( $retry );
		$this->assertNotContains( 'GET', array_column( $this->http, 'method' ), 'The retry does not ask again.' );
		$lines = $this->lines( $id );
		$this->assertSame( 'Mailchimp: subscribed', end( $lines ) );
		$this->assertContains( 'POST', array_column( $this->http, 'method' ), 'The tags went out.' );
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
		AsyncDispatcher::executeEmailMarketing( $retry );
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
		$this->conn()->setEnabled( true );
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
			AsyncDispatcher::executeEmailMarketing( $job );
		}
		$this->assertSame( array(), $this->http );
		$this->assertStringContainsString( 'skipped', $this->lines( $id )[0] );
	}

	public function test_an_add_on_that_lists_its_own_email_marketing_takes_over_and_this_plugin_sends_nothing(): void {
		$this->connect();
		$form = $this->mailchimpForm();
		add_filter(
			'subtleforms/admin/integrations',
			static function ( $list ) {
				$list['email_marketing'] = array( 'slug' => 'email_marketing', 'label' => 'Email marketing', 'available' => true, 'enabled' => true, 'configured' => true );
				return $list;
			}
		);
		$this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array(), $this->jobs );
		$this->assertSame( array(), $this->http );
		// A job already queued also steps aside.
		AsyncDispatcher::executeEmailMarketing( array( 'service' => 'mailchimp', 'submission_id' => 1 ) );
		$this->assertSame( array(), $this->http );
	}

	public function test_an_add_on_that_lists_one_service_takes_only_that_service(): void {
		$this->connect( 'mailchimp' );
		$this->connect( 'kit' );
		$form = $this->mailchimpForm();
		add_filter(
			'subtleforms/email/marketing/services',
			static function ( $list ) {
				$list['mailchimp'] = array( 'slug' => 'mailchimp', 'label' => 'Mailchimp', 'available' => true, 'enabled' => true, 'configured' => true );
				return $list;
			}
		);
		$this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array(), $this->http, 'Mailchimp now belongs to the add-on' );
		$this->assertTrue( \SubtleForms\Integrations\EmailMarketing\Services::coreOwns( 'kit' ) );
	}

	public function test_add_ons_can_add_a_feed_skip_a_feed_and_change_the_body(): void {
		$this->connect();
		$form = $this->mailchimpForm();
		add_filter(
			'subtleforms/email/marketing/feeds',
			static function ( $feeds ) {
				$second           = $feeds[0];
				$second['id']     = 'second';
				$second['list_id'] = 'zzz999';
				$feeds[]          = $second;
				return $feeds;
			}
		);
		add_filter( 'subtleforms/email/marketing/skip_reason', static fn( $reason, $feed ) => 'second' === $feed['id'] ? null : $reason, 10, 2 );
		add_filter( 'subtleforms/email/marketing/request_body', static function ( $body ) {
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
		remove_all_filters( 'subtleforms/email/marketing/skip_reason' );
		add_filter( 'subtleforms/email/marketing/skip_reason', static fn() => 'the rule did not match' );
		$this->jobs = array();
		$id2 = $this->submitAndRun( $form, array( 'fname' => 'Bob', 'email' => 'bob@example.com' ) );
		$this->assertSame( array(), $this->http );
		$this->assertSame( 'Mailchimp: skipped (the rule did not match)', $this->lines( $id2 )[0] );
	}

	// ── Switch, settings, banner ────────────────────────────────────

	public function test_the_enabled_route_switches_a_service_and_keeps_its_key_and_settings(): void {
		$this->asAdmin();
		$this->connect( 'brevo', false );
		$this->rest( 'POST', '/integrations/email-marketing/brevo/settings', array( 'doi_template_id' => 12, 'doi_redirect_url' => 'https://example.com/thanks' ) );

		$on = $this->rest( 'POST', '/integrations/email-marketing/brevo/enabled', array( 'enabled' => true ) )->get_data()['data'];
		$this->assertTrue( $on['enabled'] );
		$off = $this->rest( 'POST', '/integrations/email-marketing/brevo/enabled', array( 'enabled' => false ) )->get_data()['data'];
		$this->assertFalse( $off['enabled'] );
		$this->assertTrue( $this->conn( 'brevo' )->hasKey(), 'the key stays' );
		$this->assertSame( 12, $this->conn( 'brevo' )->settings()['doi_template_id'], 'the settings stay' );

		$back = $this->rest( 'POST', '/integrations/email-marketing/brevo/enabled', array( 'enabled' => true ) )->get_data()['data'];
		$this->assertTrue( $back['enabled'] );
		$this->assertTrue( $back['has_key'] );
		$this->assertSame( 'https://example.com/thanks', $back['settings']['doi_redirect_url'] );
	}

	public function test_a_form_with_the_service_off_keeps_its_form_settings(): void {
		$this->connect( 'mailchimp', false );
		$form = $this->mailchimpForm();
		$this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array(), $this->jobs, 'off means nothing is queued' );
		$this->conn()->setEnabled( true );
		$this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertNotEmpty( $this->http, 'switched on again, the form settings still work' );
	}

	public function test_every_service_route_refuses_visitors(): void {
		wp_set_current_user( 0 );
		foreach ( array( 'mailchimp', 'brevo', 'kit' ) as $slug ) {
			foreach ( array(
				array( 'GET', '' ),
				array( 'POST', '/enabled' ),
				array( 'POST', '/connect' ),
				array( 'POST', '/test' ),
				array( 'POST', '/settings' ),
				array( 'GET', '/lists' ),
				array( 'GET', '/fields' ),
			) as $r ) {
				$res = $this->rest( $r[0], '/integrations/email-marketing/' . $slug . $r[1], array( 'api_key' => $this->keyFor( $slug ), 'enabled' => true ) );
				$this->assertContains( $res->get_status(), array( 401, 403 ), $slug . ' ' . $r[0] . ' ' . $r[1] );
			}
		}
		$this->assertSame( array(), $this->http );
	}

	public function test_banner_dismiss_is_per_user_and_hides_the_banner_everywhere(): void {
		$this->asAdmin();
		$admin = get_current_user_id();
		delete_user_meta( $admin, \SubtleForms\Api\EmailMarketingApi::BANNER_META );
		$this->assertFalse( \SubtleForms\Api\EmailMarketingApi::bannerDismissed( $admin ) );
		$res = $this->rest( 'POST', '/integrations/email-marketing/banner/dismiss' );
		$this->assertSame( 200, $res->get_status() );
		$this->assertTrue( \SubtleForms\Api\EmailMarketingApi::bannerDismissed( $admin ) );
		$other = self::factory_user( 'administrator' );
		$this->assertFalse( \SubtleForms\Api\EmailMarketingApi::bannerDismissed( $other ) );
		wp_set_current_user( $other );
		$this->assertFalse( \SubtleForms\Api\EmailMarketingApi::bannerDismissed( get_current_user_id() ) );
		delete_user_meta( $admin, \SubtleForms\Api\EmailMarketingApi::BANNER_META );
	}

	public function test_the_banner_dismiss_route_refuses_editors(): void {
		wp_set_current_user( self::factory_user( 'editor' ) );
		$res = $this->rest( 'POST', '/integrations/email-marketing/banner/dismiss' );
		$this->assertContains( $res->get_status(), array( 401, 403 ) );
	}

	// ── Brevo ───────────────────────────────────────────────────────

	private function serviceForm( string $service, array $config = array() ): int {
		$repo   = new FormsRepository();
		$schema = array(
			'metadata'       => array(
				'type'         => 'regular',
				'name'         => 'Newsletter',
				'title'        => 'Newsletter',
				'integrations' => array(
					$service => array_merge(
						array(
							'enabled' => true,
							'list_id' => 'brevo' === $service ? '7' : ( 'kit' === $service ? '99' : 'abc123' ),
							'fields'  => array( 'email' => 'email', 'first_name' => 'fname' ),
							'tags'    => 'kit' === $service ? 'website' : '',
						),
						$config
					),
				),
			),
			'schema_version' => 1,
			'fields'         => array(
				array( 'id' => 'f1', 'key' => 'fname', 'type' => 'text', 'label' => 'First name' ),
				array( 'id' => 'f2', 'key' => 'email', 'type' => 'email', 'label' => 'Email', 'required' => true ),
				array( 'id' => 'f4', 'key' => 'news', 'type' => 'checkbox', 'label' => 'Send me news' ),
			),
		);
		$id = $repo->create( array( 'title' => 'Newsletter', 'status' => 'published', 'schema' => $schema ) );
		$repo->saveSchemaVersion( $id, $schema, true );
		$this->formIds[] = $id;
		return $id;
	}

	public function test_brevo_connects_lists_and_never_returns_the_key(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/email-marketing/brevo/connect', array( 'api_key' => $this->brevoKey() ) );
		$this->assertSame( 200, $res->get_status() );
		$this->assertSame( 'Acme Studio', $res->get_data()['data']['account_name'] );
		$this->assertSame( $this->brevoKey(), $this->conn( 'brevo' )->apiKey() );
		$this->assertSame( $this->brevoKey(), $this->http[0]['auth'], 'Brevo is called with its api-key header' );

		$lists = $this->rest( 'GET', '/integrations/email-marketing/brevo/lists' )->get_data()['data'];
		$this->assertSame( '7', $lists[0]['id'] );
		$fields = $this->rest( 'GET', '/integrations/email-marketing/brevo/fields' )->get_data()['data'];
		$this->assertSame( array( 'COMPANY' ), array_column( $fields, 'tag' ), 'name and system attributes are not offered' );
		$templates = $this->rest( 'GET', '/integrations/email-marketing/brevo/templates' )->get_data()['data'];
		$this->assertSame( '12', $templates[0]['id'] );

		$json = wp_json_encode( array( $res->get_data(), $lists, $fields, $this->rest( 'GET', '/integrations/email-marketing/brevo' )->get_data() ) );
		$this->assertStringNotContainsString( 'c3c3c3', $json );
	}

	public function test_a_wrong_shaped_key_never_reaches_brevo_or_kit(): void {
		$this->asAdmin();
		$this->assertSame( 400, $this->rest( 'POST', '/integrations/email-marketing/brevo/connect', array( 'api_key' => 'xsmtpsib-' . str_repeat( 'c3', 12 ) ) )->get_status() );
		$this->assertSame( 400, $this->rest( 'POST', '/integrations/email-marketing/kit/connect', array( 'api_key' => 'short' ) )->get_status() );
		$this->assertSame( array(), $this->http );
	}

	public function test_a_brevo_entry_is_upserted_without_a_list_check_and_logged(): void {
		$this->connect( 'brevo' );
		$form = $this->serviceForm( 'brevo' );
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertCount( 1, $this->http );
		$this->assertSame( 'https://api.brevo.com/v3/contacts', $this->http[0]['url'] );
		$this->assertTrue( $this->http[0]['body']['updateEnabled'] );
		$this->assertSame( array( 7 ), $this->http[0]['body']['listIds'] );
		$this->assertSame( array( 'Brevo: subscribed' ), $this->lines( $id, 'brevo' ) );
	}

	public function test_a_brevo_entry_without_a_list_still_goes_through(): void {
		$this->connect( 'brevo' );
		$form = $this->serviceForm( 'brevo', array( 'list_id' => '' ) );
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertCount( 1, $this->http );
		$this->assertArrayNotHasKey( 'listIds', $this->http[0]['body'] );
		$this->assertSame( array( 'Brevo: subscribed' ), $this->lines( $id, 'brevo' ) );
	}

	public function test_brevo_double_opt_in_without_a_template_is_logged_as_a_failure_not_sent(): void {
		$this->connect( 'brevo' );
		$form = $this->serviceForm( 'brevo', array( 'double_optin' => true ) );
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array(), $this->http );
		$this->assertStringContainsString( 'Brevo: failed: Double opt-in needs a template', $this->lines( $id, 'brevo' )[0] );
	}

	public function test_brevo_double_opt_in_sends_the_confirmation_request(): void {
		$this->connect( 'brevo' );
		$this->conn( 'brevo' )->saveSettings( array( 'doi_template_id' => 12, 'doi_redirect_url' => 'https://example.com/thanks' ) );
		$form = $this->serviceForm( 'brevo', array( 'double_optin' => true ) );
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$urls = array_column( $this->http, 'url' );
		$this->assertContains( 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation', $urls );
		$this->assertSame( array( 'Brevo: pending (double opt-in)' ), $this->lines( $id, 'brevo' ) );
	}

	// ── Kit ─────────────────────────────────────────────────────────

	public function test_kit_connects_lists_forms_and_custom_fields(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/email-marketing/kit/connect', array( 'api_key' => $this->kitKey() ) );
		$this->assertSame( 200, $res->get_status() );
		$this->assertSame( 'Acme Studio', $res->get_data()['data']['account_name'] );
		$this->assertSame( $this->kitKey(), $this->http[0]['auth'], 'Kit is called with its key header' );
		$this->assertSame( '99', $this->rest( 'GET', '/integrations/email-marketing/kit/lists' )->get_data()['data'][0]['id'] );
		$fields = $this->rest( 'GET', '/integrations/email-marketing/kit/fields' )->get_data()['data'];
		$this->assertSame( array( 'company' ), array_column( $fields, 'tag' ) );
		$this->assertStringNotContainsString( 'd4d4d4', wp_json_encode( $res->get_data() ) );
	}

	public function test_a_kit_entry_creates_the_subscriber_joins_the_form_and_adds_the_tag(): void {
		$this->connect( 'kit' );
		$form = $this->serviceForm( 'kit' );
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$urls = array_column( $this->http, 'url' );
		$this->assertSame( 'https://api.kit.com/v4/subscribers', $urls[0] );
		$this->assertContains( 'https://api.kit.com/v4/forms/99/subscribers', $urls );
		$this->assertContains( 'https://api.kit.com/v4/tags', $urls );
		$this->assertContains( 'https://api.kit.com/v4/tags/55/subscribers', $urls );
		$this->assertSame( array( 'Kit: subscribed' ), $this->lines( $id, 'kit' ) );
	}

	public function test_a_kit_entry_without_a_form_still_creates_the_subscriber(): void {
		$this->connect( 'kit' );
		$form = $this->serviceForm( 'kit', array( 'list_id' => '', 'tags' => '' ) );
		$id   = $this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$this->assertSame( array( 'https://api.kit.com/v4/subscribers' ), array_column( $this->http, 'url' ) );
		$this->assertSame( array( 'Kit: subscribed' ), $this->lines( $id, 'kit' ) );
	}

	public function test_services_are_independent_on_one_form(): void {
		$this->connect( 'brevo' );
		$this->connect( 'kit' );
		$form = $this->serviceForm( 'brevo' );
		$this->submitAndRun( $form, array( 'fname' => 'Ada', 'email' => 'ada@example.com' ) );
		$hosts = array_unique( array_map( static fn( $r ) => wp_parse_url( $r['url'], PHP_URL_HOST ), $this->http ) );
		$this->assertSame( array( 'api.brevo.com' ), array_values( $hosts ), 'only the service the form turned on is called' );
	}

	public function test_nothing_is_autoloaded_for_any_service(): void {
		global $wpdb;
		foreach ( array( 'mailchimp', 'brevo', 'kit' ) as $slug ) {
			$this->connect( $slug );
			$autoload = $wpdb->get_var( $wpdb->prepare( "SELECT autoload FROM {$wpdb->options} WHERE option_name = %s", Connection::optionName( $slug ) ) );
			$yes      = function_exists( 'wp_autoload_values_to_autoload' ) ? wp_autoload_values_to_autoload() : array( 'yes' );
			$this->assertNotNull( $autoload, $slug );
			$this->assertNotContains( $autoload, $yes, $slug );
		}
	}
}
