<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Add-ons add parts to the Address field (Free 101): the filter, the data
 * flag, what is stored, how it reads as text and the validate_value hook.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\Actions\SaveAction;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Fields\CompositeParts;
use SubtleForms\Support\AnswerFormatter;
use SubtleForms\Support\FieldMapper;
use SubtleForms\Support\MergeTags;

final class CompositePartsFilterTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['sf_test_filters'] = array();
		CompositeParts::resetCache();
	}

	protected function tearDown(): void {
		$GLOBALS['sf_test_filters'] = array();
		CompositeParts::resetCache();
		parent::tearDown();
	}

	private function addParts( array $extra, string $hook = 'subtleforms/fields/composite_parts' ): void {
		$GLOBALS['sf_test_filters'][ $hook ] = static function ( $parts, $type = '' ) use ( $extra ) {
			return 'address_group' === $type ? array_merge( $parts, $extra ) : $parts;
		};
		CompositeParts::resetCache();
	}

	private function latLng(): array {
		return array(
			array( 'part' => 'lat', 'value' => 'lat', 'data' => true ),
			array( 'part' => 'lng', 'value' => 'lng', 'data' => true ),
		);
	}

	private function values( string $type, array $field = array() ): array {
		return array_column( CompositeParts::parts( $type, $field ), 'value' );
	}

	private function normalise( $value, string $type = 'address_group' ): array {
		$action = ( new \ReflectionClass( SaveAction::class ) )->newInstanceWithoutConstructor();
		$method = new \ReflectionMethod( SaveAction::class, 'normalize_composite_value' );
		$method->setAccessible( true );
		return $method->invoke( $action, $value, $type );
	}

	// Parts filter.

	public function test_a_filtered_in_part_is_returned_by_parts(): void {
		$this->addParts( $this->latLng() );
		$this->assertSame(
			array( 'street_address', 'city', 'state', 'postal_code', 'country', 'lat', 'lng' ),
			$this->values( 'address_group' )
		);
		$this->assertTrue( CompositeParts::parts( 'address_group', array() )[5]['data'] );
		$this->assertSame( array( 'first_name', 'last_name' ), $this->values( 'name_group' ) );
	}

	public function test_invalid_shapes_are_dropped(): void {
		$this->addParts(
			array(
				'city',
				null,
				array( 'part' => 'Bad-Name', 'value' => 'x' ),
				array( 'part' => 'ok' ),
				array( 'part' => 7, 'value' => 'seven' ),
				array( 'part' => 'upper', 'value' => 'Upper' ),
				array( 'part' => 'apartment', 'value' => 'apartment', 'optional' => true ),
			)
		);
		$this->assertSame(
			array( 'street_address', 'city', 'state', 'postal_code', 'country', 'apartment' ),
			$this->values( 'address_group' )
		);
	}

	public function test_built_in_parts_cannot_be_replaced_or_removed(): void {
		$GLOBALS['sf_test_filters']['subtleforms/fields/composite_parts'] = static function ( $parts ) {
			$parts   = array_slice( $parts, 1 );
			$parts[] = array( 'part' => 'city', 'value' => 'town', 'label' => 'Town', 'data' => true );
			$parts[] = array( 'part' => 'region', 'value' => 'state' );
			$parts[] = array( 'part' => 'zip', 'value' => 'zip', 'alias' => 'postal' );
			return $parts;
		};
		CompositeParts::resetCache();
		$this->assertSame(
			array( 'street_address', 'city', 'state', 'postal_code', 'country' ),
			$this->values( 'address_group' )
		);
		$this->assertNotContains( 'town', CompositeParts::knownKeys( 'address_group' ) );
	}

	public function test_missing_ignores_data_parts_and_optional_parts(): void {
		$this->addParts( $this->latLng() );
		$full = array( 'street_address' => 'a', 'city' => 'b', 'state' => 'c', 'postal_code' => 'd', 'country' => 'e' );
		$this->assertSame( array(), CompositeParts::missing( 'address_group', array(), $full ) );
		$this->assertSame( array( 'city' ), CompositeParts::missing( 'address_group', array(), array_merge( $full, array( 'city' => '' ) ) ) );
	}

	public function test_reset_cache_picks_up_a_filter_added_later(): void {
		$this->assertNotContains( 'lat', CompositeParts::knownKeys( 'address_group' ) );
		$this->addParts( $this->latLng(), 'subtleforms/fields/composite_parts' );
		$this->assertContains( 'lat', CompositeParts::knownKeys( 'address_group' ) );
		$GLOBALS['sf_test_filters'] = array();
		$this->assertContains( 'lat', CompositeParts::knownKeys( 'address_group' ), 'Cached for the request.' );
		CompositeParts::resetCache();
		$this->assertNotContains( 'lat', CompositeParts::knownKeys( 'address_group' ) );
	}

	// Normalisation on save.

	public function test_lat_and_lng_are_kept_when_added_through_the_filter(): void {
		$this->addParts( $this->latLng() );
		$out = $this->normalise( array( 'city' => 'Lahore', 'lat' => '31.5', 'lng' => '74.3' ) );
		$this->assertSame( array( 'city' => 'Lahore', 'lat' => '31.5', 'lng' => '74.3' ), $out );
	}

	public function test_unknown_keys_are_dropped(): void {
		$out = $this->normalise( array( 'city' => 'Lahore', 'evil' => 'x', 'lat' => '1' ) );
		$this->assertSame( array( 'city' => 'Lahore' ), $out );
	}

	public function test_aliases_are_kept_under_their_own_keys(): void {
		$out = $this->normalise( array( 'street' => '1 Main', 'street2' => 'Flat 2', 'postal' => '54000', 'street_address' => '2 Main' ) );
		$this->assertSame( array( 'street' => '1 Main', 'street2' => 'Flat 2', 'postal' => '54000', 'street_address' => '2 Main' ), $out );
	}

	public function test_name_group_is_unchanged(): void {
		$this->addParts( $this->latLng() );
		$out = $this->normalise( array( 'first_name' => 'Ada', 'last_name' => 'Lovelace', 'lat' => '1' ), 'name_group' );
		$this->assertSame( array( 'first_name' => 'Ada', 'last_name' => 'Lovelace' ), $out );
		$this->assertSame( array(), $this->normalise( 'nope' ) );
	}

	// Display text.

	public function test_address_text_uses_part_order_skips_data_parts_and_empties(): void {
		$this->addParts( $this->latLng() );
		$field = array( 'type' => 'address_group', 'key' => 'addr' );
		$value = array(
			'country'        => 'Pakistan',
			'lat'            => '31.5',
			'city'           => 'Lahore',
			'street_address' => '1 Main',
			'state'          => '',
			'postal_code'    => '54000',
			'lng'            => '74.3',
		);
		$this->assertSame( '1 Main, Lahore, 54000, Pakistan', AnswerFormatter::address( $value, $field ) );
		$this->assertSame( '1 Main, Lahore, 54000, Pakistan', AnswerFormatter::text( $value, $field ) );
	}

	public function test_address_text_reads_aliases_and_a_part_added_by_an_add_on(): void {
		$this->addParts( array( array( 'part' => 'landmark', 'value' => 'landmark' ), $this->latLng()[0] ) );
		$field = array( 'type' => 'address_group', 'key' => 'addr' );
		$this->assertSame(
			'1 Main, Flat 2, Lahore, 54000, Near the mosque',
			AnswerFormatter::text(
				array( 'street' => '1 Main', 'street2' => 'Flat 2', 'city' => 'Lahore', 'postal' => '54000', 'landmark' => 'Near the mosque', 'lat' => '1' ),
				$field
			)
		);
	}

	public function test_merge_tag_gives_the_same_text_when_the_field_is_listed(): void {
		$this->addParts( $this->latLng() );
		$schema = array( 'fields' => array( array( 'key' => 'addr', 'type' => 'address_group', 'label' => 'Address' ) ) );
		$value  = array( 'street_address' => '1 Main', 'city' => 'Lahore', 'lat' => '31.5', 'lng' => '74.3' );
		$ctx    = array( 'answers' => array( 'addr' => $value ), 'fields' => FieldMapper::fields( $schema ) );
		$this->assertSame( '1 Main, Lahore', MergeTags::render( '{field:addr}', $ctx, false ) );
		$this->assertSame( 'Address: 1 Main, Lahore', MergeTags::render( '{all_fields}', $ctx, false ) );
	}

	private function addNameParts(): void {
		$GLOBALS['sf_test_filters']['subtleforms/fields/composite_parts'] = static function ( $parts, $type = '' ) {
			return 'name_group' === $type
				? array_merge(
					$parts,
					array(
						array( 'part' => 'title', 'value' => 'title' ),
						array( 'part' => 'prefix', 'value' => 'prefix', 'data' => true ),
					)
				)
				: $parts;
		};
		CompositeParts::resetCache();
	}

	public function test_name_text_is_part_aware(): void {
		$this->addNameParts();
		$field = array( 'type' => 'name_group', 'key' => 'who' );
		$value = array( 'prefix' => 'internal', 'suffix' => 'Jr', 'last_name' => 'Lovelace', 'title' => 'Dr', 'first_name' => 'Ada', 'middle_name' => '' );
		$this->assertSame( 'Ada Lovelace Jr Dr', AnswerFormatter::name( $value, $field ) );
		$this->assertSame( 'Ada Lovelace Jr Dr', AnswerFormatter::text( $value, $field ) );
	}

	public function test_name_merge_tags_use_the_part_aware_formatter(): void {
		$this->addNameParts();
		$schema = array( 'fields' => array( array( 'key' => 'who', 'type' => 'name_group', 'label' => 'Name' ) ) );
		$value  = array( 'first_name' => 'Ada', 'last_name' => 'Lovelace', 'title' => 'Dr', 'prefix' => 'internal' );
		$ctx    = array( 'answers' => array( 'who' => $value ), 'fields' => FieldMapper::fields( $schema ) );
		$this->assertSame( 'Ada Lovelace Dr', MergeTags::render( '{field:who}', $ctx, false ) );
		$this->assertSame( 'Name: Ada Lovelace Dr', MergeTags::render( '{all_fields}', $ctx, false ) );
	}

	public function test_merge_tag_of_another_array_keeps_the_generic_join(): void {
		$schema = array( 'fields' => array( array( 'key' => 'tags', 'type' => 'checkbox', 'label' => 'Tags' ) ) );
		$ctx    = array( 'answers' => array( 'tags' => array( 'a', 'b' ) ), 'fields' => FieldMapper::fields( $schema ) );
		$this->assertSame( 'a, b', MergeTags::render( '{field:tags}', $ctx, false ) );
	}

	// validate_value.

	public function test_validate_value_fires_for_address_group_and_its_error_is_returned(): void {
		$seen = array();
		$GLOBALS['sf_test_filters']['subtleforms/fields/validate_value'] = static function ( $error, $type, $value, $field ) use ( &$seen ) {
			$seen[] = $type;
			return 'address_group' === $type && ( $value['lat'] ?? '' ) === '999' ? 'Latitude is out of range.' : $error;
		};
		$schema = array( 'fields' => array( array( 'key' => 'addr', 'type' => 'address_group', 'label' => 'Address' ) ) );
		$bad    = ( new FieldValidator() )->validate( $schema, array( 'addr' => array( 'city' => 'x', 'lat' => '999' ) ), array() );
		$this->assertContains( 'address_group', $seen );
		$this->assertSame( 'Latitude is out of range.', $bad['errors']['addr'] ?? null );
		$good = ( new FieldValidator() )->validate( $schema, array( 'addr' => array( 'city' => 'x', 'lat' => '31' ) ), array() );
		$this->assertArrayNotHasKey( 'addr', $good['errors'] );
	}
}
