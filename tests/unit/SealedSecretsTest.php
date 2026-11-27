<?php
/**
 * 2.12.0: API keys and secrets are stored sealed, in the same format as Pro.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Api\FormsApi;
use SubtleForms\Api\SettingsApi;
use SubtleForms\Integrations\EmailMarketing\Connection;
use SubtleForms\Support\Captcha\FieldCaptcha;
use SubtleForms\Support\SchemaSecrets;
use SubtleForms\Support\SecretBox;
use SubtleForms\Support\SettingsSecrets;

require_once __DIR__ . '/fixtures/secret-stubs.php';

final class SealedSecretsTest extends TestCase {

	/** Built from parts so no key-shaped string sits in the repository. */
	private function secret(): string {
		return 'sec' . str_repeat( 'x9', 6 ) . 'ret';
	}

	/** Pro's derivation and format, copied from SubtleFormsPro SecretBox. */
	private function proSeal( string $plain ): string {
		$key    = sodium_crypto_generichash( 'subtleforms-pro|' . wp_salt( 'auth' ) . wp_salt( 'secure_auth' ), '', SODIUM_CRYPTO_SECRETBOX_KEYBYTES );
		$nonce  = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		return 'sfs1:' . base64_encode( $nonce . sodium_crypto_secretbox( $plain, $nonce, $key ) );
	}

	private function proOpen( string $stored ): string {
		$key   = sodium_crypto_generichash( 'subtleforms-pro|' . wp_salt( 'auth' ) . wp_salt( 'secure_auth' ), '', SODIUM_CRYPTO_SECRETBOX_KEYBYTES );
		$raw   = base64_decode( substr( $stored, 5 ), true );
		$n     = SODIUM_CRYPTO_SECRETBOX_NONCEBYTES;
		return (string) sodium_crypto_secretbox_open( substr( $raw, $n ), substr( $raw, 0, $n ), $key );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['sf_test_options']['subtleforms_brevo_connection'], $GLOBALS['subtleforms_test_transients'] );
		parent::tearDown();
	}

	public function test_seal_and_open_round_trip(): void {
		$sealed = SecretBox::seal( $this->secret() );
		$this->assertStringStartsWith( 'sfs1:', $sealed );
		$this->assertStringNotContainsString( $this->secret(), $sealed );
		$this->assertSame( $this->secret(), SecretBox::open( $sealed ) );
	}

	public function test_a_value_sealed_by_pro_opens_here_and_the_other_way_round(): void {
		$this->assertSame( $this->secret(), SecretBox::open( $this->proSeal( $this->secret() ) ) );
		$this->assertSame( $this->secret(), $this->proOpen( SecretBox::seal( $this->secret() ) ) );
	}

	public function test_plain_values_pass_through_and_without_libsodium_nothing_is_sealed(): void {
		$this->assertSame( '', SecretBox::seal( '' ) );
		$this->assertSame( $this->secret(), SecretBox::open( $this->secret() ) );
		if ( ! SecretBox::available() ) {
			$this->assertSame( $this->secret(), SecretBox::seal( $this->secret() ) );
		}
		$this->assertTrue( true );
	}

	public function test_settings_secrets_are_opened_and_sealed_on_the_way(): void {
		$stored = array( 'captcha_hcaptcha_secret_key' => SecretBox::seal( $this->secret() ), 'sender_name' => 'Shop' );
		$read   = SettingsSecrets::open( $stored );
		$this->assertSame( $this->secret(), $read['captcha_hcaptcha_secret_key'] );
		$this->assertSame( 'Shop', $read['sender_name'] );

		$legacy = SettingsSecrets::seal( array( 'ext_webhooks_signing_secret' => $this->secret() ) );
		$this->assertTrue( SecretBox::isSealed( $legacy['ext_webhooks_signing_secret'] ) );
		$this->assertSame( $this->secret(), SecretBox::open( $legacy['ext_webhooks_signing_secret'] ) );
	}

	public function test_a_plain_legacy_connection_key_works_and_is_resaved_sealed(): void {
		$GLOBALS['sf_test_options']['subtleforms_brevo_connection'] = array( 'api_key' => $this->secret(), 'status' => 'connected', 'enabled' => true );
		$connection = new Connection( 'brevo' );
		$this->assertSame( $this->secret(), $connection->apiKey() );
		$stored = $GLOBALS['sf_test_options']['subtleforms_brevo_connection']['api_key'];
		$this->assertTrue( SecretBox::isSealed( $stored ) );
		$this->assertStringNotContainsString( $this->secret(), $stored );
		$this->assertSame( $this->secret(), ( new Connection( 'brevo' ) )->apiKey(), 'the sealed value reads back' );
	}

	public function test_a_connection_key_sealed_by_pro_reads_here(): void {
		$GLOBALS['sf_test_options']['subtleforms_brevo_connection'] = array( 'api_key' => $this->proSeal( $this->secret() ), 'status' => 'connected', 'enabled' => true );
		$this->assertSame( $this->secret(), ( new Connection( 'brevo' ) )->apiKey() );
	}

	public function test_an_unreadable_connection_key_is_missing_and_says_so(): void {
		$GLOBALS['sf_test_options']['subtleforms_brevo_connection'] = array( 'api_key' => 'sfs1:' . base64_encode( str_repeat( 'z', 60 ) ), 'status' => 'connected', 'enabled' => true );
		$connection = new Connection( 'brevo' );
		$this->assertSame( '', $connection->apiKey() );
		$this->assertFalse( $connection->hasKey() );
		$this->assertFalse( $connection->isActive() );
		$state = $connection->state();
		$this->assertFalse( $state['has_key'] );
		$this->assertSame( 'error', $state['status'] );
		$this->assertSame( 'Your API key could not be read. Please enter it again.', $state['error'] );
	}

	public function test_an_unreadable_settings_secret_reads_as_missing(): void {
		$read = SettingsSecrets::open( array( 'captcha_turnstile_secret_key' => 'sfs1:' . base64_encode( str_repeat( 'z', 60 ) ) ) );
		$this->assertSame( '', $read['captcha_turnstile_secret_key'] );
		$this->assertContains( 'captcha_turnstile_secret_key', SettingsSecrets::unreadableKeys() );
	}

	/** Pro's SecretSettings::encrypt(), copied: AES-256-GCM, key from secure_auth, iv + tag + cipher. */
	private function proEncrypt( string $plain ): string {
		$key    = hash( 'sha256', wp_salt( 'secure_auth' ) . '|subtleforms-pro-secrets', true );
		$iv     = random_bytes( 12 );
		$tag    = '';
		$cipher = openssl_encrypt( $plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag );
		return 'sfenc:v1:' . base64_encode( $iv . $tag . $cipher );
	}

	public function test_a_signing_secret_pro_encrypted_opens_here_and_signs_the_same_with_or_without_pro(): void {
		$body   = '{"a":1}';
		$stored = array( 'ext_webhooks_signing_secret' => $this->proEncrypt( $this->secret() ) );

		// Pro inactive: Free opens Pro's value itself.
		$read = SettingsSecrets::open( $stored );
		$this->assertSame( $this->secret(), $read['ext_webhooks_signing_secret'] );
		$this->assertSame( 'sha256=' . hash_hmac( 'sha256', $body, $this->secret() ), \SubtleForms\Support\Webhooks::signature( $body, $read['ext_webhooks_signing_secret'] ) );

		// Pro active: Free's read comes first, so Pro's own filter gets the plain value and keeps it.
		$again = SettingsSecrets::open( SettingsSecrets::open( $stored ) );
		$this->assertSame( $this->secret(), $again['ext_webhooks_signing_secret'] );

		// Free saves a Pro value as it is, and a plain one sealed.
		$this->assertSame( $stored['ext_webhooks_signing_secret'], SettingsSecrets::seal( $stored )['ext_webhooks_signing_secret'] );
		$this->assertTrue( SecretBox::isSealed( SettingsSecrets::seal( array( 'ext_webhooks_signing_secret' => $this->secret() ) )['ext_webhooks_signing_secret'] ) );
	}

	public function test_a_pro_value_that_cannot_be_opened_is_missing(): void {
		$this->assertSame( '', SettingsSecrets::open( array( 'ext_webhooks_signing_secret' => 'sfenc:v1:AAAA' ) )['ext_webhooks_signing_secret'] );
	}

	public function test_a_field_secret_key_is_sealed_on_save_and_opened_for_checking(): void {
		$schema = array(
			'fields' => array(
				array( 'type' => 'hcaptcha', 'secret_key' => $this->secret(), 'site_key' => 'site' ),
				array( 'type' => 'group', 'children' => array( array( 'type' => 'turnstile', 'config' => array( 'secret_key' => $this->secret() ) ) ) ),
				array( 'type' => 'columns', 'columns' => array( array( 'fields' => array( array( 'type' => 'recaptcha', 'secret_key' => $this->secret() ) ) ) ) ),
			),
		);
		$sealed = SchemaSecrets::seal( $schema );
		$this->assertStringNotContainsString( $this->secret(), (string) wp_json_encode( $sealed ) );
		$this->assertSame( 'site', $sealed['fields'][0]['site_key'] );
		$this->assertSame( $sealed, SchemaSecrets::seal( $sealed ), 'sealing twice changes nothing' );

		$resolved = FieldCaptcha::resolve( $sealed['fields'][0] );
		$this->assertSame( $this->secret(), $resolved['secret'] );
		$legacy = FieldCaptcha::resolve( $schema['fields'][0] );
		$this->assertSame( $this->secret(), $legacy['secret'], 'a plain value saved before 2.12.0 still works' );
	}

	private function storedSchema(): array {
		return array(
			'fields' => array(
				array( 'id' => 'f1', 'type' => 'hcaptcha', 'site_key' => 'site', 'secret_key' => SecretBox::seal( $this->secret() ) ),
				array( 'id' => 'f2', 'type' => 'group', 'children' => array( array( 'id' => 'f3', 'type' => 'turnstile', 'config' => array( 'secret_key' => SecretBox::seal( $this->secret() ) ) ) ) ),
			),
		);
	}

	public function test_the_builder_payload_has_no_secret_only_a_flag(): void {
		$stored = $this->storedSchema();
		$hidden = SchemaSecrets::hide( $stored );
		$out    = (string) wp_json_encode( $hidden );
		$this->assertStringNotContainsString( 'sfs1:', $out );
		$this->assertStringNotContainsString( $this->secret(), $out );
		$this->assertSame( '', $hidden['fields'][0]['secret_key'] );
		$this->assertTrue( $hidden['fields'][0]['secret_key_set'] );
		$this->assertTrue( $hidden['fields'][1]['children'][0]['config']['secret_key_set'] );

		// GET /forms/{id}: the row's published schema and its draft text.
		$row = SchemaSecrets::hideInRow( array( 'id' => 1, 'config' => $stored, 'draft_schema' => (string) wp_json_encode( $stored ) ) );
		$this->assertStringNotContainsString( 'sfs1:', (string) wp_json_encode( $row ) );
		$this->assertStringContainsString( 'secret_key_set', $row['draft_schema'] );
	}

	public function test_saving_with_an_empty_secret_key_keeps_the_stored_one(): void {
		$stored = $this->storedSchema();
		$sent   = SchemaSecrets::hide( $stored );
		$sent['fields'][0]['site_key'] = 'new-site';
		$saved = SchemaSecrets::seal( SchemaSecrets::keep( $sent, $stored ) );
		$this->assertSame( $stored['fields'][0]['secret_key'], $saved['fields'][0]['secret_key'] );
		$this->assertSame( $stored['fields'][1]['children'][0]['config']['secret_key'], $saved['fields'][1]['children'][0]['config']['secret_key'] );
		$this->assertSame( 'new-site', $saved['fields'][0]['site_key'] );
		$this->assertArrayNotHasKey( 'secret_key_set', $saved['fields'][0] );
	}

	public function test_saving_with_a_new_secret_key_replaces_it_sealed(): void {
		$stored = $this->storedSchema();
		$sent   = SchemaSecrets::hide( $stored );
		$new    = 'new' . str_repeat( 'q7', 5 );
		$sent['fields'][0]['secret_key'] = $new;
		$saved = SchemaSecrets::seal( SchemaSecrets::keep( $sent, $stored ) );
		$this->assertTrue( SecretBox::isSealed( $saved['fields'][0]['secret_key'] ) );
		$this->assertSame( $new, SecretBox::open( $saved['fields'][0]['secret_key'] ) );
		$this->assertSame( $this->secret(), SecretBox::open( $saved['fields'][1]['children'][0]['config']['secret_key'] ) );
	}

	public function test_an_export_never_holds_a_field_secret_key(): void {
		$schema = array( 'fields' => array( array( 'type' => 'hcaptcha', 'secret_key' => SecretBox::seal( $this->secret() ), 'site_key' => 'site', 'config' => array( 'secret_key' => $this->secret() ) ) ) );
		$out    = (string) wp_json_encode( SchemaSecrets::strip( $schema ) );
		$this->assertStringNotContainsString( 'secret_key', $out );
		$this->assertStringNotContainsString( $this->secret(), $out );
		$this->assertStringContainsString( 'site', $out );
	}

	public function test_no_visitor_facing_schema_holds_a_field_secret_key(): void {
		// The REST schema route, the inline data on the page, the shortcode and the block all
		// print FormsApi::publicPayload(), which is buildPublicSchema() then filterPublicSchema().
		$schema = array(
			'fields' => array(
				array( 'type' => 'hcaptcha', 'secret_key' => $this->secret() ),
				array( 'type' => 'group', 'children' => array( array( 'type' => 'turnstile', 'config' => array( 'secret_key' => SecretBox::seal( $this->secret() ) ) ) ) ),
				array( 'type' => 'columns', 'columns' => array( array( 'fields' => array( array( 'type' => 'recaptcha', 'secret_key' => $this->secret() ) ) ), array( array( 'type' => 'hcaptcha', 'secret_key' => $this->secret() ) ) ) ),
			),
		);
		$api    = ( new \ReflectionClass( FormsApi::class ) )->newInstanceWithoutConstructor();
		$build  = new \ReflectionMethod( FormsApi::class, 'buildPublicSchema' );
		$build->setAccessible( true );
		$public = FormsApi::filterPublicSchema( $build->invoke( $api, $schema ), 1 );
		$out    = (string) wp_json_encode( $public );
		$this->assertStringNotContainsString( 'secret_key', $out );
		$this->assertStringNotContainsString( $this->secret(), $out );
		$this->assertStringNotContainsString( 'sfs1:', $out );
	}

	public function test_rest_answers_never_hold_a_secret(): void {
		$out = SettingsApi::maskSecrets(
			array(
				'captcha_recaptcha_secret_key' => $this->secret(),
				'captcha_hcaptcha_secret_key'  => '',
				'ext_webhooks_signing_secret'  => $this->secret(),
				'sender_name'                  => 'Shop',
			)
		);
		$this->assertStringNotContainsString( $this->secret(), (string) wp_json_encode( $out ) );
		$this->assertSame( SettingsApi::SECRET_MASK, $out['captcha_recaptcha_secret_key'] );
		$this->assertSame( '', $out['captcha_hcaptcha_secret_key'] );

		$GLOBALS['sf_test_options']['subtleforms_brevo_connection'] = array( 'api_key' => $this->secret(), 'status' => 'connected' );
		$this->assertStringNotContainsString( $this->secret(), (string) wp_json_encode( ( new Connection( 'brevo' ) )->state() ) );
	}
}
