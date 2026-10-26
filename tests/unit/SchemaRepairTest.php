<?php

// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * QA-08: a multi-step form saved with fields outside every step (form 9) is
 * served with those fields in the first step.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\SchemaRepair;
use SubtleForms\Support\SchemaValidator;

/**
 * @covers \SubtleForms\Support\SchemaRepair
 */
final class SchemaRepairTest extends TestCase {

	private function text( string $key, array $extra = array() ): array {
		return array_merge( array( 'id' => $key, 'key' => $key, 'type' => 'text', 'label' => strtoupper( $key ) ), $extra );
	}

	public function test_form_9_shape_moves_orphans_into_the_empty_step(): void {
		$schema = array(
			'fields' => array(
				$this->text( 'a', array( 'required' => true ) ),
				$this->text( 'b', array( 'logic' => array( 'action' => 'show', 'rules' => array( array( 'field' => 'a' ) ) ) ) ),
				array( 'id' => 's1', 'type' => 'step', 'title' => 'Step 1' ),
			),
		);
		list( $fixed, $moved ) = SchemaRepair::moveOrphansIntoFirstStep( $schema );
		$this->assertSame( 2, $moved );
		$this->assertCount( 1, $fixed['fields'] );
		$this->assertSame( 'step', $fixed['fields'][0]['type'] );
		$this->assertSame( array( 'a', 'b' ), array_column( $fixed['fields'][0]['children'], 'key' ) );
		$this->assertTrue( $fixed['fields'][0]['children'][0]['required'] );
		$this->assertSame( 'a', $fixed['fields'][0]['children'][1]['logic']['rules'][0]['field'] );
	}

	public function test_orphans_after_the_first_step_are_appended_in_order(): void {
		$schema = array(
			'fields' => array(
				$this->text( 'a' ),
				array( 'id' => 's1', 'type' => 'step', 'children' => array( $this->text( 'x' ) ) ),
				$this->text( 'b' ),
				array( 'id' => 's2', 'type' => 'step', 'children' => array( $this->text( 'y' ) ) ),
				$this->text( 'c' ),
			),
		);
		list( $fixed, $moved ) = SchemaRepair::moveOrphansIntoFirstStep( $schema );
		$this->assertSame( 3, $moved );
		$this->assertSame( array( 'a', 'x', 'b', 'c' ), array_column( $fixed['fields'][0]['children'], 'key' ) );
		$this->assertSame( array( 'y' ), array_column( $fixed['fields'][1]['children'], 'key' ) );
	}

	public function test_legacy_fields_key_is_kept(): void {
		$schema = array(
			'fields' => array(
				$this->text( 'a' ),
				array( 'id' => 's1', 'type' => 'step', 'fields' => array( $this->text( 'x' ) ) ),
			),
		);
		list( $fixed ) = SchemaRepair::moveOrphansIntoFirstStep( $schema );
		$this->assertSame( array( 'a', 'x' ), array_column( $fixed['fields'][0]['fields'], 'key' ) );
	}

	public function test_valid_schemas_are_untouched(): void {
		$flat = array( 'fields' => array( $this->text( 'a' ), $this->text( 'b' ) ) );
		$this->assertSame( array( $flat, 0 ), SchemaRepair::moveOrphansIntoFirstStep( $flat ) );
		$steps = array( 'fields' => array( array( 'id' => 's', 'type' => 'step', 'children' => array( $this->text( 'a' ) ) ) ) );
		$this->assertSame( array( $steps, 0 ), SchemaRepair::moveOrphansIntoFirstStep( $steps ) );
		$this->assertSame( $steps, SchemaRepair::repair( $steps, 9 ) );
	}

	public function test_rcompat02_keyless_input_in_a_step_gets_a_unique_valid_key(): void {
		$schema = array(
			'fields' => array(
				array( 'id' => 's1', 'key' => 's1', 'type' => 'step', 'children' => array(
					$this->text( 'name' ),
					array( 'id' => 'f_fee_nokey', 'type' => 'text', 'label' => 'No key' ),
					array( 'type' => 'email', 'label' => 'Anonymous' ),
					array( 'type' => 'heading', 'label' => 'Layout only' ),
				) ),
			),
		);
		list( $fixed, $added ) = SchemaRepair::assignMissingKeys( $schema );
		$kids = $fixed['fields'][0]['children'];
		$this->assertSame( 2, $added );
		$this->assertSame( 'f_fee_nokey', $kids[1]['key'] );
		$this->assertMatchesRegularExpression( SchemaValidator::KEY_PATTERN, $kids[2]['key'] );
		$this->assertStringStartsWith( 'email_', $kids[2]['key'] );
		$this->assertArrayNotHasKey( 'key', $kids[3] );
		$this->assertSame( 'name', $kids[0]['key'] );
		$this->assertCount( 4, array_unique( array( $kids[0]['key'], $kids[1]['key'], $kids[2]['key'], 's1' ) ) );
		$this->assertSame( array(), SchemaValidator::nestedKeyProblems( $fixed ) );
		$this->assertSame( array( $fixed, 0 ), SchemaRepair::assignMissingKeys( $fixed ) );
	}

	public function test_rcompat02_id_that_clashes_gets_a_generated_key_and_top_level_always_gets_one(): void {
		$schema = array(
			'fields' => array(
				$this->text( 'dup' ),
				array( 'id' => 'dup', 'type' => 'text' ),
				array( 'type' => 'html' ),
				array( 'id' => 'a', 'type' => 'two_column_container', 'columns' => array( array( 'fields' => array( array( 'type' => 'number' ) ) ) ) ),
			),
		);
		list( $fixed, $added ) = SchemaRepair::assignMissingKeys( $schema );
		$this->assertSame( 4, $added );
		$this->assertNotSame( 'dup', $fixed['fields'][1]['key'] );
		$this->assertStringStartsWith( 'text_', $fixed['fields'][1]['key'] );
		$this->assertStringStartsWith( 'html_', $fixed['fields'][2]['key'] );
		$this->assertStringStartsWith( 'number_', $fixed['fields'][3]['columns'][0]['fields'][0]['key'] );
		$schema['schema_version'] = 1;
		$fixed['schema_version']  = 1;
		$fixed['metadata']        = array( 'name' => 'T' );
		$this->assertTrue( ( new SchemaValidator() )->validate( $fixed ) );
	}
}
