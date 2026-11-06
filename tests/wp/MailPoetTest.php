<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * MailPoet as the fourth email marketing service: a plugin on the same site,
 * reached through its PHP API. The states of the connection (derived, never
 * stored), the people added with MailPoet's options, a person MailPoet
 * already has, the rule that unsubscribed and bounced people are never
 * subscribed again, and a MailPoet refusal that must not break a submission.
 *
 * `\MailPoet\API\API` is a stand-in (tests/wp/fixtures/MailPoetFake.php),
 * defined only when the real plugin is not loaded.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/fixtures/MailPoetFake.php';

use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Integrations\EmailMarketing\MailPoetStatus;
use SubtleForms\Integrations\EmailMarketing\Services;
use SubtleForms\Integrations\EmailMarketing\Subscriber;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;

final class MailPoetTest extends TestCase {

	/** @var MailPoetV1Fake */
	private $mp;

	/** @var array[] Cron events queued for the email marketing job. */
	private array $jobs = array();

	/** @var array[] The `skipped` action, as it fired. */
	private array $skipped = array();

	protected function setUp(): void {
		parent::setUp();
		if ( ! MailPoetV1Fake::active() ) {
			$this->markTestSkipped( 'The real MailPoet is loaded; the stand-in API is not used.' );
		}
		$this->mp                 = new MailPoetV1Fake();
		\MailPoet\API\API::$v1    = $this->mp;
		MailPoetStatus::$probe    = null;
		$this->jobs               = array();
		$this->skipped            = array();
		delete_option( Connection::optionName( 'mailpoet' ) );
		( new Connection( 'mailpoet' ) )->setEnabled( true );
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
		add_action( 'subtleforms/email/marketing/skipped', array( $this, 'onSkipped' ), 10, 5 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		remove_action( 'subtleforms/email/marketing/skipped', array( $this, 'onSkipped' ), 10 );
		remove_all_filters( 'subtleforms/email/marketing/subscriber' );
		MailPoetStatus::$probe = null;
		if ( class_exists( '\MailPoet\API\API', false ) ) {
			\MailPoet\API\API::$v1 = null;
		}
		delete_option( Connection::optionName( 'mailpoet' ) );
		parent::tearDown();
	}

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_email_marketing' === $event->hook ) {
			$this->jobs[] = $event->args[0];
			return true;
		}
		return $pre;
	}

	public function onSkipped( $message, $reason, $feed, $context, $service ): void {
		$this->skipped[] = array( 'message' => $message, 'reason' => $reason, 'service' => $service );
	}

	/** MailPoet looked at as the site would show it. */
	private function probe( ?object $api, bool $installed ): void {
		MailPoetStatus::$probe = static fn() => array( 'api' => $api, 'installed' => $installed );
	}

	private function form( array $config = array() ): int {
		$repo   = new FormsRepository();
		$schema = array(
			'metadata'       => array(
				'type'         => 'regular',
				'name'         => 'Newsletter',
				'title'        => 'Newsletter',
				'integrations' => array(
					'mailpoet' => array_merge(
						array(
							'enabled'      => true,
							'list_id'      => '1',
							'fields'       => array( 'email' => 'email', 'first_name' => 'fname', 'last_name' => 'lname' ),
							'merge_fields' => array( array( 'field' => 'company', 'target' => 'cf_1' ) ),
						),
						$config
					),
				),
			),
			'schema_version' => 1,
			'fields'         => array(
				array( 'id' => 'f1', 'key' => 'fname', 'type' => 'text', 'label' => 'First name' ),
				array( 'id' => 'f5', 'key' => 'lname', 'type' => 'text', 'label' => 'Last name' ),
				array( 'id' => 'f2', 'key' => 'email', 'type' => 'email', 'label' => 'Email', 'required' => true ),
				array( 'id' => 'f3', 'key' => 'company', 'type' => 'text', 'label' => 'Company' ),
				array( 'id' => 'f4', 'key' => 'news', 'type' => 'checkbox', 'label' => 'Send me news' ),
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
			if ( 'mailpoet' === ( $row['context']['action_type'] ?? '' ) ) {
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

	private function rest( string $method, string $route, array $params = array() ) {
		$request = new \WP_REST_Request( $method, '/subtleforms/v1' . $route );
		foreach ( $params as $k => $v ) {
			$request->set_param( $k, $v );
		}
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		return rest_do_request( $request );
	}

	private const PERSON = array( 'fname' => 'Ada', 'lname' => 'Lovelace', 'email' => 'Ada@Example.com', 'company' => 'Engines' );

	// ── States ──────────────────────────────────────────────────────

	public function test_not_installed(): void {
		$this->asAdmin();
		$this->probe( null, false );
		$this->assertSame( 'not_installed', MailPoetStatus::state() );
		$this->assertFalse( MailPoetStatus::ready() );

		$state = Services::state( 'mailpoet' );
		$this->assertFalse( $state['connected'] );
		$this->assertSame( 'none', $state['status'] );
		$this->assertSame( 'not_installed', $state['local']['state'] );
		$this->assertSame( admin_url( 'plugin-install.php?s=mailpoet&tab=search&type=term' ), $state['local']['install_url'] );
		$this->assertSame( '', $state['local']['activate_url'] );

		$all = Services::all();
		$this->assertTrue( $all['mailpoet']['enabled'], 'the switch still works without MailPoet' );
		$this->assertFalse( $all['mailpoet']['configured'] );
		$this->assertSame( 'not_installed', $all['mailpoet']['local_state'] );
	}

	public function test_a_user_who_may_not_install_gets_no_install_link(): void {
		wp_set_current_user( self::factory_user( 'editor' ) );
		$this->probe( null, false );
		$local = MailPoetStatus::describe();
		$this->assertSame( '', $local['install_url'] );
		$this->assertFalse( $local['can_install'] );
	}

	public function test_installed_but_not_active_offers_activation_with_the_core_nonce(): void {
		$this->asAdmin();
		$this->probe( null, true );
		$this->assertSame( 'inactive', MailPoetStatus::state() );
		$url = MailPoetStatus::describe()['activate_url'];
		$this->assertNotSame( '', $url );
		// The client puts this in an href as is, so it must not hold HTML entities.
		$this->assertStringNotContainsString( '&amp;', $url );
		$parts = wp_parse_url( $url );
		parse_str( $parts['query'], $query );
		$this->assertStringEndsWith( '/wp-admin/plugins.php', $parts['path'] );
		$this->assertSame( 'activate', $query['action'] );
		$this->assertSame( 'mailpoet/mailpoet.php', $query['plugin'] );
		$this->assertNotFalse( wp_verify_nonce( $query['_wpnonce'], 'activate-plugin_mailpoet/mailpoet.php' ) );
	}

	public function test_a_user_who_may_not_activate_gets_no_activation_link(): void {
		wp_set_current_user( self::factory_user( 'editor' ) );
		$this->probe( null, true );
		$local = MailPoetStatus::describe();
		$this->assertSame( 'inactive', $local['state'] );
		$this->assertSame( '', $local['activate_url'] );
	}

	public function test_active_but_setup_not_finished(): void {
		$this->asAdmin();
		$this->mp->setupComplete = false;
		$this->assertSame( 'setup', MailPoetStatus::state() );
		$local = MailPoetStatus::describe();
		$this->assertTrue( $local['active'] );
		$this->assertFalse( $local['setup_complete'] );
		$this->assertSame( admin_url( 'admin.php?page=mailpoet-welcome-wizard' ), $local['setup_url'] );
		$this->assertFalse( Services::state( 'mailpoet' )['connected'] );
	}

	public function test_a_mailpoet_without_the_api_methods_needs_an_update(): void {
		$this->asAdmin();
		$old = new class() {
			public function getLists() {
				return array();
			}
		};
		$this->probe( $old, true );
		$this->assertSame( 'outdated', MailPoetStatus::state() );
		$this->assertNull( MailPoetStatus::api() );
		$this->assertSame( admin_url( 'plugins.php' ), MailPoetStatus::describe()['update_url'] );
	}

	public function test_active_and_set_up_is_connected_and_links_to_the_lists(): void {
		$this->asAdmin();
		$this->assertSame( 'ready', MailPoetStatus::state() );
		$state = Services::state( 'mailpoet' );
		$this->assertTrue( $state['connected'] );
		$this->assertSame( 'connected', $state['status'] );
		$this->assertSame( admin_url( 'admin.php?page=mailpoet-lists' ), $state['local']['manage_url'] );
		$this->assertTrue( Services::all()['mailpoet']['configured'] );
		$this->assertTrue( \SubtleForms\Integrations\Registry::all()['email_marketing']['configured'] );
	}

	public function test_nothing_about_the_connection_is_stored(): void {
		$stored = get_option( Connection::optionName( 'mailpoet' ) );
		$this->assertSame( '', $stored['api_key'] ?? '' );
		$this->assertSame( 'connected', Services::status( 'mailpoet' ) );
		$this->mp->setupComplete = false;
		$this->assertSame( 'none', Services::status( 'mailpoet' ), 'the status follows MailPoet, not a saved value' );
	}

	// ── Routes ──────────────────────────────────────────────────────

	public function test_there_is_no_key_to_connect_test_or_disconnect(): void {
		$this->asAdmin();
		foreach ( array(
			array( 'POST', '/integrations/email-marketing/mailpoet/connect', array( 'api_key' => 'abc' ) ),
			array( 'POST', '/integrations/email-marketing/mailpoet/test', array() ),
			array( 'DELETE', '/integrations/email-marketing/mailpoet', array() ),
		) as $call ) {
			$res = $this->rest( $call[0], $call[1], $call[2] );
			$this->assertSame( 400, $res->get_status(), $call[0] . ' ' . $call[1] );
			$this->assertSame( 'subtleforms_email_marketing_local', $res->get_data()['error']['code'] );
		}
		$this->assertSame( array(), $this->mp->called( 'addSubscriber' ) );
	}

	public function test_the_lists_and_custom_fields_come_from_mailpoet(): void {
		$this->asAdmin();
		$lists = $this->rest( 'GET', '/integrations/email-marketing/mailpoet/lists' );
		$this->assertSame( 200, $lists->get_status() );
		$this->assertSame(
			array(
				array( 'id' => '1', 'name' => 'Newsletter', 'count' => null ),
				array( 'id' => '2', 'name' => 'Customers', 'count' => null ),
			),
			$lists->get_data()['data']
		);

		$fields = $this->rest( 'GET', '/integrations/email-marketing/mailpoet/fields' );
		$this->assertSame( 200, $fields->get_status() );
		$tags = array_column( $fields->get_data()['data'], 'tag' );
		$this->assertSame( array( 'cf_1', 'cf_2' ), $tags, 'email and the names have their own rows' );
		$this->assertTrue( $fields->get_data()['data'][1]['required'] );
	}

	public function test_the_lists_say_why_when_mailpoet_is_not_ready(): void {
		$this->asAdmin();
		$this->probe( null, true );
		$res = $this->rest( 'GET', '/integrations/email-marketing/mailpoet/lists' );
		$this->assertSame( 400, $res->get_status() );
		$this->assertStringContainsString( 'MailPoet is not active on this site', $res->get_data()['error']['message'] );
	}

	// ── Sending ─────────────────────────────────────────────────────

	public function test_a_new_person_is_added_to_the_list_with_mailpoets_options(): void {
		$form = $this->form();
		$id   = $this->submitAndRun( $form, self::PERSON );

		$this->assertCount( 1, $this->jobs );
		$add = $this->mp->called( 'addSubscriber' );
		$this->assertCount( 1, $add );
		list( $data, $lists, $options ) = $add[0]['args'];
		$this->assertSame( 'ada@example.com', $data['email'] );
		$this->assertSame( 'Ada', $data['first_name'] );
		$this->assertSame( 'Lovelace', $data['last_name'] );
		$this->assertSame( 'Engines', $data['cf_1'], 'custom field ids are kept as MailPoet writes them' );
		$this->assertSame( array( 1 ), $lists );
		$this->assertSame( array( 'send_confirmation_email' => true, 'schedule_welcome_email' => false ), $options );
		$this->assertSame( array(), $this->mp->called( 'subscribeToLists' ) );
		$this->assertSame( array( 'MailPoet: subscribed' ), $this->lines( $id ) );
	}

	public function test_the_two_email_options_follow_the_form_settings(): void {
		$form = $this->form( array( 'send_confirmation_email' => false, 'schedule_welcome_email' => true ) );
		$this->submitAndRun( $form, self::PERSON );
		$options = $this->mp->called( 'addSubscriber' )[0]['args'][2];
		$this->assertSame( array( 'send_confirmation_email' => false, 'schedule_welcome_email' => true ), $options );
	}

	public function test_a_person_who_must_confirm_is_logged_as_pending(): void {
		$this->mp->unconfirmedForNew = 1;
		$id = $this->submitAndRun( $this->form(), self::PERSON );
		$this->assertSame( array( 'MailPoet: pending (double opt-in)' ), $this->lines( $id ) );
	}

	public function test_a_person_mailpoet_already_has_is_added_to_the_list(): void {
		$this->mp->subscribers['ada@example.com'] = array( 'id' => '55', 'email' => 'ada@example.com', 'status' => 'subscribed', 'subscriptions' => array( array( 'segment_id' => '2', 'status' => 'subscribed' ) ) );
		$id = $this->submitAndRun( $this->form(), self::PERSON );

		$this->assertSame( array(), $this->mp->called( 'addSubscriber' ), 'nothing fails with "already exists"' );
		$join = $this->mp->called( 'subscribeToLists' );
		$this->assertCount( 1, $join );
		$this->assertSame( '55', $join[0]['args'][0] );
		$this->assertSame( array( 1 ), $join[0]['args'][1] );
		$this->assertSame( array( 'MailPoet: updated' ), $this->lines( $id ) );
		$this->assertSame( array(), $this->skipped );
	}

	public function test_someone_who_unsubscribed_is_not_subscribed_again(): void {
		$this->mp->subscribers['ada@example.com'] = array( 'id' => '55', 'email' => 'ada@example.com', 'status' => 'unsubscribed', 'subscriptions' => array() );
		$id = $this->submitAndRun( $this->form(), self::PERSON );

		$this->assertSame( array(), $this->mp->called( 'subscribeToLists' ) );
		$this->assertSame( array(), $this->mp->called( 'addSubscriber' ) );
		$this->assertSame( array( 'Skipped: previously unsubscribed in MailPoet' ), $this->lines( $id ) );
		$this->assertCount( 1, $this->skipped );
		$this->assertSame( 'previously_unsubscribed', $this->skipped[0]['reason'] );
		$this->assertSame( 'mailpoet', $this->skipped[0]['service'] );
	}

	public function test_someone_who_unsubscribed_from_this_list_only_is_not_subscribed_again(): void {
		$this->mp->subscribers['ada@example.com'] = array( 'id' => '55', 'email' => 'ada@example.com', 'status' => 'subscribed', 'subscriptions' => array( array( 'segment_id' => '1', 'status' => 'unsubscribed' ) ) );
		$id = $this->submitAndRun( $this->form(), self::PERSON );

		$this->assertSame( array(), $this->mp->called( 'subscribeToLists' ) );
		$this->assertSame( array( 'Skipped: previously unsubscribed in MailPoet' ), $this->lines( $id ) );
	}

	public function test_someone_whose_address_bounced_is_not_subscribed_again(): void {
		$this->mp->subscribers['ada@example.com'] = array( 'id' => '55', 'email' => 'ada@example.com', 'status' => 'bounced', 'subscriptions' => array() );
		$id = $this->submitAndRun( $this->form(), self::PERSON );

		$this->assertSame( array(), $this->mp->called( 'subscribeToLists' ) );
		$this->assertSame( array( 'Skipped: email bounced in MailPoet' ), $this->lines( $id ) );
		$this->assertSame( 'bounced', $this->skipped[0]['reason'] );
	}

	public function test_a_mailpoet_refusal_is_logged_and_the_submission_still_succeeds(): void {
		$form = $this->form( array( 'list_id' => '9' ) );
		$id   = $this->submitAndRun( $form, self::PERSON ); // submitAndRun asserts the 200.

		$lines = $this->lines( $id );
		$this->assertCount( 1, $lines );
		$this->assertSame( "MailPoet: failed: List with ID '9' does not exist.", $lines[0] );
		$this->assertCount( 1, $this->jobs, 'a local call is never retried' );
	}

	public function test_anything_else_that_goes_wrong_is_caught_too(): void {
		$this->mp->failWith = new \RuntimeException( 'database is gone' );
		$id                 = $this->submitAndRun( $this->form(), self::PERSON );
		$this->assertSame( array( 'MailPoet: failed: database is gone' ), $this->lines( $id ) );
		$this->assertCount( 1, $this->jobs );
	}

	public function test_nothing_is_added_when_consent_is_not_given(): void {
		$form = $this->form( array( 'consent_field' => 'news' ) );
		$id   = $this->submitAndRun( $form, self::PERSON );
		$this->assertSame( array(), $this->mp->called( 'addSubscriber' ) );
		$this->assertSame( array( 'MailPoet: skipped (consent not given)' ), $this->lines( $id ) );

		$this->jobs = array();
		$this->submitAndRun( $form, self::PERSON + array( 'news' => true ) );
		$this->assertCount( 1, $this->mp->called( 'addSubscriber' ) );
	}

	public function test_an_entry_is_skipped_with_the_reason_while_mailpoet_is_not_active(): void {
		$form = $this->form();
		$this->probe( null, true );
		$id = $this->submitAndRun( $form, self::PERSON );
		$this->assertSame( array( 'MailPoet: skipped (MailPoet is not active on this site)' ), $this->lines( $id ) );
		$this->assertSame( array(), $this->mp->called( 'addSubscriber' ) );
	}

	public function test_nothing_is_queued_while_the_switch_is_off(): void {
		( new Connection( 'mailpoet' ) )->setEnabled( false );
		$res = $this->submit( $this->form(), self::PERSON );
		$this->assertSame( 200, $res['status'] );
		$this->assertSame( array(), $this->jobs );
		$this->assertSame( array(), $this->mp->called( 'addSubscriber' ) );
	}

	public function test_tags_an_add_on_supplies_are_applied_when_this_mailpoet_can_tag(): void {
		add_filter(
			'subtleforms/email/marketing/subscriber',
			static function ( $sub ) {
				$sub->tags = array( 'website' );
				return $sub;
			}
		);
		$this->submitAndRun( $this->form(), self::PERSON );
		$tagged = $this->mp->called( 'tagSubscriber' );
		$this->assertCount( 1, $tagged );
		$this->assertSame( array( 'ada@example.com', 'website' ), $tagged[0]['args'] );
	}

	public function test_mapping_targets_keep_their_case_for_mailpoet(): void {
		$config = Subscriber::normalize( array( 'merge_fields' => array( array( 'field' => 'company', 'target' => 'cf_1' ) ) ), 'mailpoet' );
		$this->assertSame( 'cf_1', $config['merge_fields'][0]['target'] );
		$config = Subscriber::normalize( array( 'merge_fields' => array( array( 'field' => 'company', 'target' => 'cf_1' ) ) ), 'mailchimp' );
		$this->assertSame( 'CF_1', $config['merge_fields'][0]['target'] );
	}

	public function test_the_confirmation_email_defaults_on_and_the_welcome_email_off(): void {
		$config = Subscriber::normalize( array(), 'mailpoet' );
		$this->assertTrue( $config['send_confirmation_email'] );
		$this->assertFalse( $config['schedule_welcome_email'] );
		$this->assertTrue( $config['update_existing'], 'a known person is always added to the list' );
	}
}
