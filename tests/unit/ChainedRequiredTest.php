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
}
