<?php
/**
 * Email marketing (Mailchimp, Brevo, Kit): request building, consent gate,
 * double opt-in, key masking, a service switched off keeping its settings,
 * and the hand-over to an add-on that lists its own service.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Integrations\EmailMarketing\BrevoClient;
use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Integrations\EmailMarketing\KitClient;
use SubtleForms\Integrations\EmailMarketing\MailchimpClient;
use SubtleForms\Integrations\EmailMarketing\ServiceException;
use SubtleForms\Integrations\EmailMarketing\Services;
use SubtleForms\Integrations\EmailMarketing\Subscriber;
use SubtleForms\Integrations\Registry;

final class EmailMarketingTest extends TestCase {

	/** Built from parts so no key-shaped string sits in the repository. */
	private function key(): string {
		return str_repeat( 'a1', 8 ) . '-' . 'us21';
	}

	protected function tearDown(): void {
		unset(
			$GLOBALS['sf_test_filters']['subtleforms/admin/integrations'],
			$GLOBALS['sf_test_filters']['subtleforms/email/marketing/services'],
			$GLOBALS['sf_test_options']['subtleforms_mailchimp_connection'],
			$GLOBALS['sf_test_options']['subtleforms_brevo_connection'],
			$GLOBALS['sf_test_options']['subtleforms_kit_connection']
		);
		parent::tearDown();
	}

	private function schema(): array {
		return array(
			'fields' => array(
				array( 'type' => 'name_group', 'key' => 'name', 'label' => 'Name' ),
				array( 'type' => 'email', 'key' => 'email', 'label' => 'Email' ),
				array( 'type' => 'text', 'key' => 'company', 'label' => 'Company' ),
				array( 'type' => 'checkbox', 'key' => 'news', 'label' => 'Send me news' ),
			),
		);
	}

	private function config( array $extra = array() ): array {
		return array_merge(
			array(
				'enabled'      => true,
				'list_id'      => 'abc123',
				'fields'       => array( 'email' => 'email', 'first_name' => 'name.first_name', 'last_name' => 'name.last_name' ),
				'merge_fields' => array( array( 'field' => 'company', 'target' => 'company' ) ),
				'tags'         => 'website, lead , website',
			),
			$extra
		);
	}

	private function payload( array $extra = array() ): array {
		return array_merge(
			array(
				'name'    => array( 'first_name' => 'Ada', 'last_name' => 'Lovelace' ),
				'email'   => ' Ada@Example.COM ',
				'company' => 'Analytical Engines',
				'news'    => true,
			),
			$extra
		);
	}

	public function test_subscriber_hash_is_the_md5_of_the_lowercase_email(): void {
		$this->assertSame( md5( 'ada@example.com' ), MailchimpClient::subscriberHash( '  Ada@Example.COM ' ) );
	}

	public function test_base_url_comes_from_the_key_data_center(): void {
		$this->assertSame( 'https://us21.api.mailchimp.com/3.0', ( new MailchimpClient( $this->key() ) )->baseUrl() );
	}

	public function test_a_key_without_a_data_center_is_refused(): void {
		$this->expectException( ServiceException::class );
		( new MailchimpClient( 'nodatacenter' ) )->baseUrl();
	}

	public function test_key_shape_check(): void {
		$this->assertTrue( MailchimpClient::looksLikeKey( $this->key() ) );
		$this->assertFalse( MailchimpClient::looksLikeKey( 'abc' ) );
		$this->assertFalse( MailchimpClient::looksLikeKey( 'abcdefgh12345678' ) );
		$this->assertFalse( MailchimpClient::looksLikeKey( 'abcdefgh12345678-us21/evil' ) );
	}

	public function test_upsert_request_uses_put_by_hash_with_status_if_new(): void {
		$built = Subscriber::build( $this->config(), $this->schema(), $this->payload() );
		$sub   = $built['subscriber'];
		$req   = ( new MailchimpClient( $this->key() ) )->upsertRequest( $sub );

		$this->assertSame( 'PUT', $req['method'] );
		$this->assertSame( 'https://us21.api.mailchimp.com/3.0/lists/abc123/members/' . md5( 'ada@example.com' ) . '?skip_merge_validation=true', $req['url'] );
		$this->assertSame( 'ada@example.com', $req['body']['email_address'] );
		$this->assertSame( 'subscribed', $req['body']['status_if_new'] );
		$this->assertArrayNotHasKey( 'status', $req['body'] );
		$this->assertSame( 'Ada', $req['body']['merge_fields']['FNAME'] );
		$this->assertSame( 'Lovelace', $req['body']['merge_fields']['LNAME'] );
		$this->assertSame( 'Analytical Engines', $req['body']['merge_fields']['COMPANY'] );
		$this->assertStringStartsWith( 'Basic ', $req['headers']['Authorization'] );
		$this->assertSame( 'subtleforms:' . $this->key(), base64_decode( substr( $req['headers']['Authorization'], 6 ) ) );
	}

	public function test_double_opt_in_makes_new_contacts_pending(): void {
		$built = Subscriber::build( $this->config( array( 'double_optin' => true ) ), $this->schema(), $this->payload() );
		$req   = ( new MailchimpClient( $this->key() ) )->upsertRequest( $built['subscriber'] );
		$this->assertSame( 'pending', $req['body']['status_if_new'] );
	}

	public function test_tags_are_cleaned_and_sent_to_the_tags_endpoint(): void {
		$built = Subscriber::build( $this->config(), $this->schema(), $this->payload() );
		$this->assertSame( array( 'website', 'lead' ), $built['subscriber']->tags );

		$req = ( new MailchimpClient( $this->key() ) )->tagsRequest( $built['subscriber'] );
		$this->assertSame( 'POST', $req['method'] );
		$this->assertStringEndsWith( '/members/' . md5( 'ada@example.com' ) . '/tags', $req['url'] );
		$this->assertSame(
			array(
				array( 'name' => 'website', 'status' => 'active' ),
				array( 'name' => 'lead', 'status' => 'active' ),
			),
			$req['body']['tags']
		);
	}

	public function test_a_tag_is_cut_at_one_hundred_characters(): void {
		$this->assertSame( array( str_repeat( 'x', 100 ) ), Subscriber::parseTags( str_repeat( 'x', 150 ) ) );
	}

	public function test_merge_fields_with_no_answer_are_left_out(): void {
		$built = Subscriber::build( $this->config(), $this->schema(), $this->payload( array( 'company' => '' ) ) );
		$req   = ( new MailchimpClient( $this->key() ) )->upsertRequest( $built['subscriber'] );
		$this->assertArrayNotHasKey( 'COMPANY', $req['body']['merge_fields'] );
	}

	public function test_consent_gate_skips_when_the_box_is_not_ticked(): void {
		$config = $this->config( array( 'consent_field' => 'news' ) );
		$built  = Subscriber::build( $config, $this->schema(), $this->payload( array( 'news' => false ) ) );
		$this->assertNull( $built['subscriber'] );
		$this->assertSame( 'consent_not_given', $built['skip'] );

		$built = Subscriber::build( $config, $this->schema(), $this->payload( array( 'news' => '' ) ) );
		$this->assertSame( 'consent_not_given', $built['skip'] );

		$built = Subscriber::build( $config, $this->schema(), $this->payload( array( 'news' => true ) ) );
		$this->assertNotNull( $built['subscriber'] );
	}

	public function test_without_a_consent_field_everyone_is_added(): void {
		$built = Subscriber::build( $this->config(), $this->schema(), $this->payload( array( 'news' => false ) ) );
		$this->assertNotNull( $built['subscriber'] );
	}

	public function test_an_entry_without_a_valid_email_is_skipped(): void {
		$built = Subscriber::build( $this->config(), $this->schema(), $this->payload( array( 'email' => 'nope' ) ) );
		$this->assertNull( $built['subscriber'] );
		$this->assertSame( 'no_email', $built['skip'] );
	}

	public function test_email_is_found_without_a_mapping(): void {
		$built = Subscriber::build( array( 'enabled' => true, 'list_id' => 'abc123' ), $this->schema(), $this->payload() );
		$this->assertSame( 'ada@example.com', $built['subscriber']->email );
		$this->assertSame( 'Ada', $built['subscriber']->firstName );
	}

	public function test_update_existing_is_on_unless_switched_off(): void {
		$this->assertTrue( Subscriber::normalize( array() )['update_existing'] );
		$this->assertTrue( Subscriber::normalize( array( 'update_existing' => true ) )['update_existing'] );
		$this->assertFalse( Subscriber::normalize( array( 'update_existing' => false ) )['update_existing'] );
		$built = Subscriber::build( $this->config( array( 'update_existing' => false ) ), $this->schema(), $this->payload() );
		$this->assertFalse( $built['subscriber']->updateExisting );
	}

	public function test_error_messages_are_plain(): void {
		$this->assertSame( 'Mailchimp did not accept this API key.', ( new MailchimpClient( $this->key() ) )->errorMessage( 401, array() ) );
		$this->assertStringContainsString( 'Bad merge value', ( new MailchimpClient( $this->key() ) )->errorMessage( 400, array( 'title' => 'Invalid Resource', 'detail' => 'Bad merge value' ) ) );
		$this->assertStringContainsString( '500', ( new MailchimpClient( $this->key() ) )->errorMessage( 500, array() ) );
	}

	// ── Brevo ───────────────────────────────────────────────────────

	private function brevoKey(): string {
		return 'xkeysib-' . str_repeat( 'c3', 12 );
	}

	private function brevoSub( array $extra = array() ) {
		$config = $this->config( array( 'list_id' => '7', 'tags' => '' ) + $extra );
		$config['merge_fields'] = array( array( 'field' => 'company', 'target' => 'company' ) );
		return Subscriber::build( $config, $this->schema(), $this->payload(), 'brevo' )['subscriber'];
	}

	public function test_brevo_key_shape(): void {
		$this->assertTrue( BrevoClient::looksLikeKey( $this->brevoKey() ) );
		$this->assertFalse( BrevoClient::looksLikeKey( 'xsmtpsib-' . str_repeat( 'c3', 12 ) ) );
		$this->assertFalse( BrevoClient::looksLikeKey( 'abc' ) );
	}

	public function test_brevo_upsert_is_a_post_with_update_enabled_and_upper_case_attributes(): void {
		$req = ( new BrevoClient( $this->brevoKey() ) )->upsertRequest( $this->brevoSub() );
		$this->assertSame( 'POST', $req['method'] );
		$this->assertSame( 'https://api.brevo.com/v3/contacts', $req['url'] );
		$this->assertSame( $this->brevoKey(), $req['headers']['api-key'] );
		$this->assertSame( 'ada@example.com', $req['body']['email'] );
		$this->assertTrue( $req['body']['updateEnabled'], 'an existing contact is updated, not refused' );
		$this->assertSame( array( 7 ), $req['body']['listIds'] );
		$this->assertSame( 'Ada', $req['body']['attributes']['FIRSTNAME'] );
		$this->assertSame( 'Lovelace', $req['body']['attributes']['LASTNAME'] );
		$this->assertSame( 'Analytical Engines', $req['body']['attributes']['COMPANY'] );
	}

	public function test_brevo_double_opt_in_request_carries_the_template_and_redirect(): void {
		$client = new BrevoClient( $this->brevoKey(), 10, array( 'doi_template_id' => 12, 'doi_redirect_url' => 'https://example.com/thanks' ) );
		$req    = $client->doubleOptInRequest( $this->brevoSub( array( 'double_optin' => true ) ) );
		$this->assertSame( 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation', $req['url'] );
		$this->assertSame( 12, $req['body']['templateId'] );
		$this->assertSame( 'https://example.com/thanks', $req['body']['redirectionUrl'] );
		$this->assertSame( array( 7 ), $req['body']['includeListIds'] );
		$this->assertSame( 'ada@example.com', $req['body']['email'] );
	}

	public function test_brevo_double_opt_in_without_a_template_refuses_before_any_request(): void {
		$this->expectException( ServiceException::class );
		( new BrevoClient( $this->brevoKey() ) )->subscribe( $this->brevoSub( array( 'double_optin' => true ) ) );
	}

	public function test_brevo_list_ids_must_be_numbers(): void {
		$config = $this->config( array( 'list_id' => 'abc123' ) );
		$sub    = Subscriber::build( $config, $this->schema(), $this->payload(), 'brevo' )['subscriber'];
		$this->expectException( ServiceException::class );
		( new BrevoClient( $this->brevoKey() ) )->subscribe( $sub );
	}

	public function test_brevo_consent_gate_applies_the_same_way(): void {
		$config = $this->config( array( 'consent_field' => 'news' ) );
		$built  = Subscriber::build( $config, $this->schema(), $this->payload( array( 'news' => false ) ), 'brevo' );
		$this->assertNull( $built['subscriber'] );
		$this->assertSame( 'consent_not_given', $built['skip'] );
	}

	// ── Kit ─────────────────────────────────────────────────────────

	private function kitKey(): string {
		return 'kit_' . str_repeat( 'd4', 10 );
	}

	private function kitSub( array $extra = array(), array $config = array() ) {
		$config = $this->config( array( 'list_id' => '99', 'tags' => 'Website, Lead' ) + $extra );
		$config['merge_fields'] = $config['merge_fields'] ?? array();
		$config['merge_fields'] = array( array( 'field' => 'company', 'target' => 'Company' ) );
		return Subscriber::build( $config, $this->schema(), $this->payload(), 'kit' )['subscriber'];
	}

	public function test_kit_key_shape(): void {
		$this->assertTrue( KitClient::looksLikeKey( $this->kitKey() ) );
		$this->assertFalse( KitClient::looksLikeKey( 'short' ) );
		$this->assertFalse( KitClient::looksLikeKey( 'has spaces in the middle of it' ) );
	}

	public function test_kit_create_request_is_an_upsert_with_the_key_header(): void {
		$req = ( new KitClient( $this->kitKey() ) )->createRequest( $this->kitSub() );
		$this->assertSame( 'POST', $req['method'] );
		$this->assertSame( 'https://api.kit.com/v4/subscribers', $req['url'] );
		$this->assertSame( $this->kitKey(), $req['headers']['X-Kit-Api-Key'] );
		$this->assertSame( 'ada@example.com', $req['body']['email_address'] );
		$this->assertSame( 'Ada', $req['body']['first_name'] );
		$fields = (array) $req['body']['fields'];
		$this->assertSame( 'Analytical Engines', $fields['Company'], 'a Kit custom field keeps the case it was typed in' );
	}

	public function test_kit_last_name_goes_to_a_custom_field_only_when_mapped_by_hand(): void {
		$sub = $this->kitSub();
		$this->assertTrue( $sub->lastNameMapped );
		$req = ( new KitClient( $this->kitKey() ) )->createRequest( $sub );
		$this->assertSame( 'Lovelace', ( (array) $req['body']['fields'] )['last_name'] );

		$config = $this->config( array( 'list_id' => '99' ) );
		unset( $config['fields']['last_name'] );
		$sub = Subscriber::build( $config, $this->schema(), $this->payload(), 'kit' )['subscriber'];
		$this->assertFalse( $sub->lastNameMapped );
		$req = ( new KitClient( $this->kitKey() ) )->createRequest( $sub );
		$this->assertArrayNotHasKey( 'last_name', (array) ( $req['body']['fields'] ?? array() ) );
	}

	public function test_kit_form_and_tag_requests(): void {
		$client = new KitClient( $this->kitKey() );
		$sub    = $this->kitSub();
		$form   = $client->formRequest( $sub );
		$this->assertSame( 'https://api.kit.com/v4/forms/99/subscribers', $form['url'] );
		$this->assertSame( array( 'email_address' => 'ada@example.com' ), $form['body'] );

		$create = $client->tagCreateRequest( 'Website' );
		$this->assertSame( 'https://api.kit.com/v4/tags', $create['url'] );
		$this->assertSame( array( 'name' => 'Website' ), $create['body'] );

		$tag = $client->tagRequest( '55', 'ada@example.com' );
		$this->assertSame( 'https://api.kit.com/v4/tags/55/subscribers', $tag['url'] );
	}

	// ── Services ────────────────────────────────────────────────────

	public function test_the_four_services_are_defined_and_only_mailchimp_needs_a_list(): void {
		$this->assertSame( array( 'mailchimp', 'brevo', 'kit', 'mailpoet' ), Services::slugs() );
		$defs = Services::definitions();
		$this->assertTrue( $defs['mailchimp']['list_required'] );
		$this->assertFalse( $defs['brevo']['list_required'] );
		$this->assertFalse( $defs['kit']['list_required'] );
		$this->assertInstanceOf( BrevoClient::class, Services::client( 'brevo', $this->brevoKey() ) );
		$this->expectException( ServiceException::class );
		Services::client( 'nope', 'x' );
	}

	// ── Key masking and keeping settings ────────────────────────────

	public function test_state_never_holds_the_key_for_any_service(): void {
		$keys = array(
			'mailchimp' => $this->key(),
			'brevo'     => $this->brevoKey(),
			'kit'       => $this->kitKey(),
		);
		foreach ( $keys as $slug => $key ) {
			$GLOBALS['sf_test_options'][ Connection::optionName( $slug ) ] = array(
				'api_key'      => $key,
				'account_name' => 'Acme',
				'status'       => 'connected',
				'enabled'      => true,
				'settings'     => array( 'doi_template_id' => 4 ),
			);
			$state = ( new Connection( $slug ) )->state();
			$this->assertTrue( $state['has_key'] );
			$this->assertSame( substr( $key, -4 ), $state['last4'] );
			$this->assertSame( 'connected', $state['status'] );
			$this->assertStringNotContainsString( $key, (string) wp_json_encode( $state ) );
			$this->assertArrayNotHasKey( 'api_key', $state );
		}
		$this->assertStringNotContainsString( 'a1a1a1a1', (string) wp_json_encode( Services::all() ) );
	}

	public function test_a_switched_off_service_keeps_its_key_and_settings(): void {
		$GLOBALS['sf_test_options']['subtleforms_brevo_connection'] = array(
			'api_key'  => $this->brevoKey(),
			'status'   => 'connected',
			'enabled'  => false,
			'settings' => array( 'doi_template_id' => 4 ),
		);
		$brevo = new Connection( 'brevo' );
		$this->assertFalse( $brevo->isEnabled() );
		$this->assertFalse( $brevo->isActive(), 'off means nothing is sent' );
		$this->assertTrue( $brevo->hasKey(), 'the key is still there' );
		$this->assertSame( array( 'doi_template_id' => 4 ), $brevo->settings() );
		$this->assertTrue( Services::all()['brevo']['configured'] );
		$this->assertFalse( Services::all()['brevo']['enabled'] );
	}

	public function test_status_is_none_without_a_key_and_error_after_a_failed_check(): void {
		$mailchimp = new Connection( 'mailchimp' );
		$this->assertSame( 'none', $mailchimp->status() );
		$GLOBALS['sf_test_options']['subtleforms_mailchimp_connection'] = array( 'api_key' => $this->key(), 'status' => 'error', 'error' => 'No' );
		$this->assertSame( 'error', $mailchimp->status() );
	}

	public function test_each_service_has_its_own_option(): void {
		$this->assertSame( 'subtleforms_mailchimp_connection', Connection::optionName( 'mailchimp' ) );
		$this->assertSame( 'subtleforms_brevo_connection', Connection::optionName( 'brevo' ) );
		$this->assertSame( 'subtleforms_kit_connection', Connection::optionName( 'kit' ) );
	}

	// ── Hand-over ───────────────────────────────────────────────────

	public function test_the_plugin_owns_email_marketing_and_each_service_by_default(): void {
		$all = Registry::all();
		$this->assertTrue( $all['email_marketing']['builtin'] );
		$this->assertArrayNotHasKey( 'mailchimp', $all, 'no stand-alone Mailchimp entry' );
		$this->assertTrue( Registry::coreOwnsEmailMarketing() );
		foreach ( Services::slugs() as $slug ) {
			$this->assertTrue( Services::coreOwns( $slug ), $slug );
		}
	}

	public function test_an_add_on_that_lists_its_own_email_marketing_takes_the_whole_integration(): void {
		$GLOBALS['sf_test_filters']['subtleforms/admin/integrations'] = static function ( $list ) {
			$list['email_marketing'] = array( 'slug' => 'email_marketing', 'label' => 'Email marketing', 'available' => true );
			return $list;
		};
		$this->assertFalse( Registry::coreOwnsEmailMarketing() );
		foreach ( Services::slugs() as $slug ) {
			$this->assertFalse( Services::coreOwns( $slug ), $slug . ' is sent by the add-on only' );
		}
	}

	public function test_an_add_on_that_removes_the_entry_switches_everything_off(): void {
		$GLOBALS['sf_test_filters']['subtleforms/admin/integrations'] = static function ( $list ) {
			unset( $list['email_marketing'] );
			return $list;
		};
		$this->assertFalse( Registry::coreOwnsEmailMarketing() );
	}

	public function test_an_add_on_that_lists_one_service_takes_only_that_service(): void {
		$GLOBALS['sf_test_filters']['subtleforms/email/marketing/services'] = static function ( $list ) {
			$list['brevo'] = array( 'slug' => 'brevo', 'label' => 'Brevo', 'available' => true );
			return $list;
		};
		$this->assertFalse( Services::coreOwns( 'brevo' ) );
		$this->assertTrue( Services::coreOwns( 'mailchimp' ) );
		$this->assertTrue( Services::coreOwns( 'kit' ) );
	}

	public function test_an_add_on_that_keeps_builtin_does_not_take_a_service_over(): void {
		$GLOBALS['sf_test_filters']['subtleforms/email/marketing/services'] = static function ( $list ) {
			$list['kit']['label'] = 'Kit (renamed)';
			return $list;
		};
		$this->assertTrue( Services::coreOwns( 'kit' ) );
	}

	public function test_other_add_on_entries_do_not_take_it_over(): void {
		$GLOBALS['sf_test_filters']['subtleforms/admin/integrations'] = static function ( $list ) {
			$list['crm'] = array( 'slug' => 'crm', 'label' => 'CRM' );
			return $list;
		};
		$this->assertTrue( Registry::coreOwnsEmailMarketing() );
	}
}
