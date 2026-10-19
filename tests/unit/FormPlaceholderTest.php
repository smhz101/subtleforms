<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * UX2-27: the form container starts at the estimated height of the form's
 * first page, so the page does not jump when the form appears.
 *
 * @package SubtleForms\Tests
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Frontend\FormPlaceholder;

final class FormPlaceholderTest extends TestCase {

	/** The "Project inquiry" demo form: two half-width rows, choices, a hidden-by-logic dropdown. */
	private function inquiry(): array {
		return array(
			'metadata' => array( 'type' => 'regular' ),
			'fields'   => array(
				array( 'type' => 'text', 'appearance' => array( 'width' => '50' ) ),
				array( 'type' => 'text', 'appearance' => array( 'width' => '50' ) ),
				array( 'type' => 'email', 'appearance' => array( 'width' => '50' ) ),
				array( 'type' => 'text', 'appearance' => array( 'width' => '50' ) ),
				array( 'type' => 'radio', 'options' => array( array(), array(), array() ) ),
				array(
					'type'  => 'select',
					'logic' => array( 'action' => 'show', 'groups' => array( array( 'rules' => array( array() ) ) ) ),
				),
				array( 'type' => 'textarea' ),
				array( 'type' => 'consent' ),
			),
		);
	}

	public function test_estimate_matches_the_drawn_form(): void {
		$h = FormPlaceholder::estimate( $this->inquiry() );
		// Measured in the browser: 806px wide, 1038px at 390px.
		$this->assertEqualsWithDelta( 806, $h['wide'], 20 );
		$this->assertEqualsWithDelta( 1038, $h['narrow'], 30 );
	}

	public function test_a_field_shown_by_logic_does_not_count(): void {
		$schema = $this->inquiry();
		$without = FormPlaceholder::estimate( $schema )['wide'];
		unset( $schema['fields'][5]['logic'] );
		$with = FormPlaceholder::estimate( $schema )['wide'];
		$this->assertGreaterThan( $without, $with );
	}

	public function test_only_the_first_step_counts(): void {
		$one   = array( 'fields' => array( array( 'type' => 'step', 'fields' => array( array( 'type' => 'text' ) ) ) ) );
		$three = array(
			'fields' => array(
				array( 'type' => 'step', 'fields' => array( array( 'type' => 'text' ) ) ),
				array( 'type' => 'step', 'fields' => array( array( 'type' => 'textarea' ), array( 'type' => 'textarea' ) ) ),
			),
		);
		$this->assertSame( FormPlaceholder::estimate( $one ), FormPlaceholder::estimate( $three ) );

		$breaks = array( 'fields' => array( array( 'type' => 'text' ), array( 'type' => 'form_step' ), array( 'type' => 'textarea' ) ) );
		$this->assertSame( FormPlaceholder::estimate( $one ), FormPlaceholder::estimate( $breaks ) );
	}

	public function test_columns_take_the_tallest_column_on_a_wide_screen(): void {
		$cols = array(
			'fields' => array(
				array(
					'type'    => 'columns',
					'columns' => array(
						array( 'fields' => array( array( 'type' => 'text' ) ) ),
						array( 'fields' => array( array( 'type' => 'textarea' ) ) ),
					),
				),
			),
		);
		$single = array( 'fields' => array( array( 'type' => 'textarea' ) ) );
		$this->assertSame( FormPlaceholder::estimate( $single )['wide'], FormPlaceholder::estimate( $cols )['wide'] );
		$this->assertGreaterThan( FormPlaceholder::estimate( $single )['narrow'], FormPlaceholder::estimate( $cols )['narrow'] );
	}

	public function test_conversational_forms_keep_one_question(): void {
		$h = FormPlaceholder::estimate( array( 'metadata' => array( 'type' => 'conversational' ), 'fields' => array_fill( 0, 20, array( 'type' => 'text' ) ) ) );
		$this->assertSame( 525, $h['wide'] );
	}

	public function test_hidden_fields_draw_nothing_and_a_huge_form_is_capped(): void {
		$hidden = FormPlaceholder::estimate( array( 'fields' => array( array( 'type' => 'hidden' ), array( 'type' => 'text' ) ) ) );
		$plain  = FormPlaceholder::estimate( array( 'fields' => array( array( 'type' => 'text' ) ) ) );
		$this->assertSame( $plain, $hidden );

		$huge = FormPlaceholder::estimate( array( 'fields' => array_fill( 0, 200, array( 'type' => 'textarea' ) ) ) );
		$this->assertSame( 4000, $huge['wide'] );
	}

	public function test_attributes(): void {
		$attr = FormPlaceholder::attributes( $this->inquiry() );
		$this->assertMatchesRegularExpression( '/^ data-reserve="1" style="--subtleforms-reserve:\d+px;--subtleforms-reserve-narrow:\d+px"$/', $attr );
		$this->assertSame( '', FormPlaceholder::attributes( null ) );
	}
}
