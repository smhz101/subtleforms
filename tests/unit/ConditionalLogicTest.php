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

	/** The plugin evaluates the basic operators only; the rest belong to an add-on. */
	public function test_the_plugin_does_not_ship_advanced_operators(): void {
		$this->assertSame(
			array( 'equals', 'not_equals', 'contains', 'not_contains', 'empty', 'not_empty', 'greater_than', 'less_than' ),
			ConditionalLogic::BASIC_OPERATORS
		);
		$this->assertFalse( ( new \SubtleForms\Support\Capabilities() )->allows( 'logic.conditional.advanced' ) );
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
			$this->logic()->evaluateCondition( $case['value'], $case['operator'], $case['compare'] ?? '', $case['compare2'] ?? '', $case['field'] ?? null )
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

	public function ignoredCases(): array {
		$out = array();
		foreach ( self::spec()['ignored'] as $case ) {
			$out[ $case['name'] ] = array( $case );
		}
		return $out;
	}

	/**
	 * Logic the plugin does not evaluate passes: the field, step, email or
	 * webhook is not held back by a rule nobody checks.
	 *
	 * @dataProvider ignoredCases
	 */
	public function test_unsupported_logic_is_ignored( array $case ) {
		$this->assertSame( $case['expected'], $this->logic()->logicPasses( $case['logic'], $case['values'], array(), $case['scope'] ) );
		$this->assertFalse( ConditionalLogic::hasLogic( $case['logic'], $case['scope'] ) );
	}

	public function ignoredStateCases(): array {
		$out = array();
		foreach ( self::spec()['ignoredState'] as $case ) {
			$out[ $case['name'] ] = array( $case );
		}
		return $out;
	}

	/**
	 * @dataProvider ignoredStateCases
	 */
	public function test_unsupported_logic_changes_no_field_state( array $case ) {
		$state = $this->logic()->evaluate( $case['schema'], $case['values'] );
		foreach ( array( 'hidden_fields', 'required_fields', 'hidden_steps' ) as $k ) {
			$this->assertSame( $case['expected'][ $k ], $state[ $k ], $k );
		}
	}

	public function test_an_add_on_can_take_on_advanced_logic(): void {
		$GLOBALS['sf_test_filters']['subtleforms/logic/supports'] = static fn( $supported, $l, $scope ) => 'step' === $scope ? true : $supported;
		$GLOBALS['sf_test_filters']['subtleforms/logic/passes']   = static fn( $result, $l, $values ) => 'go' === ( $values['a'] ?? '' );
		try {
			$logic = array( 'action' => 'show', 'groups' => array( array( 'match' => 'all', 'rules' => array( array( 'field' => 'a', 'operator' => 'equals', 'value' => '1' ) ) ) ) );
			$this->assertTrue( ConditionalLogic::hasLogic( $logic, 'step' ) );
			$this->assertTrue( $this->logic()->logicPasses( $logic, array( 'a' => 'go' ), array(), 'step' ) );
			$this->assertFalse( $this->logic()->logicPasses( $logic, array( 'a' => 'no' ), array(), 'step' ) );
			$this->assertFalse( ConditionalLogic::hasLogic( $logic, 'action' ), 'Only the scopes the add-on claims are evaluated.' );
		} finally {
			unset( $GLOBALS['sf_test_filters']['subtleforms/logic/supports'], $GLOBALS['sf_test_filters']['subtleforms/logic/passes'] );
		}
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

	/** A step rule is ignored, so the step is shown and its required field is checked like any other. */
	public function test_required_field_in_a_step_with_an_ignored_rule_is_validated() {
		$schema = self::spec()['ignoredState'][0]['schema'];
		$state  = $this->logic()->evaluate( $schema, array( 'need_ship' => 'no' ) );
		$result = ( new FieldValidator() )->validate( $schema, array( 'need_ship' => 'no' ), $state );
		$this->assertFalse( $result['valid'] );
		$this->assertArrayHasKey( 'address', $result['errors'] );

		$ok = ( new FieldValidator() )->validate( $schema, array( 'need_ship' => 'no', 'address' => '1 Main St' ), $state );
		$this->assertTrue( $ok['valid'] );
	}
}
