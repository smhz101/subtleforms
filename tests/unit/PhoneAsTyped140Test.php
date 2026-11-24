<?php

// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * #140: phone answers are kept as the visitor typed them.
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
final class PhoneAsTyped140Test extends TestCase {

	private function stored( string $value ): string {
		$out = FieldValidator::prepare(
			array( 'fields' => array( array( 'key' => 'p', 'type' => 'phone' ) ) ),
			array( 'p' => $value )
		);
		return $out['p'];
	}

	public function test_spaces_are_kept() {
		$this->assertSame( '+92 300 1234567', $this->stored( '+92 300 1234567' ) );
	}

	public function test_edges_are_trimmed_and_punctuation_kept() {
		$this->assertSame( '+1 (555) 010-9999', $this->stored( '  +1 (555) 010-9999  ' ) );
	}

	public function test_runs_of_spaces_collapse() {
		$this->assertSame( '+92 300 1234567', $this->stored( "+92   300 \t 1234567" ) );
	}

	public function test_dotted_international_number_gets_spaces() {
		$this->assertSame( '+1 415 555 0100', $this->stored( '+1 415.555.0100' ) );
		$result = ( new FieldValidator() )->validate(
			array( 'fields' => array( array( 'key' => 'p', 'type' => 'phone' ) ) ),
			array( 'p' => $this->stored( '+1 415.555.0100' ) ),
			array( 'hidden_fields' => array(), 'required_fields' => array() )
		);
		$this->assertSame( array(), $result['errors'] );
	}

	public function test_calling_code_only_is_empty() {
		$this->assertSame( '', $this->stored( '+92' ) );
	}

	public function test_too_few_digits_is_refused() {
		$result = ( new FieldValidator() )->validate(
			array( 'fields' => array( array( 'key' => 'p', 'type' => 'phone' ) ) ),
			array( 'p' => '+92 123' ),
			array( 'hidden_fields' => array(), 'required_fields' => array() )
		);
		$this->assertSame( array( 'p' => 'Invalid phone number.' ), $result['errors'] );
	}
}
