<?php

/**
 * Formula evaluator: non-finite results are failures, not zero.
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\Formula;

final class FormulaTest extends TestCase {

	public function test_division_by_zero_fails(): void {
		$this->assertNull( Formula::evaluate( '1/0', array() ) );
		$this->assertNull( Formula::evaluate( '1 / 0', array() ) );
		$this->assertNull( Formula::evaluate( '{qty} / {price}', array( 'qty' => 1, 'price' => 0 ) ) );
	}

	public function test_modulo_by_zero_fails(): void {
		$this->assertNull( Formula::evaluate( '5%0', array() ) );
	}

	public function test_missing_reference_fails(): void {
		$this->assertNull( Formula::evaluate( '{qty}', array() ) );
		$this->assertNull( Formula::evaluate( '{qty} * {price}', array( 'qty' => 2 ) ) );
	}

	public function test_explicit_zero_stays_zero(): void {
		$this->assertSame( 0.0, Formula::evaluate( '0+0', array() ) );
		$this->assertSame( 0.0, Formula::evaluate( '0', array() ) );
		$this->assertSame( 0.0, Formula::evaluate( '{a}+{b}', array( 'a' => 0, 'b' => 0 ) ) );
	}

	public function test_failed_dependency_fails(): void {
		$this->assertNull( Formula::evaluate( '{due} + 1', array( 'due' => Formula::ERROR ) ) );
	}
}
