<?php
/**
 * Unit tests for SubtleForms\Support\Capabilities
 *
 * @package SubtleForms\Tests\Unit
 * @since   1.9.0
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\Capabilities;

/**
 * @covers \SubtleForms\Support\Capabilities
 */
final class CapabilitiesTest extends TestCase {

	// ── defaults ───────────────────────────────────────────────────────

	public function test_defaults_contain_expected_keys(): void {
		$defaults = Capabilities::defaults();
		$this->assertArrayHasKey( 'forms.unlimited', $defaults );
		$this->assertArrayHasKey( 'actions.save', $defaults );
		$this->assertArrayHasKey( 'api.read', $defaults );
	}

	// ── allows ─────────────────────────────────────────────────────────

	public function test_allows_returns_true_for_enabled_capability(): void {
		$caps = new Capabilities( array( 'feature.a' => true ) );
		$this->assertTrue( $caps->allows( 'feature.a' ) );
	}

	public function test_allows_returns_false_for_disabled_capability(): void {
		$caps = new Capabilities( array( 'feature.a' => false ) );
		$this->assertFalse( $caps->allows( 'feature.a' ) );
	}

	public function test_allows_returns_false_for_unknown_capability(): void {
		$caps = new Capabilities( array() );
		$this->assertFalse( $caps->allows( 'nonexistent' ) );
	}

	// ── all ────────────────────────────────────────────────────────────

	public function test_all_returns_full_map(): void {
		$map  = array( 'a' => true, 'b' => false );
		$caps = new Capabilities( $map );
		$this->assertSame( $map, $caps->all() );
	}

	// ── manage_cap ─────────────────────────────────────────────────────

	public function test_manage_cap_returns_manage_options(): void {
		$caps = new Capabilities( array() );
		$this->assertSame( 'manage_options', $caps->manage_cap() );
	}

	// ── freemium defaults ──────────────────────────────────────────────

	public function test_freemium_defaults_allow_core_actions(): void {
		$caps = new Capabilities();
		$this->assertTrue( $caps->allows( 'actions.save' ) );
		$this->assertTrue( $caps->allows( 'actions.email' ) );
		$this->assertTrue( $caps->allows( 'actions.webhook' ) );
	}

	public function test_freemium_defaults_block_pro_features(): void {
		$caps = new Capabilities();
		$this->assertFalse( $caps->allows( 'actions.payment' ) );
		$this->assertFalse( $caps->allows( 'extensions.custom' ) );
		$this->assertFalse( $caps->allows( 'pipeline.retry' ) );
	}
}
