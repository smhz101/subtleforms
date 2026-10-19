<?php
// phpcs:disable -- Unit test; not shipped in production plugin.
/**
 * Review findings on the 2.4.0 release PR (#37).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Api\ClassicResult;

final class Review37Test extends TestCase {

	public function test_a_rejected_classic_post_is_not_a_success_and_keeps_its_errors_and_answers(): void {
		$body    = array(
			'error' => array(
				'code'    => 'validation_error',
				'message' => 'Please fix the highlighted fields.',
				'meta'    => array( 'fields' => array( 'email' => 'Enter a valid email address.' ) ),
			),
		);
		$outcome = ClassicResult::outcome(
			422,
			$body,
			7,
			array(
				'email'                => 'not-an-email',
				'g-recaptcha-response' => 'token',
				'website_url'          => '',
				'_payment'             => 'pi_123',
			)
		);
		$this->assertFalse( $outcome['ok'] );
		$this->assertSame( '', $outcome['redirect'] );
		$this->assertSame( $body, $outcome['body'] );
		$this->assertSame( array( 'email' => 'not-an-email' ), $outcome['values'] );
		$this->assertSame( 7, $outcome['form_id'] );
	}

	public function test_a_captcha_failure_with_a_redirect_confirmation_does_not_redirect(): void {
		$outcome = ClassicResult::outcome( 400, array( 'error' => array( 'message' => 'CAPTCHA verification failed.' ) ), 3, array() );
		$this->assertFalse( $outcome['ok'] );
		$this->assertSame( '', $outcome['redirect'] );
	}

	public function test_a_200_without_success_is_not_a_success(): void {
		$this->assertFalse( ClassicResult::outcome( 200, array( 'data' => array( 'success' => false ) ), 3, array() )['ok'] );
		$this->assertFalse( ClassicResult::outcome( 200, 'not json', 3, array() )['ok'] );
	}

	public function test_a_successful_post_follows_the_redirect_confirmation_or_an_add_on_redirect(): void {
		$conf = ClassicResult::outcome(
			200,
			array( 'data' => array( 'success' => true, 'confirmation' => array( 'type' => 'redirect', 'redirectUrl' => 'https://example.org/thanks' ) ) ),
			3,
			array()
		);
		$this->assertTrue( $conf['ok'] );
		$this->assertSame( 'https://example.org/thanks', $conf['redirect'] );
		$this->assertTrue( $conf['configured'] );

		$addon = ClassicResult::outcome(
			200,
			array( 'data' => array( 'success' => true, 'redirect' => 'https://shop.test/checkout', 'confirmation' => array( 'type' => 'message', 'message' => 'Thanks' ) ) ),
			3,
			array()
		);
		$this->assertSame( 'https://shop.test/checkout', $addon['redirect'] );
		$this->assertFalse( $addon['configured'] );

		$message = ClassicResult::outcome( 200, array( 'data' => array( 'success' => true, 'confirmation' => array( 'type' => 'message', 'message' => 'Thanks' ) ) ), 3, array() );
		$this->assertTrue( $message['ok'] );
		$this->assertSame( '', $message['redirect'] );
	}
}
