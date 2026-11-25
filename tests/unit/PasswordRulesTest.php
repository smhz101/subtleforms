<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Password rules and minimum strength (server side).
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
final class PasswordRulesTest extends TestCase {

	private function error( array $config, string $value ) {
		$schema = array(
			'fields' => array(
				array(
					'key'    => 'pw',
					'type'   => 'password',
					'config' => $config,
				),
			),
		);
		$result = ( new FieldValidator() )->validate(
			$schema,
			array( 'pw' => $value ),
			array( 'hidden_fields' => array(), 'required_fields' => array() )
		);
		return $result['errors']['pw'] ?? null;
	}

	public function test_default_field_accepts_a_plain_password() {
		$this->assertNull( $this->error( array( 'minLength' => 8, 'strengthMeter' => true ), 'abcdefgh' ) );
	}

	public function test_each_rule() {
		$this->assertSame( 'Your password needs: an uppercase letter.', $this->error( array( 'requireUppercase' => true ), 'abcdefgh' ) );
		$this->assertSame( 'Your password needs: a lowercase letter.', $this->error( array( 'requireLowercase' => true ), 'ABCDEFGH' ) );
		$this->assertSame( 'Your password needs: a number.', $this->error( array( 'requireNumber' => true ), 'abcdefgh' ) );
		$this->assertSame( 'Your password needs: a symbol.', $this->error( array( 'requireSymbol' => true ), 'abcdefgh' ) );
		$this->assertNull( $this->error( array( 'requireUppercase' => true, 'requireNumber' => true ), 'Abcdefg1' ) );
	}

	public function test_several_unmet_rules_are_listed() {
		$config = array( 'requireUppercase' => true, 'requireNumber' => true, 'requireSymbol' => true );
		$this->assertSame( 'Your password needs: an uppercase letter, a number, a symbol.', $this->error( $config, 'abcdefgh' ) );
	}

	public function test_min_strength() {
		$this->assertSame( 'Choose a stronger password.', $this->error( array( 'minStrength' => 'fair' ), 'abcdefgh' ) );
		$this->assertNull( $this->error( array( 'minStrength' => 'fair' ), 'Abcdefgh' ) );
		$this->assertSame( 'Choose a stronger password.', $this->error( array( 'minStrength' => 'strong' ), 'Abcdefg1' ) );
		$this->assertNull( $this->error( array( 'minStrength' => 'strong' ), 'Abcdef1!' ) );
		$this->assertNull( $this->error( array( 'minStrength' => 'any' ), 'a' ) );
	}

	public function test_empty_optional_value_is_skipped() {
		$this->assertNull( $this->error( array( 'requireNumber' => true, 'minStrength' => 'strong' ), '' ) );
	}

	public function test_strength_matches_the_browser() {
		// Same list and levels as resources/shared/passwordStrength.test.js.
		$expected = array(
			''              => 'none',
			'abc'           => 'weak',
			'abcdefgh'      => 'weak',
			'Abcdefgh'      => 'fair',
			'Abcdefg1'      => 'good',
			'Abcdef1!'      => 'strong',
			'Abcdefghij1!'  => 'strong',
			'abcdefgh ijkl' => 'good',
		);
		$method = new \ReflectionMethod( FieldValidator::class, 'passwordStrength' );
		$method->setAccessible( true );
		$validator = new FieldValidator();
		foreach ( $expected as $value => $level ) {
			$this->assertSame( $level, $method->invoke( $validator, (string) $value ), "'$value'" );
		}
	}
}
