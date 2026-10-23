<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Client IP helper, reCAPTCHA v3 score and action, recipients built from
 * answers, and the upgrade gate (2.7.1 security fixes).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\Actions\EmailAction;
use SubtleForms\Security\ClientIp;
use SubtleForms\Support\Captcha\RecaptchaProvider;

require_once __DIR__ . '/fixtures/security-stubs.php';

final class Security271Test extends TestCase {

	protected function setUp(): void {
		$GLOBALS['sf_test_options'] = array();
		$GLOBALS['sf_test_filters'] = array();
		$_SERVER                    = array();
	}

	protected function tearDown(): void {
		$GLOBALS['sf_test_options'] = array();
		$GLOBALS['sf_test_filters'] = array();
		$_SERVER                    = array();
	}

	public function test_forwarding_headers_are_ignored_by_default(): void {
		$_SERVER['REMOTE_ADDR']          = '203.0.113.9';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.1';
		$_SERVER['HTTP_CLIENT_IP']       = '198.51.100.2';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.3';
		$this->assertSame( '203.0.113.9', ClientIp::get() );
	}

	public function test_a_listed_proxy_may_forward_the_client_address(): void {
		$GLOBALS['sf_test_options']['subtleforms_settings'] = array( 'trusted_proxy_cidrs' => "10.0.0.0/8\n192.168.1.5" );
		$_SERVER['REMOTE_ADDR']          = '10.1.2.3';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.7, 10.9.9.9';
		$this->assertSame( '198.51.100.7', ClientIp::get() );

		// A client-supplied extra hop on the left cannot win over the real one.
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '1.2.3.4, 198.51.100.7, 10.9.9.9';
		$this->assertSame( '198.51.100.7', ClientIp::get() );

		// An unlisted connection is believed for nothing.
		$_SERVER['REMOTE_ADDR'] = '203.0.113.9';
		$this->assertSame( '203.0.113.9', ClientIp::get() );

		// Junk in the header falls back to the connection address.
		$_SERVER['REMOTE_ADDR']          = '10.1.2.3';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = 'not-an-ip';
		$this->assertSame( '10.1.2.3', ClientIp::get() );
	}

	public function test_the_cloudflare_toggle_trusts_cloudflare_and_its_header_only(): void {
		$_SERVER['REMOTE_ADDR']           = '104.16.0.5';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.20';
		$this->assertSame( '104.16.0.5', ClientIp::get(), 'off by default' );

		$GLOBALS['sf_test_options']['subtleforms_settings'] = array( 'trust_cloudflare' => true );
		$this->assertSame( '198.51.100.20', ClientIp::get() );

		$_SERVER['REMOTE_ADDR'] = '203.0.113.9';
		$this->assertSame( '203.0.113.9', ClientIp::get(), 'a non-Cloudflare sender cannot use the header' );
	}

	public function test_cloudflare_header_needs_a_cloudflare_connection_even_with_a_custom_proxy(): void {
		$GLOBALS['sf_test_options']['subtleforms_settings'] = array(
			'trust_cloudflare'    => true,
			'trusted_proxy_cidrs' => array( '10.0.0.0/8' ),
		);
		$_SERVER['REMOTE_ADDR']           = '10.1.2.3';
		$_SERVER['HTTP_CF_CONNECTING_IP'] = '198.51.100.77';
		unset( $_SERVER['HTTP_X_FORWARDED_FOR'] );
		$this->assertSame( '10.1.2.3', ClientIp::get(), 'a custom proxy cannot vouch for the Cloudflare header' );

		$_SERVER['REMOTE_ADDR'] = '104.16.0.5';
		$this->assertSame( '198.51.100.77', ClientIp::get() );
	}

	public function test_cidr_matching_covers_ipv4_and_ipv6(): void {
		$this->assertTrue( ClientIp::in_range( '10.1.2.3', '10.0.0.0/8' ) );
		$this->assertFalse( ClientIp::in_range( '11.1.2.3', '10.0.0.0/8' ) );
		$this->assertTrue( ClientIp::in_range( '172.65.1.1', '172.64.0.0/13' ) );
		$this->assertTrue( ClientIp::in_range( '2606:4700::1', '2606:4700::/32' ) );
		$this->assertFalse( ClientIp::in_range( '2606:4701::1', '2606:4700::/32' ) );
		$this->assertFalse( ClientIp::in_range( '10.0.0.1', '2606:4700::/32' ) );
		$this->assertFalse( ClientIp::in_range( '10.0.0.1', 'garbage' ) );
		$this->assertTrue( ClientIp::in_range( '192.168.1.5', '192.168.1.5' ) );
	}

	public function test_recaptcha_v3_needs_the_score_and_the_action(): void {
		$this->assertTrue( RecaptchaProvider::check_v3( array( 'score' => 0.9, 'action' => 'submit' ) ) );
		$this->assertTrue( RecaptchaProvider::check_v3( array( 'score' => 0.5, 'action' => 'submit' ) ) );
		$this->assertStringContainsString( 'low-score', RecaptchaProvider::check_v3( array( 'score' => 0.1, 'action' => 'submit' ) ) );
		$this->assertStringContainsString( 'action-mismatch', RecaptchaProvider::check_v3( array( 'score' => 0.9, 'action' => 'login' ) ) );
		$this->assertStringContainsString( 'action-mismatch', RecaptchaProvider::check_v3( array( 'score' => 0.9 ) ) );

		$GLOBALS['sf_test_filters']['subtleforms/captcha/recaptcha_min_score'] = static function () {
			return 0.2;
		};
		$this->assertTrue( RecaptchaProvider::check_v3( array( 'score' => 0.3, 'action' => 'submit' ) ) );
	}

	public function test_a_recipient_can_use_an_email_field_but_not_a_text_box(): void {
		$schema  = array(
			'fields' => array(
				array( 'type' => 'email', 'key' => 'email', 'config' => array( 'key' => 'email' ) ),
				array( 'type' => 'text', 'key' => 'note', 'config' => array( 'key' => 'note' ) ),
			),
		);
		$answers = EmailAction::recipientAnswers( array( 'email' => 'me@example.com', 'note' => 'victim@example.org' ), $schema );
		$this->assertSame( 'me@example.com', $answers['email'] );
		$this->assertSame( '', $answers['note'] );
	}
}
