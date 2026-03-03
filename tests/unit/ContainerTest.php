<?php
/**
 * Unit tests for SubtleForms\Container
 *
 * @package SubtleForms\Tests\Unit
 * @since   1.9.0
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Container;

/**
 * @covers \SubtleForms\Container
 */
final class ContainerTest extends TestCase {

	private Container $container;

	protected function setUp(): void {
		parent::setUp();
		$this->container = new Container();
	}

	// ── register / get ─────────────────────────────────────────────────

	public function test_register_and_get(): void {
		$this->container->register( 'greeting', fn() => 'hello' );
		$this->assertSame( 'hello', $this->container->get( 'greeting' ) );
	}

	public function test_get_unknown_service_throws(): void {
		$this->expectException( \RuntimeException::class );
		$this->expectExceptionMessage( "Service 'nope' not found" );
		$this->container->get( 'nope' );
	}

	public function test_register_returns_new_instance_each_time(): void {
		$this->container->register( 'obj', fn() => new \stdClass() );
		$a = $this->container->get( 'obj' );
		$b = $this->container->get( 'obj' );
		$this->assertNotSame( $a, $b );
	}

	// ── singleton ──────────────────────────────────────────────────────

	public function test_singleton_returns_same_instance(): void {
		$this->container->singleton( 'obj', fn() => new \stdClass() );
		$a = $this->container->get( 'obj' );
		$b = $this->container->get( 'obj' );
		$this->assertSame( $a, $b );
	}

	// ── has ────────────────────────────────────────────────────────────

	public function test_has_returns_false_for_unknown(): void {
		$this->assertFalse( $this->container->has( 'nope' ) );
	}

	public function test_has_returns_true_after_register(): void {
		$this->container->register( 'x', fn() => 1 );
		$this->assertTrue( $this->container->has( 'x' ) );
	}

	// ── set (Phase 1.3) ───────────────────────────────────────────────

	public function test_set_injects_instance(): void {
		$obj = new \stdClass();
		$obj->tag = 'injected';
		$this->container->set( 'obj', $obj );
		$this->assertSame( $obj, $this->container->get( 'obj' ) );
	}

	public function test_set_overrides_factory(): void {
		$this->container->singleton( 'val', fn() => 'from_factory' );
		$this->container->set( 'val', 'from_set' );
		$this->assertSame( 'from_set', $this->container->get( 'val' ) );
	}

	public function test_set_makes_service_visible_to_has(): void {
		$this->container->set( 'x', 42 );
		$this->assertTrue( $this->container->has( 'x' ) );
	}

	// ── forgetInstance ─────────────────────────────────────────────────

	public function test_forget_instance_causes_re_resolution(): void {
		$calls = 0;
		$this->container->singleton( 'counter', function () use ( &$calls ) {
			return ++$calls;
		} );

		$this->assertSame( 1, $this->container->get( 'counter' ) );
		$this->assertSame( 1, $this->container->get( 'counter' ) ); // cached

		$this->container->forgetInstance( 'counter' );
		$this->assertSame( 2, $this->container->get( 'counter' ) ); // re-resolved
	}

	// ── reset ──────────────────────────────────────────────────────────

	public function test_reset_clears_everything(): void {
		$this->container->singleton( 'a', fn() => 1 );
		$this->container->get( 'a' ); // cache it

		$this->container->reset();

		$this->assertFalse( $this->container->has( 'a' ) );
		$this->expectException( \RuntimeException::class );
		$this->container->get( 'a' );
	}

	// ── factory receives container ─────────────────────────────────────

	public function test_factory_receives_container(): void {
		$this->container->singleton( 'dep', fn() => 42 );
		$this->container->register( 'svc', fn( $c ) => $c->get( 'dep' ) * 2 );
		$this->assertSame( 84, $this->container->get( 'svc' ) );
	}
}
