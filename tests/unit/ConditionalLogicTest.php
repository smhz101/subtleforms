<?php

// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Conditional logic: server half of the shared spec.
 *
 * Every case lives in tests/fixtures/conditional-logic.json, which the jest
 * suite (resources/shared/conditions.test.js) also runs, so the browser and
 * the server must agree.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\ConditionalLogic;
use SubtleForms\Engine\FieldValidator;

/**
 * @covers \SubtleForms\Engine\ConditionalLogic
 */
final class ConditionalLogicTest extends TestCase {

	private static function spec(): array {
		static $spec = null;
		if ( $spec === null ) {
			$spec = json_decode( (string) file_get_contents( dirname( __DIR__ ) . '/fixtures/conditional-logic.json' ), true );
		}
		return $spec;
	}

	private function logic(): ConditionalLogic {
		return new ConditionalLogic( self::spec()['today'] );
	}

	public function conditionCases(): array {
		$out = array();
		foreach ( self::spec()['conditions'] as $case ) {
			$out[ $case['name'] ] = array( $case );
		}
		return $out;
	}

	/**
	 * @dataProvider conditionCases
	 */
	public function test_condition( array $case ) {
		$this->assertSame(
			$case['expected'],
			$this->logic()->evaluateCondition( $case['value'], $case['operator'], $case['compare'] ?? '', $case['compare2'] ?? '' )
		);
	}

	public function logicCases(): array {
		$out = array();
		foreach ( self::spec()['logic'] as $case ) {
			$out[ $case['name'] ] = array( $case );
		}
		return $out;
	}

	/**
	 * @dataProvider logicCases
	 */
	public function test_logic( array $case ) {
		$this->assertSame( $case['expected'], $this->logic()->logicPasses( $case['logic'], $case['values'] ) );
	}

	public function stateCases(): array {
		$out = array();
		foreach ( self::spec()['state'] as $case ) {
			$out[ $case['name'] ] = array( $case );
		}
		return $out;
	}

	/**
	 * @dataProvider stateCases
	 */
	public function test_state( array $case ) {
		$state = $this->logic()->evaluate( $case['schema'], $case['values'] );
		foreach ( array( 'hidden_fields', 'required_fields', 'hidden_steps' ) as $k ) {
			$expected = $case['expected'][ $k ];
			$actual   = $state[ $k ];
			sort( $expected );
			sort( $actual );
			$this->assertSame( $expected, $actual, $k );
		}
	}

	public function confirmationCases(): array {
		$out = array();
		foreach ( self::spec()['confirmations'] as $case ) {
			$out[ $case['name'] ] = array( $case );
		}
		return $out;
	}

	/**
	 * @dataProvider confirmationCases
	 */
	public function test_confirmation( array $case ) {
		$picked = $this->logic()->pickConfirmation( $case['metadata'], $case['values'] );
		$this->assertSame( $case['expected'], $picked['id'] ?? null );
	}

	public function advancedCases(): array {
		$out = array();
		foreach ( self::spec()['advanced'] as $case ) {
			$out[ $case['name'] ] = array( $case );
		}
		return $out;
	}

	/**
	 * @dataProvider advancedCases
	 */
	public function test_uses_advanced( array $case ) {
		$this->assertSame( $case['expected'], ConditionalLogic::usesAdvancedLogic( $case['logic'] ) );
	}

	public function test_visible_payload_drops_hidden_answers() {
		$schema = self::spec()['state'][0]['schema'];
		$out    = $this->logic()->visiblePayload( $schema, array( 'plan' => 'business', 'seats' => '3', 'invoice' => 'stale' ) );
		$this->assertArrayNotHasKey( 'invoice', $out );
		$this->assertSame( 'business', $out['plan'] );
	}

	public function test_hidden_required_field_is_not_validated() {
		$schema = self::spec()['state'][0]['schema'];
		$state  = $this->logic()->evaluate( $schema, array( 'plan' => 'free' ) );
		$result = ( new FieldValidator() )->validate( $schema, array( 'plan' => 'free' ), $state );
		$this->assertTrue( $result['valid'] );

		$state  = $this->logic()->evaluate( $schema, array( 'plan' => 'business', 'seats' => '9' ) );
		$result = ( new FieldValidator() )->validate( $schema, array( 'plan' => 'business', 'seats' => '9' ), $state );
		$this->assertFalse( $result['valid'] );
		$this->assertArrayHasKey( 'invoice', $result['errors'] );
	}

	public function test_required_field_in_skipped_step_is_not_validated() {
		$schema = self::spec()['state'][4]['schema'];
		$state  = $this->logic()->evaluate( $schema, array( 'need_ship' => 'no' ) );
		$result = ( new FieldValidator() )->validate( $schema, array( 'need_ship' => 'no' ), $state );
		$this->assertTrue( $result['valid'] );
	}
}
