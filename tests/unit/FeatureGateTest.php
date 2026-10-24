<?php

/**
 * Unit tests for SubtleForms\Support\FeatureGate
 *
 * @package SubtleForms\Tests\Unit
 * @since   1.9.0
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\Capabilities;
use SubtleForms\Support\FeatureGate;
use RuntimeException;

/**
 * @covers \SubtleForms\Support\FeatureGate
 */
final class FeatureGateTest extends TestCase {

	private function makeGate( array $map = array() ): FeatureGate {
		return new FeatureGate( new Capabilities( $map ) );
	}

	// ── allows ─────────────────────────────────────────────────────────

	public function test_allows_delegates_to_capabilities(): void {
		$gate = $this->makeGate( array( 'api.read' => true, 'api.admin' => false ) );
		$this->assertTrue( $gate->allows( 'api.read' ) );
		$this->assertFalse( $gate->allows( 'api.admin' ) );
	}

	public function test_allows_returns_false_for_unknown(): void {
		$gate = $this->makeGate();
		$this->assertFalse( $gate->allows( 'nonexistent' ) );
	}

	// ── require ────────────────────────────────────────────────────────

	public function test_require_passes_for_allowed_capability(): void {
		$gate = $this->makeGate( array( 'api.read' => true ) );
		$gate->require( 'api.read' ); // should not throw
		$this->assertTrue( true ); // assertion reached
	}

	public function test_require_throws_for_denied_capability(): void {
		$gate = $this->makeGate( array( 'api.read' => false ) );
		$this->expectException( RuntimeException::class );
		$gate->require( 'api.read' );
	}

	public function test_require_uses_custom_message(): void {
		$gate = $this->makeGate();
		$this->expectException( RuntimeException::class );
		$this->expectExceptionMessage( 'Custom denial' );
		$gate->require( 'x', 'Custom denial' );
	}

	// ── capabilities accessor ──────────────────────────────────────────

	public function test_capabilities_returns_instance(): void {
		$caps = new Capabilities( array( 'a' => true ) );
		$gate = new FeatureGate( $caps );
		$this->assertSame( $caps, $gate->capabilities() );
	}

	// ── no licence handling (WordPress.org guideline 5) ────────────────

	public function test_the_gate_only_reads_the_capability_map(): void {
		$methods = array_map(
			static fn( \ReflectionMethod $m ) => $m->getName(),
			( new \ReflectionClass( FeatureGate::class ) )->getMethods( \ReflectionMethod::IS_PUBLIC )
		);
		sort( $methods );
		$this->assertSame( array( '__construct', 'allows', 'capabilities', 'require', 'setCapabilities' ), $methods );
		$source = (string) file_get_contents( dirname( __DIR__, 2 ) . '/src/Support/FeatureGate.php' );
		$this->assertDoesNotMatchRegularExpression( '/licen[cs]/i', $source );
	}

	public function test_an_extra_constructor_argument_from_an_older_add_on_is_ignored(): void {
		$caps = new Capabilities( array( 'a' => true ) );
		$gate = new FeatureGate( $caps, new \stdClass() );
		$this->assertTrue( $gate->allows( 'a' ) );
		$this->assertFalse( $gate->allows( 'b' ) );
	}

	public function test_capabilities_pick_up_a_filter_added_after_they_were_built(): void {
		$caps = new Capabilities( array( 'a' => true ) );
		$this->assertFalse( $caps->allows( 'addon.x' ) );

		$GLOBALS['sf_test_filters']['subtleforms/capabilities'] = static fn( $map ) => $map + array( 'addon.x' => true );
		$GLOBALS['wp_filter']['subtleforms/capabilities']       = (object) array( 'callbacks' => array( 10 => array( 'addon' => array() ) ) );
		try {
			$this->assertTrue( $caps->allows( 'addon.x' ) );
			$this->assertTrue( $caps->all()['a'] );
		} finally {
			unset( $GLOBALS['sf_test_filters']['subtleforms/capabilities'], $GLOBALS['wp_filter']['subtleforms/capabilities'] );
		}
	}

	public function test_set_capabilities_swaps_the_map(): void {
		$gate = $this->makeGate( array( 'a' => false ) );
		$gate->setCapabilities( new Capabilities( array( 'a' => true ) ) );
		$this->assertTrue( $gate->allows( 'a' ) );
	}
}
