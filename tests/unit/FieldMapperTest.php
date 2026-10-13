<?php
/**
 * Unit tests for the integration field mapping helpers.
 *
 * @package SubtleForms\Tests
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\FieldMapper;

/**
 * @covers \SubtleForms\Support\FieldMapper
 */
class FieldMapperTest extends TestCase {

	private function schema(): array {
		return array(
			'fields' => array(
				array(
					'type'   => 'step',
					'title'  => 'About you',
					'fields' => array(
						array(
							'type'   => 'name_group',
							'key'    => 'full_name',
							'fields' => array(
								'first_name' => array( 'enabled' => true, 'label' => 'First' ),
								'last_name'  => array( 'enabled' => true, 'label' => 'Last' ),
							),
							'label' => 'Your name',
						),
						array(
							'type'  => 'email',
							'key'   => 'work_email',
							'label' => 'Work email',
						),
					),
				),
				array(
					'type'    => 'checkbox_grid',
					'key'     => 'matrix',
					'label'   => 'Rate us',
					'columns' => array( 'Poor', 'Good' ),
					'rows'    => array( 'Speed' ),
				),
				array(
					'type'     => 'toggle',
					'key'      => 'newsletter',
					'label'    => 'Newsletter',
					'onValue'  => 'yes',
					'offValue' => 'no',
				),
				array(
					'type'  => 'heading',
					'key'   => 'h1',
					'label' => 'Ignored',
				),
				array(
					'type'     => 'two_column_container',
					'key'      => 'cols',
					'columns'  => array(
						array( array( 'type' => 'text', 'key' => 'company', 'label' => 'Company' ) ),
						array(),
					),
				),
			),
		);
	}

	public function test_fields_walks_containers_and_skips_layout(): void {
		$keys = array_column( FieldMapper::fields( $this->schema() ), 'key' );
		$this->assertSame( array( 'full_name', 'work_email', 'matrix', 'newsletter', 'company' ), $keys );
	}

	public function test_value_resolves_sub_keys_and_lists(): void {
		$payload = array(
			'full_name'  => array( 'first_name' => 'Ada', 'last_name' => 'Lovelace' ),
			'work_email' => ' ada@example.com ',
			'tags'       => array( 'a', 'b' ),
			'dotted.key' => 'kept',
		);

		$this->assertSame( 'Ada', FieldMapper::value( $payload, 'full_name.first_name' ) );
		$this->assertSame( 'Lovelace', FieldMapper::value( $payload, 'full_name.last_name' ) );
		$this->assertSame( 'Ada Lovelace', FieldMapper::value( $payload, 'full_name' ) );
		$this->assertSame( 'ada@example.com', FieldMapper::value( $payload, 'work_email' ) );
		$this->assertSame( 'a, b', FieldMapper::value( $payload, 'tags' ) );
		$this->assertSame( 'kept', FieldMapper::value( $payload, 'dotted.key' ) );
		$this->assertSame( '', FieldMapper::value( $payload, 'missing' ) );
		$this->assertSame( '', FieldMapper::value( $payload, 'full_name.middle' ) );
	}

	public function test_to_text_handles_nested_structures(): void {
		$this->assertSame( 'Speed: Good', FieldMapper::toText( array( 'Speed' => array( 'Good' ) ) ) );
		$this->assertSame( 'Yes', FieldMapper::toText( true ) );
		$this->assertSame( '', FieldMapper::toText( null ) );
		$this->assertSame( '3', FieldMapper::toText( 3 ) );
	}

	public function test_is_checked(): void {
		$toggle = $this->schema()['fields'][2];

		$this->assertTrue( FieldMapper::isChecked( true ) );
		$this->assertTrue( FieldMapper::isChecked( '1' ) );
		$this->assertTrue( FieldMapper::isChecked( 'on' ) );
		$this->assertTrue( FieldMapper::isChecked( array( 'I agree' ) ) );
		$this->assertTrue( FieldMapper::isChecked( 'yes', $toggle ) );
		$this->assertFalse( FieldMapper::isChecked( 'no', $toggle ) );
		$this->assertFalse( FieldMapper::isChecked( '' ) );
		$this->assertFalse( FieldMapper::isChecked( '0' ) );
		$this->assertFalse( FieldMapper::isChecked( false ) );
		$this->assertFalse( FieldMapper::isChecked( array() ) );
		$this->assertFalse( FieldMapper::isChecked( null ) );
	}

	public function test_defaults_detects_email_and_name(): void {
		$this->assertSame(
			array(
				'email'      => 'work_email',
				'first_name' => 'full_name.first_name',
				'last_name'  => 'full_name.last_name',
			),
			FieldMapper::defaults( $this->schema() )
		);

		$plain = array(
			'fields' => array(
				array( 'type' => 'text', 'key' => 'first_name', 'label' => 'First' ),
				array( 'type' => 'text', 'key' => 'surname', 'label' => 'Last' ),
				array( 'type' => 'text', 'key' => 'email', 'label' => 'Email' ),
			),
		);
		$this->assertSame(
			array(
				'email'      => 'email',
				'first_name' => 'first_name',
				'last_name'  => 'surname',
			),
			FieldMapper::defaults( $plain )
		);
	}

	public function test_option_labels(): void {
		$field = array(
			'options' => array(
				array( 'label' => 'VIP seat', 'value' => 'vip' ),
				array( 'label' => 'Lunch', 'value' => 'lunch' ),
			),
		);
		$this->assertSame( 'VIP seat', FieldMapper::optionLabels( 'vip', $field ) );
		$this->assertSame( array( 'Lunch', 'other' ), FieldMapper::optionLabels( array( 'lunch', 'other' ), $field ) );
		$this->assertSame( 'x', FieldMapper::optionLabels( 'x', array() ) );
	}

	public function test_defaults_use_a_single_full_name_field(): void {
		$schema = array( 'fields' => array( array( 'type' => 'text', 'key' => 'name', 'label' => 'Full name' ) ) );
		$this->assertSame( 'name', FieldMapper::defaults( $schema )['first_name'] );
		$this->assertSame( '', FieldMapper::defaults( $schema )['last_name'] );
	}

	public function test_split_name(): void {
		$this->assertSame( array( 'Ada', 'King Lovelace' ), FieldMapper::splitName( '  Ada   King Lovelace ' ) );
		$this->assertSame( array( 'Cher', '' ), FieldMapper::splitName( 'Cher' ) );
		$this->assertSame( array( '', '' ), FieldMapper::splitName( '' ) );
	}

	public function test_map_rows_skips_blank_values(): void {
		$payload = array(
			'phone'   => '555',
			'company' => '',
		);
		$rows    = array(
			array( 'field' => 'phone', 'target' => 'PHONE' ),
			array( 'field' => 'company', 'target' => 'COMPANY' ),
			array( 'field' => '', 'target' => 'X' ),
			array( 'field' => 'phone', 'target' => '' ),
		);
		$this->assertSame( array( 'PHONE' => '555' ), FieldMapper::mapRows( $payload, $rows ) );
	}

	public function test_answers_follow_form_order_and_append_unknown_keys(): void {
		$payload = array(
			'extra_note' => 'hi',
			'newsletter' => 'yes',
			'work_email' => 'a@b.co',
			'website_url' => '',
			'_coupon'    => 'X',
		);
		$rows    = FieldMapper::answers( $this->schema(), $payload );
		$this->assertSame( array( 'work_email', 'newsletter', 'extra_note' ), array_column( $rows, 'key' ) );
		$this->assertSame( 'Work email', $rows[0]['label'] );
		$this->assertSame( 'Extra Note', $rows[2]['label'] );
	}
}
