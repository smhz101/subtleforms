<?php
/**
 * Unit tests for SubtleForms\Support\FeatureGate
 *
 * @package SubtleForms\Tests\Unit
 * @since   1.9.0
 */

namespace SubtleForms\Tests\Unit;

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

	// ── licensing (no LicenseManager) ──────────────────────────────────

	public function test_has_licensing_false_by_default(): void {
		$gate = $this->makeGate();
		$this->assertFalse( $gate->hasLicensing() );
	}

	public function test_is_pro_false_without_license_manager(): void {
		$gate = $this->makeGate();
		$this->assertFalse( $gate->isPro() );
	}

	public function test_has_feature_falls_back_to_capabilities(): void {
		$gate = $this->makeGate( array( 'actions.email' => true, 'actions.payment' => false ) );
		$this->assertTrue( $gate->hasFeature( 'actions.email' ) );
		$this->assertFalse( $gate->hasFeature( 'actions.payment' ) );
	}

	public function test_get_license_manager_null_by_default(): void {
		$gate = $this->makeGate();
		$this->assertNull( $gate->getLicenseManager() );
	}

	// ── licensing (with mock LicenseManager) ───────────────────────────

	public function test_has_licensing_true_with_manager(): void {
		$mock = $this->createMock( \SubtleForms\Licensing\LicenseManager::class );
		$gate = new FeatureGate( new Capabilities(), $mock );
		$this->assertTrue( $gate->hasLicensing() );
	}

	public function test_is_pro_delegates_to_license_manager(): void {
		$mock = $this->createMock( \SubtleForms\Licensing\LicenseManager::class );
		$mock->method( 'isValid' )->willReturn( true );
		$gate = new FeatureGate( new Capabilities(), $mock );
		$this->assertTrue( $gate->isPro() );
	}

	public function test_has_feature_delegates_to_license_manager(): void {
		$mock = $this->createMock( \SubtleForms\Licensing\LicenseManager::class );
		$mock->method( 'hasFeature' )->with( 'conditional_logic' )->willReturn( true );
		$gate = new FeatureGate( new Capabilities(), $mock );
		$this->assertTrue( $gate->hasFeature( 'conditional_logic' ) );
	}
}
