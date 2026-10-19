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

	public function test_money_uses_each_currency_s_decimals(): void {
		$this->assertSame( '50 KRW', \SubtleForms\Support\AnswerFormatter::money( 50, 'KRW' ) );
		$this->assertSame( "\u{00A5}1,200", \SubtleForms\Support\AnswerFormatter::money( 1200, 'JPY' ) );
		$this->assertSame( '12.50 CHF', \SubtleForms\Support\AnswerFormatter::money( 12.5, 'CHF' ) );
		$this->assertSame( '7.00', \SubtleForms\Support\AnswerFormatter::money( 7, '' ) );
	}

	public function test_entry_contexts_use_the_currency_the_entry_was_charged_in(): void {
		$schema = array( 'metadata' => array( 'payment' => array( 'currency' => 'USD' ) ), 'fields' => array() );
		$this->assertSame( 'EUR', \SubtleForms\Support\AnswerFormatter::entryCurrency( array( 'meta' => array( 'order' => array( 'currency' => 'eur' ) ) ) ) );
		$this->assertSame( 'GBP', \SubtleForms\Support\AnswerFormatter::entryCurrency( array( 'meta' => '{"payment":{"currency":"GBP"}}' ) ) );
		$this->assertSame( '', \SubtleForms\Support\AnswerFormatter::entryCurrency( array( 'meta' => array() ) ) );

		$entry = \SubtleForms\Support\AnswerFormatter::entryContext( $schema, array( 'meta' => array( 'order' => array( 'currency' => 'KRW' ) ) ), array( 'submission_id' => 3 ) );
		$this->assertSame( 'KRW', $entry['currency'] );
		$this->assertSame( 3, $entry['submission_id'] );
		$this->assertSame( 'USD', \SubtleForms\Support\AnswerFormatter::entryContext( $schema, array( 'meta' => array() ) )['currency'], 'An entry without an order uses the form currency.' );

		$product = array( 'id' => 'p', 'key' => 'sticker', 'type' => 'payment_product', 'config' => array( 'label' => 'Sticker', 'productName' => 'Sticker', 'price' => 5000, 'allowQuantity' => true ) );
		$this->assertSame( "Sticker \u{00D7} 2 (10,000 KRW)", \SubtleForms\Support\AnswerFormatter::text( 2, $product, $entry ) );
	}

	public function test_import_identity_ignores_status_and_flags_and_reads_the_source_entry(): void {
		$row     = array( 'created_at' => '2026-10-18 12:00:00', 'status' => 'completed', 'is_read' => 0, 'starred' => 0, 'payload' => array( 'a' => '1' ) );
		$flagged = array_merge( $row, array( 'status' => 'flagged', 'is_read' => 1, 'starred' => 1 ) );
		$this->assertSame( \SubtleForms\Tools\TransferService::submissionIdentity( $row ), \SubtleForms\Tools\TransferService::submissionIdentity( $flagged ) );

		$this->assertSame( '4:17', \SubtleForms\Tools\TransferService::entryRef( 4, 17 ) );
		$this->assertSame( '', \SubtleForms\Tools\TransferService::entryRef( 0, 17 ) );
		$this->assertSame( '4:17', \SubtleForms\Tools\TransferService::storedRef( array( 'id' => 90, 'meta' => array( 'import' => array( 'ref' => '4:17' ) ) ), 9 ) );
		$this->assertSame( '9:90', \SubtleForms\Tools\TransferService::storedRef( array( 'id' => 90, 'meta' => array() ), 9 ) );

		$package = \SubtleForms\Tools\TransferPackage::submissions(
			array( 'id' => 4, 'title' => 'Join' ),
			array( array( 'entry_id' => 17, 'status' => 'read', 'created_at' => '2026-10-01 12:00:00', 'payload' => array( 'a' => '1' ) ) )
		);
		$this->assertSame( 17, \SubtleForms\Tools\TransferPackage::readSubmissions( $package )['submissions'][0]['entry_id'] );
	}
}
