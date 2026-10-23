<?php
// phpcs:disable -- Test file; not shipped in production plugin.
/**
 * Default spam protection and the blocked spam counter (2.6.0).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Analytics\SpamStats;
use SubtleForms\Engine\SpamProtection;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Security\RateLimiter;
use SubtleForms\Support\SpamDefaults;

final class SpamDefault260Test extends TestCase {

	/** @var mixed */
	private $settingsBefore;

	/** @var mixed */
	private $noticeBefore;

	protected function setUp(): void {
		parent::setUp();
		$this->settingsBefore = get_option( 'subtleforms_settings', null );
		$this->noticeBefore   = get_option( SpamDefaults::NOTICE_OPTION, null );
		delete_option( SpamDefaults::UNDO_OPTION );
		SpamStats::maybeInstall();
	}

	protected function tearDown(): void {
		global $wpdb;
		foreach ( $this->formIds as $id ) {
			$wpdb->delete( SpamStats::table(), array( 'form_id' => $id ) );
		}
		null === $this->settingsBefore ? delete_option( 'subtleforms_settings' ) : update_option( 'subtleforms_settings', $this->settingsBefore );
		null === $this->noticeBefore ? delete_option( SpamDefaults::NOTICE_OPTION ) : update_option( SpamDefaults::NOTICE_OPTION, $this->noticeBefore );
		delete_option( SpamDefaults::UNDO_OPTION );
		remove_all_filters( 'pre_http_request' );
		parent::tearDown();
	}

	/** Set site spam settings, keeping the rest. */
	private function siteSettings( array $values ): void {
		$settings = get_option( 'subtleforms_settings', array() );
		update_option( 'subtleforms_settings', array_merge( is_array( $settings ) ? $settings : array(), $values ) );
	}

	/** An admin REST call. */
	private function admin( string $method, string $route, array $body = null, array $params = array() ): array {
		$this->asAdmin();
		$request = new \WP_REST_Request( $method, '/subtleforms/v1' . $route );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}
		if ( null !== $body ) {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( wp_json_encode( $body ) );
		}
		$response = rest_do_request( $request );
		$data     = $response->get_data();
		return array(
			'status' => $response->get_status(),
			'data'   => is_array( $data ) && array_key_exists( 'data', $data ) ? $data['data'] : $data,
		);
	}

	/** The published schema of a form. */
	private function active( int $id ): array {
		wp_cache_flush();
		$schema = ( new FormsRepository() )->loadSchemaVersion( $id );
		return is_array( $schema ) ? ( $schema['schema'] ?? array() ) : array();
	}

	/** A form saved before 2.6.0: published, no spam settings of its own. */
	private function legacyForm(): int {
		return $this->publish( array( array( 'type' => 'text', 'key' => 'name', 'id' => 'name', 'label' => 'Name' ) ) );
	}

	/** A visitor submit with a raw data payload (no time token added). */
	private function rawSubmit( int $formId, array $data ): array {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_param( 'form_id', $formId );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId, 'data' => $data ) ) );
		$response = rest_do_request( $request );
		return array( 'status' => $response->get_status(), 'data' => $response->get_data() );
	}

	private function entries( int $formId ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $formId ) );
	}

	private function reasons( int $formId ): array {
		return SpamStats::summary( 30, $formId )['reasons'];
	}

	private function createViaRest( array $body ): int {
		$res = $this->admin( 'POST', '/forms', $body );
		$this->assertSame( 201, $res['status'], wp_json_encode( $res['data'] ) );
		$id              = (int) $res['data']['id'];
		$this->formIds[] = $id;
		return $id;
	}

	private function schema( string $title, array $metadata = array() ): array {
		return array(
			'metadata'       => array_merge( array( 'type' => 'regular', 'name' => $title, 'title' => $title ), $metadata ),
			'schema_version' => 1,
			'fields'         => array( array( 'type' => 'text', 'key' => 'name', 'id' => 'name', 'label' => 'Name' ) ),
		);
	}

	// ── Defaults for new forms ────────────────────────────────────────────

	public function test_a_form_created_with_a_schema_starts_with_both_traps_on(): void {
		$this->siteSettings( array( 'enable_honeypot' => true, 'min_submission_time' => 3 ) );
		$id = $this->createViaRest( array( 'title' => 'Blank', 'schema' => $this->schema( 'Blank', array( 'template' => 'blank' ) ) ) );

		$this->assertSame( array( 'honeypot' => true, 'timeTrap' => true ), $this->active( $id )['metadata']['spam'] ?? null );
	}

	public function test_a_form_from_a_template_starts_with_both_traps_on(): void {
		$template = \SubtleForms\Templates\FormTemplates::get( 'contact' );
		$schema   = $template['schema'] ?? $template;
		$schema['metadata']['template'] = 'contact';
		$id = $this->createViaRest( array( 'title' => 'From template', 'schema' => $schema ) );

		$spam = $this->active( $id )['metadata']['spam'] ?? null;
		$this->assertTrue( $spam['honeypot'] );
		$this->assertTrue( $spam['timeTrap'] );
	}

	public function test_a_choice_sent_with_the_new_form_is_kept(): void {
		$id = $this->createViaRest( array( 'title' => 'Own choice', 'schema' => $this->schema( 'Own choice', array( 'spam' => array( 'honeypot' => true, 'timeTrap' => false ) ) ) ) );

		$this->assertSame( array( 'honeypot' => true, 'timeTrap' => false ), $this->active( $id )['metadata']['spam'] );
	}

	public function test_a_form_created_without_a_schema_gets_the_defaults_on_its_first_save(): void {
		$id = $this->createViaRest( array( 'title' => 'No schema' ) );

		$res = $this->admin( 'POST', '/forms/' . $id . '/schema', array( 'schema' => $this->schema( 'No schema' ), 'activate' => true ) );
		$this->assertSame( 201, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( array( 'honeypot' => true, 'timeTrap' => true ), $this->active( $id )['metadata']['spam'] );
	}

	public function test_a_save_without_spam_settings_keeps_the_stored_ones(): void {
		$id = $this->createViaRest( array( 'title' => 'Keep', 'schema' => $this->schema( 'Keep', array( 'spam' => array( 'honeypot' => false, 'timeTrap' => true ) ) ) ) );

		$this->admin( 'POST', '/forms/' . $id . '/schema', array( 'schema' => $this->schema( 'Keep' ), 'activate' => true ) );
		$this->assertSame( array( 'honeypot' => false, 'timeTrap' => true ), $this->active( $id )['metadata']['spam'] );
	}

	public function test_new_forms_follow_the_site_defaults(): void {
		$this->siteSettings( array( 'enable_honeypot' => false, 'min_submission_time' => 0 ) );
		$id = $this->createViaRest( array( 'title' => 'Site off', 'schema' => $this->schema( 'Site off' ) ) );

		$this->assertSame( array( 'honeypot' => false, 'timeTrap' => false ), $this->active( $id )['metadata']['spam'] );
	}

	public function test_existing_forms_are_not_changed_and_keep_working_as_before(): void {
		$this->siteSettings( array( 'enable_honeypot' => true, 'min_submission_time' => 0 ) );
		$id = $this->legacyForm();

		// Saving it again from an older client adds nothing.
		$this->admin( 'POST', '/forms/' . $id . '/schema', array( 'schema' => $this->schema( 'WP test' ), 'activate' => true ) );
		$this->assertArrayNotHasKey( 'spam', $this->active( $id )['metadata'] );

		// Old behaviour: the trap field always counted, the time trap followed the site minimum.
		$p = SpamProtection::for_form( $this->active( $id ) );
		$this->assertTrue( $p['honeypot'] );
		$this->assertFalse( $p['timeTrap'] );
		$this->assertFalse( $p['own'] );
	}

	// ── Install and upgrade ───────────────────────────────────────────────

	public function test_a_new_install_turns_the_site_defaults_on_and_never_shows_the_notice(): void {
		update_option( 'subtleforms_settings', array( 'enable_honeypot' => false, 'min_submission_time' => 0 ) );
		SpamDefaults::afterActivate( true );

		$settings = get_option( 'subtleforms_settings' );
		$this->assertTrue( $settings['enable_honeypot'] );
		$this->assertSame( 3, $settings['min_submission_time'] );
		$this->assertSame( 'none', get_option( SpamDefaults::NOTICE_OPTION ) );
		$this->assertNull( SpamDefaults::status()['notice'] );
	}

	public function test_an_update_changes_no_setting_and_offers_the_notice_when_a_form_is_unprotected(): void {
		delete_option( SpamDefaults::NOTICE_OPTION );
		$this->siteSettings( array( 'enable_honeypot' => false, 'min_submission_time' => 0 ) );
		$before = get_option( 'subtleforms_settings' );
		$this->legacyForm();

		SpamDefaults::afterActivate( false );

		$this->assertSame( $before, get_option( 'subtleforms_settings' ), 'an update changes no setting' );
		$status = $this->admin( 'GET', '/spam/protection' );
		$this->assertSame( 'invite', $status['data']['notice'] );
		$this->assertGreaterThanOrEqual( 1, $status['data']['forms_off'] );
	}

	public function test_no_notice_when_every_form_is_already_protected(): void {
		update_option( SpamDefaults::NOTICE_OPTION, 'pending' );
		$this->siteSettings( array( 'enable_honeypot' => true, 'min_submission_time' => 3 ) );
		foreach ( SpamDefaults::formsWithProtectionOff() as $off ) {
			$this->markTestSkipped( 'The test site has unprotected forms of its own: ' . $off );
		}
		$this->legacyForm();
		$this->assertNull( SpamDefaults::status()['notice'] );
	}

	public function test_enable_all_turns_on_both_traps_for_every_form_and_undo_puts_back_exactly_what_was_there(): void {
		update_option( SpamDefaults::NOTICE_OPTION, 'pending' );
		$this->siteSettings( array( 'enable_honeypot' => false, 'min_submission_time' => 0 ) );
		$legacy = $this->legacyForm();
		$own    = $this->createViaRest( array( 'title' => 'Off', 'schema' => $this->schema( 'Off', array( 'spam' => array( 'honeypot' => false, 'timeTrap' => false ) ) ) ) );
		$titleBefore = $this->active( $own )['metadata']['title'];

		$res = $this->admin( 'POST', '/spam/protection/enable-all', array() );
		$this->assertSame( 200, $res['status'] );
		$this->assertGreaterThanOrEqual( 2, $res['data']['changed'] );
		$this->assertSame( 'enabled', $res['data']['notice'] );

		foreach ( array( $legacy, $own ) as $id ) {
			$this->assertSame( array( 'honeypot' => true, 'timeTrap' => true ), $this->active( $id )['metadata']['spam'] );
			$this->assertTrue( SpamProtection::for_form( $this->active( $id ) )['timeTrap'] );
		}
		$this->assertSame( $titleBefore, $this->active( $own )['metadata']['title'], 'nothing else changes' );
		$settings = get_option( 'subtleforms_settings' );
		$this->assertTrue( $settings['enable_honeypot'] );
		$this->assertSame( 3, $settings['min_submission_time'] );
		$this->assertNotContains( $own, SpamDefaults::formsWithProtectionOff() );

		$res = $this->admin( 'POST', '/spam/protection/undo', array() );
		$this->assertSame( 200, $res['status'] );
		$this->assertArrayNotHasKey( 'spam', $this->active( $legacy )['metadata'] );
		$this->assertSame( array( 'honeypot' => false, 'timeTrap' => false ), $this->active( $own )['metadata']['spam'] );
		$settings = get_option( 'subtleforms_settings' );
		$this->assertFalse( $settings['enable_honeypot'] );
		$this->assertSame( 0, $settings['min_submission_time'] );
		$this->assertNull( SpamDefaults::status()['notice'], 'the notice is shown once' );
	}

	public function test_undo_keeps_a_form_changed_again_after_enable_all(): void {
		update_option( SpamDefaults::NOTICE_OPTION, 'pending' );
		$id = $this->createViaRest( array( 'title' => 'Changed', 'schema' => $this->schema( 'Changed', array( 'spam' => array( 'honeypot' => false, 'timeTrap' => false ) ) ) ) );
		SpamDefaults::enableAll();

		$this->admin( 'POST', '/forms/' . $id . '/schema', array( 'schema' => $this->schema( 'Changed', array( 'spam' => array( 'honeypot' => true, 'timeTrap' => false ) ) ), 'activate' => true ) );
		SpamDefaults::undo();

		$this->assertSame( array( 'honeypot' => true, 'timeTrap' => false ), $this->active( $id )['metadata']['spam'] );
	}

	public function test_dismiss_hides_the_notice_for_good(): void {
		update_option( SpamDefaults::NOTICE_OPTION, 'pending' );
		$this->siteSettings( array( 'min_submission_time' => 0 ) );
		$this->legacyForm();

		$this->admin( 'POST', '/spam/protection/dismiss', array() );
		$this->assertSame( 'dismissed', get_option( SpamDefaults::NOTICE_OPTION ) );
		$this->assertNull( $this->admin( 'GET', '/spam/protection' )['data']['notice'] );
	}

	// ── Counting ──────────────────────────────────────────────────────────

	public function test_a_filled_trap_field_is_blocked_quietly_and_counted(): void {
		$id  = $this->legacyForm();
		$res = $this->rawSubmit( $id, array( 'name' => 'Bot', 'website_url' => 'http://spam.example', 'form_rendered_at' => SpamProtection::issue_token( $id, time() - 60 ) ) );

		$this->assertSame( 200, $res['status'] );
		$this->assertTrue( $res['data']['data']['success'] );
		$this->assertSame( 0, $this->entries( $id ) );
		$this->assertSame( 1, $this->reasons( $id )['honeypot'] );
	}

	public function test_a_too_fast_submit_gets_a_fake_success_stores_nothing_and_is_counted(): void {
		$this->siteSettings( array( 'min_submission_time' => 3 ) );
		$id  = $this->legacyForm();
		$res = $this->rawSubmit( $id, array( 'name' => 'Bot', 'form_rendered_at' => SpamProtection::issue_token( $id, time() ) ) );
		$this->rawSubmit( $id, array( 'name' => 'Bot' ) );

		$this->assertSame( 200, $res['status'] );
		$this->assertTrue( $res['data']['data']['success'] );
		$this->assertSame( 0, $this->entries( $id ) );
		$this->assertSame( 2, $this->reasons( $id )['time_trap'], 'too fast and a missing token both count' );
	}

	public function test_a_normal_submit_is_stored_and_not_counted(): void {
		$id  = $this->legacyForm();
		$res = $this->submit( $id, array( 'name' => 'Ada' ) );

		$this->assertSame( 200, $res['status'] );
		$this->assertSame( 1, $this->entries( $id ) );
		$this->assertSame( 0, SpamStats::summary( 30, $id )['total'] );
	}

	public function test_a_form_with_its_traps_switched_off_lets_the_submission_through(): void {
		$id = $this->publish( array( array( 'type' => 'text', 'key' => 'name', 'id' => 'name', 'label' => 'Name' ) ) );
		$repo   = new FormsRepository();
		$schema = $this->active( $id );
		$schema['metadata']['spam'] = array( 'honeypot' => false, 'timeTrap' => false );
		$repo->saveSchemaVersion( $id, $schema, true );

		$this->rawSubmit( $id, array( 'name' => 'Ada', 'website_url' => 'autofilled' ) );
		$this->assertSame( 1, $this->entries( $id ) );
	}

	public function test_a_token_from_a_cached_page_is_refreshed_not_rejected(): void {
		$this->siteSettings( array( 'min_submission_time' => 3 ) );
		$id  = $this->legacyForm();
		$old = SpamProtection::issue_ticket( $id, time() - 2 * DAY_IN_SECONDS );

		// The old token alone is answered with a fresh one, nothing is stored.
		$res = $this->rawSubmit( $id, array( 'name' => 'Ada', 'form_rendered_at' => $old ) );
		$this->assertSame( 409, $res['status'] );
		$this->assertSame( 0, $this->entries( $id ) );
		$this->assertStringStartsWith( 's2.', $res['data']['error']['meta']['spam_token'] );

		// The page trades the old token for a new one over REST, then submits.
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/forms/' . $id . '/spam-token' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'token' => $old ) ) );
		$token = rest_do_request( $request )->get_data()['data']['spam_token'] ?? '';
		$this->assertStringStartsWith( 's2.', $token );

		$this->rawSubmit( $id, array( 'name' => 'Ada', 'form_rendered_at' => $token ) );
		$this->assertSame( 1, $this->entries( $id ) );

		// A token works once.
		$this->rawSubmit( $id, array( 'name' => 'Replay', 'form_rendered_at' => $token ) );
		$this->assertSame( 1, $this->entries( $id ) );
	}

	public function test_nothing_can_be_minted_without_a_valid_token(): void {
		$id = $this->legacyForm();
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/forms/' . $id . '/spam-token' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'token' => 's2.1700000000.' . $id . '.' . str_repeat( 'a', 32 ) ) ) );
		$this->assertSame( 404, rest_do_request( $request )->get_status() );
	}

	public function test_the_public_schema_hands_out_a_fresh_token_on_every_load(): void {
		$id      = $this->legacyForm();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $id . '/schema' );
		wp_set_current_user( 0 );
		$token = rest_do_request( $request )->get_data()['data']['spam_token'] ?? '';

		$this->assertNotNull( SpamProtection::ticket_time( $token, $id ) );
		$this->assertLessThanOrEqual( 2, time() - SpamProtection::ticket_time( $token, $id ) );
	}

	public function test_rate_limited_submits_are_counted_only_for_real_forms(): void {
		$id     = $this->legacyForm();
		wp_set_current_user( 0 );
		$policy = RateLimiter::policy( '/subtleforms/v1/submit', 'POST' );
		$key    = RateLimiter::buildKey( '/subtleforms/v1/submit', 'POST', null, $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0' );
		for ( $i = 0; $i < $policy['limit']; $i++ ) {
			RateLimiter::check( $key, $policy['limit'], $policy['window'] );
		}

		$res = $this->submit( $id, array( 'name' => 'Ada' ) );
		$this->assertSame( 429, $res['status'] );
		$this->assertSame( 1, $this->reasons( $id )['rate_limit'] );

		$this->submit( 999999, array( 'name' => 'Ada' ) );
		$this->assertSame( 0, SpamStats::summary( 30, 999999 )['total'] );
	}

	public function test_a_failed_captcha_is_counted(): void {
		$this->siteSettings(
			array(
				'captcha_enabled'              => true,
				'captcha_provider'             => 'turnstile',
				'captcha_turnstile_enabled'    => true,
				'captcha_turnstile_site_key'   => 'site-' . 'key',
				'captcha_turnstile_secret_key' => 'secret-' . 'key',
			)
		);
		add_filter(
			'pre_http_request',
			static function () {
				return array(
					'headers'  => array(),
					'body'     => wp_json_encode( array( 'success' => false ) ),
					'response' => array( 'code' => 200, 'message' => 'OK' ),
					'cookies'  => array(),
				);
			}
		);
		$id  = $this->legacyForm();
		$res = $this->submit( $id, array( 'name' => 'Ada', 'cf-turnstile-response' => 'bad' ) );

		$this->assertSame( 400, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( 1, $this->reasons( $id )['captcha_failed'] );
	}

	public function test_an_entry_a_rule_stores_as_spam_is_counted(): void {
		$registry = \SubtleForms\Plugin::instance()->container()->get( \SubtleForms\Engine\ActionRegistry::class );
		if ( ! $registry->hasDefinition( 'sf_test_spam_rule' ) ) {
			$registry->registerDefinition( new \SubtleForms\Engine\ActionDefinition( 'sf_test_spam_rule', 'Spam rule', 'Marks the entry spam', array() ) );
			$registry->register( new SpamRuleTestAction() );
		}
		$id = $this->publish(
			array( array( 'type' => 'text', 'key' => 'name', 'id' => 'name', 'label' => 'Name' ) ),
			array( array( 'type' => 'save' ), array( 'type' => 'sf_test_spam_rule' ) )
		);

		$res = $this->submit( $id, array( 'name' => 'Ada' ) );

		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( 1, $this->reasons( $id )['spam_rule'] );
	}

	public function test_counts_are_per_form_day_and_reason_and_hold_no_personal_data(): void {
		global $wpdb;
		$id = $this->legacyForm();
		SpamStats::record( $id, 'honeypot' );
		SpamStats::record( $id, 'honeypot' );
		SpamStats::record( $id, 'time_trap' );
		SpamStats::record( $id, 'made-up-reason' );

		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . SpamStats::table() . ' WHERE form_id = %d ORDER BY reason', $id ), ARRAY_A );
		$this->assertCount( 3, $rows );
		$this->assertSame( array( 'form_id', 'day', 'reason', 'blocked' ), array_keys( $rows[0] ) );
		$this->assertSame( array( 'honeypot' => 2, 'other' => 1, 'time_trap' => 1 ), array_combine( array_column( $rows, 'reason' ), array_map( 'intval', array_column( $rows, 'blocked' ) ) ) );
	}

	public function test_rows_older_than_a_year_are_pruned(): void {
		$id = $this->legacyForm();
		SpamStats::record( $id, 'honeypot', gmdate( 'Y-m-d', time() - 400 * DAY_IN_SECONDS ) );
		SpamStats::record( $id, 'honeypot', gmdate( 'Y-m-d', time() - 300 * DAY_IN_SECONDS ) );
		SpamStats::record( $id, 'honeypot' );

		SpamStats::prune();

		$this->assertSame( 2, SpamStats::summary( 365, $id )['total'] );
		$this->assertNotFalse( wp_next_scheduled( SpamStats::PRUNE_HOOK ) );
	}

	public function test_the_dashboard_summary_has_thirty_days_and_a_total(): void {
		$id = $this->legacyForm();
		SpamStats::record( $id, 'honeypot' );
		SpamStats::record( $id, 'rate_limit', gmdate( 'Y-m-d', time() - 5 * DAY_IN_SECONDS ) );
		SpamStats::record( $id, 'honeypot', gmdate( 'Y-m-d', time() - 40 * DAY_IN_SECONDS ) );

		$res = $this->admin( 'GET', '/spam/stats', null, array( 'days' => 30, 'form_id' => $id ) );
		$this->assertSame( 200, $res['status'] );
		$this->assertSame( 2, $res['data']['total'] );
		$this->assertCount( 30, $res['data']['days'] );
		$this->assertSame( 1, $res['data']['reasons']['honeypot'] );
		$this->assertSame( 1, $res['data']['reasons']['rate_limit'] );
		$this->assertSame( 1, end( $res['data']['days'] )['count'] );
		$this->assertArrayHasKey( 'fallback', $res['data'] );
	}

	public function test_the_endpoints_are_for_site_admins_only(): void {
		$editor = wp_insert_user( array( 'user_login' => 'sf_spam_editor_' . wp_generate_password( 6, false ), 'user_pass' => wp_generate_password(), 'role' => 'editor' ) );
		foreach ( array( array( 'GET', '/spam/stats' ), array( 'GET', '/spam/protection' ), array( 'POST', '/spam/protection/enable-all' ), array( 'POST', '/spam/protection/undo' ), array( 'POST', '/spam/protection/dismiss' ) ) as list( $method, $route ) ) {
			foreach ( array( 0, (int) $editor ) as $user ) {
				wp_set_current_user( $user );
				$request = new \WP_REST_Request( $method, '/subtleforms/v1' . $route );
				$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
				$status = rest_do_request( $request )->get_status();
				$this->assertContains( $status, array( 401, 403 ), "{$method} {$route} as user {$user}" );
			}
		}
		wp_set_current_user( 0 );
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( (int) $editor );
	}

	public function test_uninstall_removes_the_counter_table(): void {
		$source = file_get_contents( dirname( __DIR__, 2 ) . '/src/Support/Uninstaller.php' );
		// Every table that starts with the plugin prefix is dropped.
		$this->assertStringContainsString( "esc_like( \$wpdb->prefix . 'subtleforms_' )", $source );
		$this->assertStringStartsWith( $GLOBALS['wpdb']->prefix . 'subtleforms_', SpamStats::table() );
	}
}

/**
 * A pipeline action standing in for an add-on spam rule.
 */
final class SpamRuleTestAction implements \SubtleForms\Contracts\ActionInterface {
	public function id(): string {
		return 'sf_test_spam_rule';
	}
	public function handle( \SubtleForms\Engine\SubmissionContext $context ): void {
		( new \SubtleForms\Repositories\SubmissionsRepository() )->update( (int) $context->getMeta( 'submission_id' ), array( 'status' => 'spam' ) );
	}
	public function label(): string {
		return 'Spam rule';
	}
	public function validate(): bool {
		return true;
	}
}
