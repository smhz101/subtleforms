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

	protected function tearDown(): void {
		unset( $GLOBALS['sf_test_filters']['subtleforms/format/currency'] );
		parent::tearDown();
	}

	public function test_a_rejected_classic_post_is_not_a_success_and_keeps_its_errors_and_answers(): void {
		$body    = array(
			'error' => array(
				'code'    => 'validation_error',
				'message' => 'Please fix the highlighted fields.',
				'meta'    => array( 'fields' => array( 'email' => 'Enter a valid email address.' ) ),
			),
		);
		// An add-on's own request value is listed through RequestKeys.
		$GLOBALS['sf_test_filters']['subtleforms/submission/request_keys'] = static fn( $keys ) => array_merge( $keys, array( '_example' ) );
		$outcome = ClassicResult::outcome(
			422,
			$body,
			7,
			array(
				'email'                => 'not-an-email',
				'g-recaptcha-response' => 'token',
				'website_url'          => '',
				'_example'             => 'ref_123',
			)
		);
		unset( $GLOBALS['sf_test_filters']['subtleforms/submission/request_keys'] );
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

	public function test_display_context_comes_from_add_ons_with_the_entry(): void {
		$seen = null;
		$GLOBALS['sf_test_filters']['subtleforms/format/context'] = static function ( $context, $schema, $submission ) use ( &$seen ) {
			$seen = $submission;
			return $context + array( 'example' => 'yes' );
		};
		$entry = \SubtleForms\Support\AnswerFormatter::entryContext( array( 'fields' => array() ), array( 'id' => 3, 'meta' => array() ) );
		$this->assertSame( 3, $entry['submission_id'] );
		$this->assertSame( 'yes', $entry['example'] );
		$this->assertSame( 3, $seen['id'] );
		$this->assertArrayNotHasKey( 'currency', \SubtleForms\Support\AnswerFormatter::context( array() ) );
		unset( $GLOBALS['sf_test_filters']['subtleforms/format/context'] );
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

	public function test_one_captcha_field_per_provider(): void {
		$schema = array(
			'schema_version' => 1,
			'metadata'       => array( 'name' => 'C', 'title' => 'C' ),
			'fields'         => array(
				array( 'id' => 'c1', 'key' => 'c1', 'type' => 'recaptcha', 'config' => array( 'site_key' => 'a', 'secret_key' => 'b' ) ),
				array( 'id' => 'name', 'key' => 'name', 'type' => 'text', 'config' => array( 'label' => 'Name' ) ),
				array( 'id' => 'c2', 'key' => 'c2', 'type' => 'recaptcha', 'config' => array( 'site_key' => 'c', 'secret_key' => 'd' ) ),
				array( 'id' => 'c3', 'key' => 'c3', 'type' => 'hcaptcha', 'config' => array() ),
			),
		);
		$fields = \SubtleForms\Support\Captcha\FieldCaptcha::fields( $schema );
		$this->assertSame( array( 'c2' ), array_column( \SubtleForms\Support\Captcha\FieldCaptcha::repeated( $fields ), 'id' ) );
		$this->assertSame( array( 'c1', 'c3' ), array_column( \SubtleForms\Support\Captcha\FieldCaptcha::onePerProvider( $fields ), 'id' ) );

		$errors = ( new \SubtleForms\Support\SchemaValidator() )->validateWithErrors( $schema );
		$captcha = array_values( array_filter( $errors, static fn( $e ) => ( $e['field_id'] ?? '' ) === 'c2' ) );
		$this->assertCount( 1, $captcha );
		$this->assertStringContainsString( 'only one reCAPTCHA field', $captcha[0]['message'] );

		unset( $schema['fields'][2] );
		$errors = ( new \SubtleForms\Support\SchemaValidator() )->validateWithErrors( $schema );
		$this->assertSame( array(), array_values( array_filter( $errors, static fn( $e ) => isset( $e['field_id'] ) ) ), 'Different providers are fine.' );
	}

	public function test_classic_redirect_merge_tags_are_filled_and_encoded(): void {
		$url = ClassicResult::fillTags(
			'https://example.org/thanks?email={field:email}&id={entry_id}&f={{form_title}}&n={name}&x={unknown}&c={colors}',
			array( 'email' => 'a+b@c.co', 'name' => array( 'first' => 'Ada', 'last' => 'Lovelace' ), 'colors' => array( 'red', 'blue' ) ),
			'Sign up',
			42
		);
		$this->assertSame( 'https://example.org/thanks?email=a%2Bb%40c.co&id=42&f=Sign%20up&n=Ada%20Lovelace&x=&c=red%2C%20blue', $url );
	}
}
