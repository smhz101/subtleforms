<?php

// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * 2.4.0 (F240-1): FieldValidator checks for types the WordPress test site
 * cannot submit (the Signature field needs SubtleForms Pro) and the payload
 * tidying done before validation.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;

/**
 * @covers \SubtleForms\Engine\FieldValidator
 */
final class FieldValueParity240Test extends TestCase {

	private function errors( array $field, $value ): array {
		$field  = array_merge( array( 'key' => 'f' ), $field );
		$result = ( new FieldValidator() )->validate(
			array( 'fields' => array( $field ) ),
			array( 'f' => $value ),
			array(
				'hidden_fields'   => array(),
				'required_fields' => array(),
			)
		);
		return $result['errors'];
	}

	/** FA-01: a signature is a drawn PNG or JPEG. */
	public function test_signature_must_be_an_image() {
		$png = 'data:image/png;base64,iVBORw0KGgo=';
		$this->assertArrayHasKey( 'f', $this->errors( array( 'type' => 'signature' ), 'hello' ) );
		$this->assertArrayHasKey( 'f', $this->errors( array( 'type' => 'signature' ), 'data:image/svg+xml;base64,AAAA' ) );
		$this->assertSame( array(), $this->errors( array( 'type' => 'signature' ), $png ) );
	}

	/** FB-07: a read-only default that reads the page address cannot be checked here. */
	public function test_read_only_with_query_token_is_not_checked() {
		$field = array( 'type' => 'text', 'readOnly' => true, 'defaultValue' => '{get:ref}' );
		$this->assertSame( array(), $this->errors( $field, 'from-the-url' ) );
		$field['defaultValue'] = 'fixed';
		$this->assertSame( array( 'f' => 'This field cannot be changed.' ), $this->errors( $field, 'hacked' ) );
	}

	/** FB-14: server messages are the browser's. */
	public function test_messages_match_the_browser() {
		$this->assertSame( array( 'f' => 'Must be no more than 100.' ), $this->errors( array( 'type' => 'number', 'max' => 100 ), 101 ) );
		$this->assertSame( array( 'f' => 'Must be at least 5.' ), $this->errors( array( 'type' => 'number', 'min' => 5 ), 1 ) );
		$this->assertSame( array( 'f' => 'Please enter a number.' ), $this->errors( array( 'type' => 'number' ), 'abc' ) );
		$this->assertSame( array( 'f' => 'Invalid URL.' ), $this->errors( array( 'type' => 'url' ), 'javascript:alert(1)' ) );
		$this->assertSame( array( 'f' => 'Invalid phone number.' ), $this->errors( array( 'type' => 'tel' ), 'call me' ) );
	}

	/** FB-15, FB-05, FLD2-07: answers are tidied the way the browser stores them. */
	public function test_prepare_tidies_websites_email_lists_and_phone_numbers() {
		$schema = array(
			'fields' => array(
				array( 'key' => 'web', 'type' => 'url' ),
				array( 'key' => 'mail', 'type' => 'email', 'config' => array( 'allowMultiple' => true ) ),
				array( 'key' => 'ph', 'type' => 'phone' ),
				array( 'key' => 'it', 'type' => 'phone' ),
				array( 'key' => 'code', 'type' => 'phone' ),
			),
		);
		$out    = FieldValidator::prepare(
			$schema,
			array(
				'web'  => 'example.com/about',
				'mail' => 'a@example.com ;b@example.com,',
				'ph'   => '+44 (0)20 7946 0958',
				'it'   => '+39 06 1234 5678',
				'code' => '+1',
			)
		);
		$this->assertSame( 'https://example.com/about', $out['web'] );
		$this->assertSame( 'a@example.com, b@example.com', $out['mail'] );
		$this->assertSame( '+44 2079460958', $out['ph'] );
		$this->assertSame( '+39 0612345678', $out['it'] );
		$this->assertSame( '', $out['code'] );
		$this->assertSame( 'ftp://example.com', FieldValidator::normalizeUrl( 'ftp://example.com' ) );
	}
}
