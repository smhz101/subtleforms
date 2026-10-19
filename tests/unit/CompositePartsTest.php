<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * Name and Address part settings are saved as a keyed map (FB-01) and the
 * server demands the same parts as the browser (FB-10).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Fields\CompositeParts;
use SubtleForms\Validation\RequestValidator;
use SubtleForms\Validation\Schemas;

final class CompositePartsTest extends TestCase {

	private function saved( array $schema ): array {
		$validator = new RequestValidator( array( 'schemas' => Schemas::all() ) );
		$out       = $validator->validateOrFail(
			array(
				'activate' => true,
				'schema'   => $schema,
			),
			Schemas::get( Schemas::FORM_SCHEMA_SAVE )
		);
		return $out['schema'];
	}

	private function errors( array $fields, array $payload ): array {
		return ( new FieldValidator() )->validate( array( 'fields' => $fields ), $payload, array() )['errors'];
	}

	public function test_fb01_part_settings_keep_their_keys_on_save(): void {
		$parts = array(
			'first_name'  => array( 'enabled' => true, 'label' => 'Given name', 'placeholder' => '' ),
			'last_name'   => array( 'enabled' => true, 'label' => 'Family name', 'placeholder' => '' ),
			'middle_name' => array( 'enabled' => true, 'label' => 'Middle Name', 'placeholder' => '' ),
			'suffix'      => array( 'enabled' => true, 'label' => 'Suffix', 'placeholder' => '' ),
		);
		$schema = $this->saved(
			array(
				'fields' => array(
					array( 'type' => 'name_group', 'key' => 'nm', 'label' => 'Name', 'fields' => $parts ),
					array(
						'type'   => 'step',
						'id'     => 's1',
						'fields' => array( array( 'type' => 'text', 'key' => 't', 'label' => 'T' ) ),
					),
				),
			)
		);
		$this->assertSame( array( 'first_name', 'last_name', 'middle_name', 'suffix' ), array_keys( $schema['fields'][0]['fields'] ) );
		$this->assertTrue( $schema['fields'][0]['fields']['suffix']['enabled'] );
		$this->assertSame( 'Given name', $schema['fields'][0]['fields']['first_name']['label'] );
		// A real nested field list is still a list.
		$this->assertSame( 't', $schema['fields'][1]['fields'][0]['key'] );
	}

	public function test_fb01_a_list_saved_without_keys_is_read_back_by_label_then_position(): void {
		$map = CompositeParts::settingsMap(
			'address_group',
			array(
				array( 'label' => 'Street Address', 'enabled' => true ),
				array( 'label' => 'Apartment', 'enabled' => true ),
				array( 'label' => 'City', 'enabled' => true ),
				array( 'label' => 'State / Province', 'enabled' => true ),
				array( 'label' => 'Postal Code', 'enabled' => true ),
				array( 'label' => 'Country', 'enabled' => false ),
			)
		);
		$this->assertSame( 'Apartment', $map['street2']['label'] );
		$this->assertFalse( $map['country']['enabled'] );
	}

	public function test_fb10_required_name_needs_first_and_last(): void {
		$fields = array( array( 'type' => 'name_group', 'key' => 'nm', 'label' => 'Name', 'required' => true ) );
		$this->assertArrayHasKey( 'nm', $this->errors( $fields, array( 'nm' => array( 'first_name' => 'Ada' ) ) ) );
		$this->assertArrayNotHasKey( 'nm', $this->errors( $fields, array( 'nm' => array( 'first_name' => 'Ada', 'last_name' => 'Lovelace' ) ) ) );
	}

	public function test_fb10_required_address_needs_every_part_it_draws(): void {
		$fields = array( array( 'type' => 'address_group', 'key' => 'addr', 'label' => 'Address', 'required' => true ) );
		$this->assertArrayHasKey( 'addr', $this->errors( $fields, array( 'addr' => array( 'city' => 'X' ) ) ) );
		$full = array( 'street_address' => '1 Way', 'city' => 'X', 'state' => 'Y', 'postal_code' => '1', 'country' => 'PK' );
		$this->assertArrayNotHasKey( 'addr', $this->errors( $fields, array( 'addr' => $full ) ) );

		// A part switched off in the builder is not demanded.
		$fields[0]['fields'] = array(
			'country' => array( 'enabled' => false ),
			'state'   => array( 'enabled' => false ),
		);
		$this->assertArrayNotHasKey( 'addr', $this->errors( $fields, array( 'addr' => array( 'street_address' => '1 Way', 'city' => 'X', 'postal_code' => '1' ) ) ) );
	}
}
