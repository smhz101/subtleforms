<?php
/**
 * 2.12.0: API keys and secrets are stored sealed, in the same format as Pro.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Api\SettingsApi;
use SubtleForms\Integrations\EmailMarketing\Connection;
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

	public function test_a_secret_pro_encrypted_is_left_for_pro_or_dropped_without_it(): void {
		$pro = array( 'ext_webhooks_signing_secret' => 'sfenc:v1:AAAA' );
		$this->assertSame( 'sfenc:v1:AAAA', SettingsSecrets::open( $pro )['ext_webhooks_signing_secret'] );
		$this->assertSame( 'sfenc:v1:AAAA', SettingsSecrets::seal( $pro )['ext_webhooks_signing_secret'] );
		$this->assertSame( '', SettingsSecrets::dropUnopened( $pro )['ext_webhooks_signing_secret'] );
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
