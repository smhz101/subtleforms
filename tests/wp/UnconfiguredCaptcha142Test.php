<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.9.2 (#142): a CAPTCHA field with no keys is skipped on submit, and its
 * setup message is for site admins only.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Support\Captcha\FieldCaptcha;

final class UnconfiguredCaptcha142Test extends TestCase {

	/** @return array<string, array{0: string, 1: string}> */
	public static function providers(): array {
		return array(
			'reCAPTCHA' => array( 'recaptcha', 'g-recaptcha-response' ),
			'hCaptcha'  => array( 'hcaptcha', 'h-captcha-response' ),
			'Turnstile' => array( 'turnstile', 'cf-turnstile-response' ),
		);
	}

	private function formWithCaptcha( string $type, array $config = array() ): int {
		return $this->publish(
			array(
				array( 'id' => 'name', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ),
				array( 'id' => 'cap', 'key' => 'cap', 'type' => $type, 'config' => $config ),
			)
		);
	}

	private function entryCount( int $formId ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $formId ) );
	}

	/** First CAPTCHA field of a public payload. */
	private function captchaConfig( int $formId ): array {
		$container = \SubtleForms\Plugin::instance()->container();
		$repo      = $container->get( \SubtleForms\Repositories\FormsRepository::class );
		$api       = new \SubtleForms\Api\FormsApi(
			$repo,
			$container->get( \SubtleForms\Repositories\SubmissionsRepository::class ),
			$container->get( \SubtleForms\Support\FeatureGate::class ),
			$container->has( \SubtleForms\Support\Settings::class ) ? $container->get( \SubtleForms\Support\Settings::class ) : null,
			$container->has( \SubtleForms\Support\Captcha\CaptchaManager::class ) ? $container->get( \SubtleForms\Support\Captcha\CaptchaManager::class ) : null
		);
		$payload = $api->publicPayload( $repo->find( $formId ) );
		foreach ( $payload['schema']['fields'] as $field ) {
			if ( 'cap' === ( $field['id'] ?? '' ) ) {
				return (array) ( $field['config'] ?? array() );
			}
		}
		$this->fail( 'The CAPTCHA field is in the public payload.' );
	}

	/**
	 * @dataProvider providers
	 */
	public function test_a_captcha_without_keys_does_not_block_a_visitor( string $type, string $tokenField ): void {
		$formId = $this->formWithCaptcha( $type );
		$result = $this->submit( $formId, array( 'name' => 'Ada' ) );

		$this->assertSame( 200, $result['status'], wp_json_encode( $result['data'] ) );
		$this->assertSame( 1, $this->entryCount( $formId ), 'The entry is stored.' );
	}

	/**
	 * @dataProvider providers
	 */
	public function test_a_captcha_with_keys_still_rejects_a_failed_check( string $type, string $tokenField ): void {
		$formId = $this->formWithCaptcha( $type, array( 'site_key' => 'site-' . $type, 'secret_key' => 'secret-' . $type ) );
		$mock   = static function ( $pre, $args, $url ) {
			if ( false === strpos( (string) $url, 'siteverify' ) ) {
				return $pre;
			}
			return array(
				'headers'  => array(),
				'body'     => wp_json_encode( array( 'success' => false, 'error-codes' => array( 'invalid-input-response' ) ) ),
				'response' => array( 'code' => 200, 'message' => 'OK' ),
				'cookies'  => array(),
				'filename' => null,
			);
		};
		add_filter( 'pre_http_request', $mock, 10, 3 );
		$result = $this->submit( $formId, array( 'name' => 'Ada', $tokenField => 'bad-token' ) );
		remove_filter( 'pre_http_request', $mock, 10 );

		$this->assertSame( 400, $result['status'] );
		$this->assertSame( 0, $this->entryCount( $formId ), 'No entry is stored.' );
	}

	public function test_a_nested_captcha_without_keys_is_skipped_too(): void {
		$formId = $this->publish(
			array(
				array( 'id' => 'name', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ),
				array(
					'id'       => 'step1',
					'type'     => 'step',
					'children' => array(
						array( 'id' => 'cap', 'key' => 'cap', 'type' => 'turnstile', 'config' => array() ),
					),
				),
			)
		);
		$result = $this->submit( $formId, array( 'name' => 'Ada' ) );
		$this->assertSame( 200, $result['status'], wp_json_encode( $result['data'] ) );
		$this->assertSame( 1, $this->entryCount( $formId ) );
	}

	public function test_the_public_payload_hides_the_setup_message_from_visitors(): void {
		$formId = $this->formWithCaptcha( 'recaptcha' );
		wp_set_current_user( 0 );
		$config = $this->captchaConfig( $formId );

		$this->assertSame( '', $config['captchaWarning'] );
		$this->assertFalse( $config['captchaReady'] );
		$this->assertSame( '', $config['captchaHtml'] );
	}

	public function test_the_public_payload_shows_the_setup_message_to_an_admin(): void {
		$formId = $this->formWithCaptcha( 'recaptcha' );
		$this->asAdmin();
		$config = $this->captchaConfig( $formId );

		$this->assertSame( FieldCaptcha::resolve( array( 'type' => 'recaptcha' ) )['warning'], $config['captchaWarning'] );
		$this->assertStringContainsString( 'Only site admins see this message.', $config['captchaWarning'] );
		$this->assertFalse( $config['captchaReady'] );
	}

	public function test_a_configured_captcha_is_ready_for_everyone(): void {
		$formId = $this->formWithCaptcha( 'hcaptcha', array( 'site_key' => 'site-h', 'secret_key' => 'secret-h' ) );
		wp_set_current_user( 0 );
		$config = $this->captchaConfig( $formId );

		$this->assertTrue( $config['captchaReady'] );
		$this->assertSame( '', $config['captchaWarning'] );
		$this->assertStringContainsString( 'site-h', $config['captchaHtml'] );
	}
}
