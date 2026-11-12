<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * {field:key:part} merge tags and the subtleforms/merge_tags/value filter.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\FieldMapper;
use SubtleForms\Support\MergeTags;

final class MergeTagPartsTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['sf_test_filters'] = array();
	}

	protected function tearDown(): void {
		$GLOBALS['sf_test_filters'] = array();
		parent::tearDown();
	}

	private function context(): array {
		$schema = array(
			'fields' => array(
				array( 'key' => 'addr', 'type' => 'address_group', 'label' => 'Address' ),
				array( 'key' => 'rep', 'type' => 'repeat_container', 'label' => 'People' ),
			),
		);
		return array(
			'answers' => array(
				'addr' => array( 'street_address' => '1 Main', 'city' => 'Lahore', 'lat' => 31.5, 'nested' => array( 'a' => 'b' ) ),
				'rep'  => array( array( 'city' => 'Lahore' ), array( 'city' => 'Karachi' ) ),
			),
			'fields'  => FieldMapper::fields( $schema ),
		);
	}

	public function test_part_returns_the_scalar(): void {
		$ctx = $this->context();
		$this->assertSame( 'Lahore', MergeTags::render( '{field:addr:city}', $ctx ) );
		$this->assertSame( 'Lahore', MergeTags::render( '{{field:addr:city}}', $ctx ) );
		$this->assertSame( 'Lahore', MergeTags::render( '{addr:city}', $ctx ) );
		$this->assertSame( '31.5', MergeTags::render( '{field:addr:lat}', $ctx ) );
	}

	public function test_missing_or_non_scalar_part_is_empty(): void {
		$ctx = $this->context();
		$this->assertSame( '', MergeTags::render( '{field:addr:nope}', $ctx ) );
		$this->assertSame( '', MergeTags::render( '{field:addr:nested}', $ctx ) );
		$this->assertSame( '', MergeTags::render( '{field:nokey:city}', $ctx ) );
	}

	public function test_plain_tag_is_unchanged(): void {
		$this->assertSame( '1 Main, Lahore', MergeTags::render( '{field:addr}', $this->context() ) );
	}

	public function test_part_on_a_repeater_is_empty(): void {
		$ctx = $this->context();
		$this->assertSame( '', MergeTags::render( '{field:rep:city}', $ctx ) );
		$this->assertSame( '', MergeTags::render( '{field:rep:0}', $ctx ) );
	}

	public function test_bare_tag_with_unknown_key_is_left_as_written(): void {
		$this->assertSame( '{zzz:city}', MergeTags::render( '{zzz:city}', $this->context() ) );
	}

	public function test_filter_short_circuits_with_a_computed_value(): void {
		$seen = array();
		$GLOBALS['sf_test_filters']['subtleforms/merge_tags/value'] = static function ( $custom, $key, $part, $value, $context ) use ( &$seen ) {
			$seen[] = array( $key, $part, $value['city'] ?? null );
			return 'map_url' === $part ? 'https://maps.example/?q=' . $value['lat'] : null;
		};
		$ctx = $this->context();
		$this->assertSame( 'https://maps.example/?q=31.5', MergeTags::render( '{field:addr:map_url}', $ctx ) );
		$this->assertSame( array( array( 'addr', 'map_url', 'Lahore' ) ), $seen );
	}

	public function test_filter_returning_null_falls_through(): void {
		$GLOBALS['sf_test_filters']['subtleforms/merge_tags/value'] = static function () {
			return null;
		};
		$ctx = $this->context();
		$this->assertSame( 'Lahore', MergeTags::render( '{field:addr:city}', $ctx ) );
		$this->assertSame( '1 Main, Lahore', MergeTags::render( '{field:addr}', $ctx ) );
	}

	public function test_filter_gets_an_empty_part_for_a_plain_tag(): void {
		$parts = array();
		$GLOBALS['sf_test_filters']['subtleforms/merge_tags/value'] = static function ( $custom, $key, $part ) use ( &$parts ) {
			$parts[] = $part;
			return null;
		};
		MergeTags::render( '{field:addr}', $this->context() );
		$this->assertSame( array( '' ), $parts );
	}
}
