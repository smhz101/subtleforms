<?php
/**
 * Mailchimp integration: request building, consent gate, double opt-in, key
 * masking and the hand-over to an add-on that lists its own Mailchimp.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Integrations\Mailchimp\Client;
use SubtleForms\Integrations\Mailchimp\Connection;
use SubtleForms\Integrations\Mailchimp\MailchimpException;
use SubtleForms\Integrations\Mailchimp\Subscriber;
use SubtleForms\Integrations\Registry;

final class MailchimpTest extends TestCase {

	/** Built from parts so no key-shaped string sits in the repository. */
	private function key(): string {
		return str_repeat( 'a1', 8 ) . '-' . 'us21';
	}

	protected function tearDown(): void {
		unset( $GLOBALS['sf_test_filters']['subtleforms/admin/integrations'], $GLOBALS['sf_test_options']['subtleforms_mailchimp_connection'] );
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
		$this->assertSame( md5( 'ada@example.com' ), Client::subscriberHash( '  Ada@Example.COM ' ) );
	}

	public function test_base_url_comes_from_the_key_data_center(): void {
		$this->assertSame( 'https://us21.api.mailchimp.com/3.0', ( new Client( $this->key() ) )->baseUrl() );
	}

	public function test_a_key_without_a_data_center_is_refused(): void {
		$this->expectException( MailchimpException::class );
		( new Client( 'nodatacenter' ) )->baseUrl();
	}

	public function test_key_shape_check(): void {
		$this->assertTrue( Client::looksLikeKey( $this->key() ) );
		$this->assertFalse( Client::looksLikeKey( 'abc' ) );
		$this->assertFalse( Client::looksLikeKey( 'abcdefgh12345678' ) );
		$this->assertFalse( Client::looksLikeKey( 'abcdefgh12345678-us21/evil' ) );
	}

	public function test_upsert_request_uses_put_by_hash_with_status_if_new(): void {
		$built = Subscriber::build( $this->config(), $this->schema(), $this->payload() );
		$sub   = $built['subscriber'];
		$req   = ( new Client( $this->key() ) )->upsertRequest( $sub );

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
		$req   = ( new Client( $this->key() ) )->upsertRequest( $built['subscriber'] );
		$this->assertSame( 'pending', $req['body']['status_if_new'] );
	}

	public function test_tags_are_cleaned_and_sent_to_the_tags_endpoint(): void {
		$built = Subscriber::build( $this->config(), $this->schema(), $this->payload() );
		$this->assertSame( array( 'website', 'lead' ), $built['subscriber']->tags );

		$req = ( new Client( $this->key() ) )->tagsRequest( $built['subscriber'] );
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
		$req   = ( new Client( $this->key() ) )->upsertRequest( $built['subscriber'] );
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
		$this->assertSame( 'Mailchimp did not accept this API key.', Client::errorMessage( 401, array() ) );
		$this->assertStringContainsString( 'Bad merge value', Client::errorMessage( 400, array( 'title' => 'Invalid Resource', 'detail' => 'Bad merge value' ) ) );
		$this->assertStringContainsString( '500', Client::errorMessage( 500, array() ) );
	}

	// ── Key masking ─────────────────────────────────────────────────

	public function test_state_never_holds_the_key(): void {
		$GLOBALS['sf_test_options']['subtleforms_mailchimp_connection'] = array(
			'api_key'       => $this->key(),
			'account_name'  => 'Acme',
			'account_email' => 'owner@example.com',
			'status'        => 'connected',
		);
		$state = Connection::state();
		$this->assertTrue( $state['has_key'] );
		$this->assertSame( 'us21', $state['last4'] );
		$this->assertSame( 'connected', $state['status'] );
		$this->assertStringNotContainsString( $this->key(), (string) wp_json_encode( $state ) );
		$this->assertStringNotContainsString( 'a1a1a1a1', (string) wp_json_encode( $state ) );
	}

	public function test_status_is_none_without_a_key_and_error_after_a_failed_check(): void {
		$this->assertSame( 'none', Connection::status() );
		$GLOBALS['sf_test_options']['subtleforms_mailchimp_connection'] = array( 'api_key' => $this->key(), 'status' => 'error', 'error' => 'No' );
		$this->assertSame( 'error', Connection::status() );
	}

	// ── Hand-over ───────────────────────────────────────────────────

	public function test_the_plugin_owns_mailchimp_by_default(): void {
		$all = Registry::all();
		$this->assertTrue( $all['mailchimp']['builtin'] );
		$this->assertTrue( Registry::coreOwnsMailchimp() );
	}

	public function test_an_add_on_that_lists_its_own_mailchimp_takes_it_over(): void {
		$GLOBALS['sf_test_filters']['subtleforms/admin/integrations'] = static function ( $list ) {
			$list['mailchimp'] = array( 'slug' => 'mailchimp', 'label' => 'Mailchimp', 'available' => true );
			return $list;
		};
		$this->assertFalse( Registry::coreOwnsMailchimp() );
	}

	public function test_an_add_on_that_removes_the_entry_switches_it_off(): void {
		$GLOBALS['sf_test_filters']['subtleforms/admin/integrations'] = static function ( $list ) {
			unset( $list['mailchimp'] );
			return $list;
		};
		$this->assertFalse( Registry::coreOwnsMailchimp() );
	}

	public function test_other_add_on_entries_do_not_take_it_over(): void {
		$GLOBALS['sf_test_filters']['subtleforms/admin/integrations'] = static function ( $list ) {
			$list['crm'] = array( 'slug' => 'crm', 'label' => 'CRM' );
			return $list;
		};
		$this->assertTrue( Registry::coreOwnsMailchimp() );
	}
}
