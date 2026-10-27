<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * A required chained field needs every level that offers choices (FLD2-10).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;

final class ChainedRequiredTest extends TestCase {

	private function errors( array $field, $value ): array {
		$schema = array( 'fields' => array( $field ) );
		return ( new FieldValidator() )->validate( $schema, array( 'car' => $value ), array() )['errors'];
	}

	private function levels(): array {
		return array(
			'type'     => 'chained_select',
			'key'      => 'car',
			'label'    => 'Car',
			'required' => true,
			'levels'   => array(
				array(
					'label'   => 'Make',
					'options' => array(
						array( 'label' => 'Toyota', 'value' => 'toyota' ),
						array( 'label' => 'Kia', 'value' => 'kia' ),
					),
				),
				array(
					'label'   => 'Model',
					'options' => array( array( 'label' => 'Corolla', 'value' => 'corolla', 'parent' => 'toyota' ) ),
				),
			),
		);
	}

	public function test_only_the_first_level_is_not_enough(): void {
		$this->assertArrayHasKey( 'car', $this->errors( $this->levels(), array( 'toyota' ) ) );
	}

	public function test_every_level_with_choices_answered_passes(): void {
		$this->assertArrayNotHasKey( 'car', $this->errors( $this->levels(), array( 'toyota', 'corolla' ) ) );
		// Kia has no models: one answer is complete.
		$this->assertArrayNotHasKey( 'car', $this->errors( $this->levels(), array( 'kia' ) ) );
	}

	public function test_an_answer_that_is_not_a_choice_does_not_count(): void {
		$this->assertArrayHasKey( 'car', $this->errors( $this->levels(), array( 'toyota', 'civic' ) ) );
		$this->assertArrayHasKey( 'car', $this->errors( $this->levels(), array() ) );
	}

	public function test_tree_options_need_the_next_level_too(): void {
		$field = array(
			'type'     => 'chained_select',
			'key'      => 'car',
			'required' => true,
			'options'  => array(
				array(
					'label'    => 'Toyota',
					'value'    => 'toyota',
					'children' => array( array( 'label' => 'Corolla', 'value' => 'corolla' ) ),
				),
			),
		);
		$this->assertArrayHasKey( 'car', $this->errors( $field, array( 'toyota' ) ) );
		$this->assertArrayNotHasKey( 'car', $this->errors( $field, array( 'toyota', 'corolla' ) ) );
	}

	/**
	 * RFUN-02: dropdowns that are not set up are not drawn, so the field is
	 * not required and nothing is stored for it.
	 */
	public function test_a_field_with_no_dropdowns_is_never_required(): void {
		foreach ( array(
			array(),
			array( 'levels' => array() ),
			array( 'levels' => array( array( 'label' => 'Make', 'options' => array() ) ) ),
			array( 'options' => array() ),
			array( 'config' => array( 'levels' => array( array( 'options' => array() ) ) ) ),
		) as $extra ) {
			$field = array_merge( array( 'type' => 'chained_select', 'key' => 'car', 'required' => true ), $extra );
			$this->assertArrayNotHasKey( 'car', $this->errors( $field, null ) );
			$this->assertArrayNotHasKey( 'car', $this->errors( $field, array() ) );
		}
	}

	public function test_a_field_with_dropdowns_still_refuses_an_empty_answer(): void {
		foreach ( array( null, '', array(), array( '' ) ) as $empty ) {
			$this->assertArrayHasKey( 'car', $this->errors( $this->levels(), $empty ) );
		}
	}

	public function test_the_conditional_state_treats_an_unset_field_as_not_shown(): void {
		$logic  = new \SubtleForms\Engine\ConditionalLogic();
		$empty  = array( 'type' => 'chained_select', 'key' => 'car', 'required' => true );
		$schema = array( 'fields' => array( $empty ) );
		$state  = $logic->evaluate( $schema, array( 'car' => array( 'toyota' ) ) );
		$this->assertContains( 'car', $state['hidden_fields'] );
		$this->assertSame( array(), $logic->visiblePayload( $schema, array( 'car' => array( 'toyota' ) ) ) );

		$schema = array( 'fields' => array( $this->levels() ) );
		$state  = $logic->evaluate( $schema, array() );
		$this->assertNotContains( 'car', $state['hidden_fields'] );
		$result = ( new FieldValidator() )->validate( $schema, array(), $state );
		$this->assertArrayHasKey( 'car', $result['errors'] );
	}
}
