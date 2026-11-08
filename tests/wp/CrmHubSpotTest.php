<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * HubSpot in the free plugin: REST permissions, the token never leaves the
 * server, connect and test connection (portal name and id), a saved entry is
 * sent by the queued job as one contact created or updated by email, consent
 * unchecked skips, an API failure is logged and retried once, the submission
 * succeeds either way, and an add-on can take the service over. HubSpot is
 * mocked with pre_http_request.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Integrations\Crm\Services;
use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;

final class CrmHubSpotTest extends TestCase {

	/** @var array[] Requests made to HubSpot. */
	private array $http = array();

	/** @var array[] CRM cron events queued, with their delay in seconds. */
	private array $jobs = array();

	/** @var callable|null Decides the answer: ( method, url, body ) => array( code, body ). */
	private $answer;

	protected function setUp(): void {
		parent::setUp();
		$this->http   = array();
		$this->jobs   = array();
		$this->answer = null;
		delete_option( Connection::optionName( 'hubspot' ) );
		add_filter( 'pre_http_request', array( $this, 'mock' ), 10, 3 );
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_http_request', array( $this, 'mock' ), 10 );
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		remove_all_filters( 'subtleforms/admin/integrations' );
		remove_all_filters( 'subtleforms/crm/services' );
		remove_all_filters( 'subtleforms/crm/extras' );
		remove_all_filters( 'subtleforms/crm/skip_reason' );
		remove_all_filters( 'subtleforms/crm/contact' );
		remove_all_actions( 'subtleforms/crm/delivered' );
		delete_option( Connection::optionName( 'hubspot' ) );
		parent::tearDown();
	}

	public function mock( $pre, $args, $url ) {
		if ( 0 !== strpos( (string) $url, 'https://api.hubapi.com/' ) ) {
			return $pre;
		}
		$body         = isset( $args['body'] ) ? json_decode( (string) $args['body'], true ) : null;
		$this->http[] = array(
			'method' => $args['method'],
			'url'    => $url,
			'body'   => $body,
			'auth'   => $args['headers']['Authorization'] ?? '',
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
		if ( false !== strpos( $url, '/account-info/v3/details' ) ) {
			return array( 200, array( 'portalId' => 4455667, 'companyName' => 'Acme Studio' ) );
		}
		if ( false !== strpos( $url, '/crm/v3/properties/contacts' ) ) {
			return array( 200, array( 'results' => array(
				array( 'name' => 'email', 'label' => 'Email' ),
				array( 'name' => 'jobtitle', 'label' => 'Job title' ),
				array( 'name' => 'lifecyclestage', 'label' => 'Lifecycle stage' ),
				array( 'name' => 'hs_analytics_num_visits', 'label' => 'Number of sessions', 'modificationMetadata' => array( 'readOnlyValue' => true ) ),
				array( 'name' => 'hs_calc', 'label' => 'Calculated', 'calculated' => true ),
			) ) );
		}
		if ( false !== strpos( $url, '/batch/upsert' ) ) {
			$new = empty( $this->knownEmails ) || ! in_array( $body['inputs'][0]['id'] ?? '', $this->knownEmails, true );
			return array( 200, array( 'results' => array( array( 'id' => '9001', 'new' => $new ) ) ) );
		}
		if ( 'POST' === $method && preg_match( '#/crm/v3/objects/contacts$#', $url ) ) {
			return array( 201, array( 'id' => '9002' ) );
		}
		return array( 200, array() );
	}

	/** @var string[] Emails HubSpot already knows in the default answer. */
	private array $knownEmails = array();

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_crm' === $event->hook ) {
			$this->jobs[] = array( 'job' => $event->args[0], 'delay' => (int) $event->timestamp - time() );
			return true;
		}
		return $pre;
	}

	private function token(): string {
		return 'pat-na1-' . str_repeat( 'a1b2', 9 );
	}

	private function conn(): Connection {
		return new Connection( 'hubspot' );
	}

	private function connect( bool $enabled = true ): void {
		$this->conn()->save( $this->token(), array( 'name' => 'Acme Studio' ), $enabled );
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

	private function hubspotForm( array $config = array() ): int {
		$repo   = new FormsRepository();
		$schema = array(
			'metadata'       => array(
				'type'         => 'regular',
				'name'         => 'Contact',
				'title'        => 'Contact',
				'integrations' => array(
					'hubspot' => array_merge(
						array(
							'enabled'    => true,
							'fields'     => array( 'email' => 'email', 'first_name' => 'fname', 'phone' => 'tel', 'company' => 'company' ),
							'properties' => array( array( 'field' => 'role', 'property' => 'jobtitle' ) ),
						),
						$config
					),
				),
			),
			'schema_version' => 1,
			'fields'         => array(
				array( 'id' => 'f1', 'key' => 'fname', 'type' => 'text', 'label' => 'First name' ),
				array( 'id' => 'f2', 'key' => 'email', 'type' => 'email', 'label' => 'Email', 'required' => true ),
				array( 'id' => 'f3', 'key' => 'company', 'type' => 'text', 'label' => 'Company' ),
				array( 'id' => 'f4', 'key' => 'tel', 'type' => 'text', 'label' => 'Phone' ),
				array( 'id' => 'f5', 'key' => 'role', 'type' => 'text', 'label' => 'Role' ),
				array( 'id' => 'f6', 'key' => 'news', 'type' => 'checkbox', 'label' => 'Contact me' ),
			),
		);
		$id = $repo->create( array( 'title' => 'Contact', 'status' => 'published', 'schema' => $schema ) );
		$repo->saveSchemaVersion( $id, $schema, true );
		$this->formIds[] = $id;
		return $id;
	}

	private function lines( int $submissionId ): array {
		$out = array();
		foreach ( ( new LogsRepository() )->findBySubmission( $submissionId ) as $row ) {
			if ( 'hubspot' === ( $row['context']['action_type'] ?? '' ) ) {
				$out[] = $row['message'];
			}
		}
		return $out;
	}

	private function submitAndRun( int $formId, array $data, bool $run = true ): int {
		$res = $this->submit( $formId, $data );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$id = (int) ( $res['data']['data']['submission_id'] ?? $res['data']['submission_id'] ?? 0 );
		$this->assertGreaterThan( 0, $id );
		if ( $run ) {
			foreach ( $this->jobs as $queued ) {
				AsyncDispatcher::executeCrm( $queued['job'] );
			}
		}
		return $id;
	}

	private function answers(): array {
		return array(
			'fname'   => 'Ada',
			'email'   => 'Ada@Example.com',
			'company' => 'Analytical Engines',
			'tel'     => '+44 20 7946 0000',
			'role'    => 'Engineer',
			'news'    => '1',
		);
	}

	// ── REST ────────────────────────────────────────────────────────

	public function test_routes_refuse_visitors_and_people_without_manage_options(): void {
		$routes = array(
			array( 'GET', '/integrations/crm/hubspot' ),
			array( 'DELETE', '/integrations/crm/hubspot' ),
			array( 'POST', '/integrations/crm/hubspot/connect' ),
			array( 'POST', '/integrations/crm/hubspot/test' ),
			array( 'GET', '/integrations/crm/hubspot/properties' ),
		);
		foreach ( array( 0, self::factory_user( 'editor' ) ) as $user ) {
			wp_set_current_user( $user );
			foreach ( $routes as $r ) {
				$res = $this->rest( $r[0], $r[1], array( 'token' => $this->token() ) );
				$this->assertContains( $res->get_status(), array( 401, 403 ), $r[0] . ' ' . $r[1] );
			}
		}
		$this->assertSame( array(), $this->http );
	}

	public function test_connect_saves_the_token_and_never_sends_it_back(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/crm/hubspot/connect', array( 'token' => $this->token() ) );
		$this->assertSame( 200, $res->get_status() );
		$json = wp_json_encode( $res->get_data() );
		$this->assertStringNotContainsString( $this->token(), $json );
		$this->assertStringContainsString( substr( $this->token(), -4 ), $json );
		$this->assertSame( $this->token(), $this->conn()->apiKey() );
		$this->assertSame( 'Bearer ' . $this->token(), $this->http[0]['auth'] );

		// The option is not autoloaded.
		global $wpdb;
		$autoload = $wpdb->get_var( $wpdb->prepare( "SELECT autoload FROM {$wpdb->options} WHERE option_name = %s", Connection::optionName( 'hubspot' ) ) );
		$this->assertContains( $autoload, array( 'no', 'off', 'auto-off' ) );
	}

	public function test_connect_refuses_text_that_is_not_a_token_and_a_token_hubspot_rejects(): void {
		$this->asAdmin();
		$res = $this->rest( 'POST', '/integrations/crm/hubspot/connect', array( 'token' => 'hello world' ) );
		$this->assertSame( 400, $res->get_status() );
		$this->assertSame( array(), $this->http );

		$this->answer = static fn() => array( 401, array( 'message' => 'Authentication credentials not found.' ) );
		$res          = $this->rest( 'POST', '/integrations/crm/hubspot/connect', array( 'token' => $this->token() ) );
		$this->assertSame( 400, $res->get_status() );
		$this->assertFalse( $this->conn()->hasKey() );
	}

	public function test_test_connection_shows_the_portal_name_and_id(): void {
		$this->asAdmin();
		$this->connect();
		$res  = $this->rest( 'POST', '/integrations/crm/hubspot/test' );
		$data = $res->get_data()['data'] ?? $res->get_data();
		$this->assertTrue( $data['ok'] );
		$this->assertStringContainsString( 'Acme Studio', $data['message'] );
		$this->assertStringContainsString( '4455667', $data['message'] );
		$this->assertSame( 'connected', $this->conn()->status() );
	}

	public function test_test_connection_failure_marks_the_connection_and_disconnect_clears_the_token(): void {
		$this->asAdmin();
		$this->connect();
		$this->answer = static fn() => array( 401, array( 'message' => 'bad' ) );
		$data         = $this->rest( 'POST', '/integrations/crm/hubspot/test' )->get_data();
		$data         = $data['data'] ?? $data;
		$this->assertFalse( $data['ok'] );
		$this->assertSame( 'error', $this->conn()->status() );

		$this->rest( 'DELETE', '/integrations/crm/hubspot' );
		$this->assertFalse( $this->conn()->hasKey() );
		$state = wp_json_encode( Services::state( 'hubspot' ) );
		$this->assertStringNotContainsString( $this->token(), $state );
	}

	public function test_properties_lists_only_writable_custom_properties(): void {
		$this->asAdmin();
		$this->connect();
		$data = $this->rest( 'GET', '/integrations/crm/hubspot/properties' )->get_data();
		$list = $data['data'] ?? $data;
		$this->assertSame( array( 'jobtitle', 'lifecyclestage' ), array_column( $list, 'name' ) );
	}

	// ── Sending ─────────────────────────────────────────────────────

	public function test_an_entry_creates_one_contact_by_email(): void {
		$this->connect();
		$formId = $this->hubspotForm();
		$id     = $this->submitAndRun( $formId, $this->answers() );

		$this->assertCount( 1, $this->jobs );
		$this->assertCount( 1, $this->http );
		$call = $this->http[0];
		$this->assertSame( 'POST', $call['method'] );
		$this->assertStringContainsString( '/crm/v3/objects/contacts/batch/upsert', $call['url'] );
		$input = $call['body']['inputs'][0];
		$this->assertSame( 'email', $input['idProperty'] );
		$this->assertSame( 'ada@example.com', $input['id'] );
		$this->assertSame(
			array(
				'email'     => 'ada@example.com',
				'firstname' => 'Ada',
				'phone'     => '+44 20 7946 0000',
				'company'   => 'Analytical Engines',
				'jobtitle'  => 'Engineer',
			),
			$input['properties']
		);
		$this->assertSame( array( 'HubSpot: contact created' ), $this->lines( $id ) );
	}

	public function test_an_existing_contact_is_updated_by_email(): void {
		$this->connect();
		$this->knownEmails = array( 'ada@example.com' );
		$id                = $this->submitAndRun( $this->hubspotForm(), $this->answers() );
		$this->assertSame( array( 'HubSpot: contact updated' ), $this->lines( $id ) );
	}

	public function test_with_update_existing_off_a_known_address_is_left_alone(): void {
		$this->connect();
		$this->answer = static function ( $method, $url ) {
			if ( preg_match( '#/crm/v3/objects/contacts$#', $url ) ) {
				return array( 409, array( 'message' => 'Contact already exists. Existing ID: 8123' ) );
			}
			return array( 200, array() );
		};
		$id = $this->submitAndRun( $this->hubspotForm( array( 'update_existing' => false ) ), $this->answers() );
		$this->assertStringContainsString( '/crm/v3/objects/contacts', $this->http[0]['url'] );
		$this->assertStringNotContainsString( 'batch/upsert', $this->http[0]['url'] );
		$this->assertSame( array( 'HubSpot: skipped (contact already exists)' ), $this->lines( $id ) );
	}

	public function test_consent_unticked_sends_nothing(): void {
		$this->connect();
		$formId = $this->hubspotForm( array( 'consent_field' => 'news' ) );
		$answers = $this->answers();
		unset( $answers['news'] );
		$id = $this->submitAndRun( $formId, $answers );
		$this->assertSame( array(), $this->http );
		$this->assertSame( array( 'HubSpot: skipped (consent not given)' ), $this->lines( $id ) );

		$this->http = array();
		$this->jobs = array();
		$id2        = $this->submitAndRun( $formId, $this->answers() );
		$this->assertCount( 1, $this->http );
		$this->assertSame( array( 'HubSpot: contact created' ), $this->lines( $id2 ) );
	}

	public function test_a_form_with_hubspot_off_or_the_service_off_sends_nothing(): void {
		$this->connect();
		$this->submitAndRun( $this->hubspotForm( array( 'enabled' => false ) ), $this->answers() );
		$this->assertSame( array(), $this->jobs );

		$this->conn()->setEnabled( false );
		$this->submitAndRun( $this->hubspotForm(), $this->answers() );
		$this->assertSame( array(), $this->jobs );
		$this->assertSame( array(), $this->http );
	}

	public function test_an_api_failure_is_logged_retried_once_and_the_submission_still_succeeds(): void {
		$this->connect();
		$this->answer = static fn() => array( 503, array( 'message' => 'Service unavailable' ) );
		$formId       = $this->hubspotForm();

		$id = $this->submitAndRun( $formId, $this->answers() );
		$this->assertGreaterThan( 0, $id, 'The visitor got a saved entry.' );
		$lines = $this->lines( $id );
		$this->assertCount( 1, $lines );
		$this->assertStringContainsString( 'HubSpot: failed:', $lines[0] );
		$this->assertStringContainsString( 'trying again in 2 minutes', $lines[0] );

		// One retry was queued, two minutes out.
		$this->assertCount( 2, $this->jobs );
		$retry = $this->jobs[1];
		$this->assertSame( 1, $retry['job']['retry_count'] );
		$this->assertGreaterThanOrEqual( 100, $retry['delay'] );

		// The retry fails too: logged without a third attempt.
		AsyncDispatcher::executeCrm( $retry['job'] );
		$this->assertCount( 2, $this->http );
		$this->assertCount( 2, $this->jobs, 'No third attempt.' );
		$lines = $this->lines( $id );
		$this->assertCount( 2, $lines );
		$this->assertStringNotContainsString( 'trying again', $lines[1] );
	}

	public function test_a_refusal_that_cannot_succeed_is_not_retried(): void {
		$this->connect();
		$this->answer = static fn() => array( 400, array( 'message' => 'Property values were not valid' ) );
		$id           = $this->submitAndRun( $this->hubspotForm(), $this->answers() );
		$this->assertCount( 1, $this->jobs );
		$this->assertStringContainsString( 'failed', $this->lines( $id )[0] );
	}

	public function test_add_ons_can_change_the_contact_and_hear_about_the_result(): void {
		$this->connect();
		add_filter(
			'subtleforms/crm/contact',
			static function ( $contact ) {
				$contact->properties['lifecyclestage'] = 'lead';
				return $contact;
			}
		);
		$heard = array();
		add_action(
			'subtleforms/crm/delivered',
			static function ( $result, $feed, $context, $service ) use ( &$heard ) {
				$heard = array( $result, $service, $context['form_id'] );
			},
			10,
			4
		);
		$formId = $this->hubspotForm();
		$this->submitAndRun( $formId, $this->answers() );
		$this->assertSame( 'lead', $this->http[0]['body']['inputs'][0]['properties']['lifecyclestage'] );
		$this->assertSame( '9001', $heard[0]['contact_id'] );
		$this->assertSame( 'created', $heard[0]['result'] );
		$this->assertSame( 'hubspot', $heard[1] );
		$this->assertSame( $formId, $heard[2] );
	}

	public function test_an_add_on_that_takes_the_service_over_stops_this_plugin_sending(): void {
		$this->connect();
		add_filter(
			'subtleforms/crm/services',
			static function ( $services ) {
				$services['hubspot']['builtin'] = false;
				return $services;
			}
		);
		$this->assertFalse( Services::coreOwns( 'hubspot' ) );
		$this->submitAndRun( $this->hubspotForm(), $this->answers() );
		$this->assertSame( array(), $this->jobs );
	}

	public function test_an_add_on_that_lists_its_own_crm_entry_takes_the_integration_over(): void {
		$this->assertTrue( \SubtleForms\Integrations\Registry::coreOwnsCrm() );
		add_filter(
			'subtleforms/admin/integrations',
			static function ( $all ) {
				$all['crm'] = array( 'slug' => 'crm', 'label' => 'CRM', 'available' => true );
				return $all;
			}
		);
		$this->assertFalse( \SubtleForms\Integrations\Registry::coreOwnsCrm() );
		$this->assertFalse( Services::coreOwns( 'hubspot' ) );
	}

	public function test_add_ons_add_tiles_and_extras_through_the_filters(): void {
		add_filter(
			'subtleforms/crm/services',
			static function ( $services ) {
				$services['salesforce'] = array( 'slug' => 'salesforce', 'label' => 'Salesforce', 'available' => true, 'enabled' => false, 'configured' => false );
				return $services;
			}
		);
		add_filter( 'subtleforms/crm/extras', static fn( $slugs ) => array_merge( $slugs, array( 'hubspot' ) ) );
		$this->assertSame( array( 'hubspot', 'salesforce' ), array_keys( Services::all() ) );
		$this->assertSame( array( 'hubspot' ), Services::extras() );
		$data = \SubtleForms\Admin\AdminMenu::crm_data();
		$this->assertFalse( $data['banner']['show'], 'The Pro note is hidden while an add-on adds extras.' );
	}

	public function test_the_crm_integration_is_listed_after_email_marketing(): void {
		$all = \SubtleForms\Integrations\Registry::all();
		$this->assertSame( array( 'webhooks', 'email_marketing', 'crm' ), array_slice( array_keys( $all ), 0, 3 ) );
		$this->assertTrue( $all['crm']['builtin'] );
	}
}
