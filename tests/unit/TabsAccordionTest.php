<?php

// phpcs:disable -- Unit test file; not shipped in production plugin.
namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\ConditionalLogic;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\FieldSettings;
use SubtleForms\Support\FieldMapper;
use SubtleForms\Support\SchemaValidator;

/**
 * Tabs and Accordion (2.9.0): where they may sit, that they take no answer,
 * and that a form without them is untouched.
 *
 * @covers \SubtleForms\Support\SchemaValidator
 * @covers \SubtleForms\Engine\FieldValidator
 * @covers \SubtleForms\Support\FieldMapper
 */
final class TabsAccordionTest extends TestCase {

	private function validator(): SchemaValidator {
		return new SchemaValidator();
	}

	private function schema( array $fields ): array {
		return array(
			'metadata'       => array( 'name' => 'panels', 'title' => 'Panels' ),
			'schema_version' => 1,
			'fields'         => $fields,
		);
	}

	private function text( string $key, array $extra = array() ): array {
		return array_merge( array( 'type' => 'text', 'key' => $key, 'label' => $key ), $extra );
	}

	private function tab( string $key, array $children = array() ): array {
		return array( 'type' => 'tab_panel', 'key' => $key, 'label' => $key, 'children' => $children );
	}

	private function section( string $key, array $children = array() ): array {
		return array( 'type' => 'accordion_panel', 'key' => $key, 'label' => $key, 'children' => $children );
	}

	private function tabs( string $key, array $panels ): array {
		return array( 'type' => 'tabs_container', 'key' => $key, 'label' => 'Tabs', 'children' => $panels );
	}

	private function accordion( string $key, array $panels ): array {
		return array( 'type' => 'accordion_container', 'key' => $key, 'label' => 'Accordion', 'children' => $panels );
	}

	private function problems( array $fields ): array {
		return array_column( $this->validator()->validateWithErrors( $this->schema( $fields ) ), 'message' );
	}

	// ── SchemaValidator ──────────────────────────────────────────────────

	public function test_tabs_and_accordion_with_their_panels_are_accepted(): void {
		$fields = array(
			$this->tabs( 't1', array( $this->tab( 't1a', array( $this->text( 'one' ) ) ), $this->tab( 't1b', array( $this->text( 'two' ) ) ) ) ),
			$this->accordion( 'a1', array( $this->section( 'a1a', array( $this->text( 'three' ) ) ), $this->section( 'a1b' ) ) ),
		);
		$this->assertTrue( $this->validator()->validate( $this->schema( $fields ) ) );
		$this->assertSame( array(), $this->problems( $fields ) );
	}

	public function test_a_panel_outside_its_own_container_is_refused(): void {
		$this->assertNotEmpty( $this->problems( array( $this->tab( 'loose' ) ) ) );
		$this->assertNotEmpty( $this->problems( array( $this->accordion( 'a', array( $this->tab( 'wrong' ) ) ) ) ) );
		$this->assertNotEmpty( $this->problems( array( $this->tabs( 't', array( $this->section( 'wrong' ) ) ) ) ) );
		$this->assertNotEmpty( $this->problems( array( array( 'type' => 'group_container', 'key' => 'g', 'children' => array( $this->tab( 'inside_group' ) ) ) ) ) );
	}

	public function test_a_container_holds_only_its_panels(): void {
		$this->assertNotEmpty( $this->problems( array( $this->tabs( 't', array( $this->text( 'direct' ) ) ) ) ) );
		$this->expectException( \InvalidArgumentException::class );
		$this->validator()->validate( $this->schema( array( $this->accordion( 'a', array( $this->text( 'direct' ) ) ) ) ) );
	}

	public function test_a_step_cannot_sit_inside_tabs_or_an_accordion(): void {
		$step = array( 'type' => 'step', 'key' => 'inner_step', 'children' => array() );
		$this->assertNotEmpty( $this->problems( array( $this->tabs( 't', array( $this->tab( 'p', array( $step ) ) ) ) ) ) );
		$this->assertNotEmpty( $this->problems( array( $this->accordion( 'a', array( $this->section( 's', array( $step ) ) ) ) ) ) );
		$this->assertNotEmpty( $this->problems( array( $this->tabs( 't', array( $step ) ) ) ) );
	}

	public function test_a_step_may_hold_tabs_and_an_accordion(): void {
		$fields = array(
			array(
				'type'     => 'step',
				'key'      => 'step_1',
				'children' => array(
					$this->tabs( 't', array( $this->tab( 'p', array( $this->text( 'x' ) ) ) ) ),
					$this->accordion( 'a', array( $this->section( 's' ) ) ),
				),
			),
		);
		$this->assertSame( array(), $this->problems( $fields ) );
	}

	public function test_same_type_nesting_is_refused_at_any_depth(): void {
		$inner = $this->tabs( 'inner', array( $this->tab( 'ip' ) ) );
		$this->assertNotEmpty( $this->problems( array( $this->tabs( 't', array( $this->tab( 'p', array( $inner ) ) ) ) ) ) );
		$deep = array( 'type' => 'group_container', 'key' => 'g', 'children' => array( $inner ) );
		$this->assertNotEmpty( $this->problems( array( $this->tabs( 't', array( $this->tab( 'p', array( $deep ) ) ) ) ) ) );
		$innerAcc = $this->accordion( 'inner_acc', array( $this->section( 'is' ) ) );
		$this->assertNotEmpty( $this->problems( array( $this->accordion( 'a', array( $this->section( 's', array( $innerAcc ) ) ) ) ) ) );
	}

	public function test_tabs_in_an_accordion_and_an_accordion_in_tabs_are_allowed(): void {
		$tabsInAccordion = array(
			$this->accordion( 'a', array( $this->section( 's', array( $this->tabs( 't', array( $this->tab( 'p', array( $this->text( 'x' ) ) ) ) ) ) ) ) ),
		);
		$this->assertSame( array(), $this->problems( $tabsInAccordion ) );
		$accordionInTabs = array(
			$this->tabs( 't2', array( $this->tab( 'p2', array( $this->accordion( 'a2', array( $this->section( 's2', array( $this->text( 'y' ) ) ) ) ) ) ) ) ),
		);
		$this->assertSame( array(), $this->problems( $accordionInTabs ) );
	}

	public function test_neither_may_sit_inside_a_repeater(): void {
		$repeater = static fn( array $child ) => array( 'type' => 'repeat_container', 'key' => 'rep', 'label' => 'R', 'children' => array( $child ) );
		$this->assertNotEmpty( $this->problems( array( $repeater( $this->tabs( 't', array( $this->tab( 'p' ) ) ) ) ) ) );
		$this->assertNotEmpty( $this->problems( array( $repeater( $this->accordion( 'a', array( $this->section( 's' ) ) ) ) ) ) );
		$group = array( 'type' => 'group_container', 'key' => 'g', 'children' => array( $this->tabs( 't', array( $this->tab( 'p' ) ) ) ) );
		$this->assertNotEmpty( $this->problems( array( $repeater( $group ) ) ) );
	}

	public function test_the_new_types_are_core_types(): void {
		foreach ( array( 'tabs_container', 'accordion_container', 'tab_panel', 'accordion_panel' ) as $type ) {
			$this->assertContains( $type, SchemaValidator::CORE_TYPES );
		}
	}

	public function test_panels_do_not_count_as_input_fields_when_publishing(): void {
		$only = array( $this->tabs( 't', array( $this->tab( 'p' ) ) ) );
		$this->assertFalse( SchemaValidator::takesAnswer( 'tab_panel' ) );
		$this->assertFalse( SchemaValidator::takesAnswer( 'accordion_panel' ) );
		$this->assertFalse( SchemaValidator::takesAnswer( 'tabs_container' ) );
		$errors = $this->validator()->validateForPublishingWithErrors( $this->schema( $only ) );
		$this->assertNotEmpty( $errors, 'A form of only empty panels has no input field.' );
	}

	// ── Containers are transparent ───────────────────────────────────────

	public function test_answer_fields_inside_panels_are_listed_and_the_panels_are_not(): void {
		$schema = $this->schema(
			array(
				$this->tabs( 't', array( $this->tab( 'tab_one', array( $this->text( 'one' ) ) ), $this->tab( 'tab_two', array( $this->text( 'two' ) ) ) ) ),
				$this->accordion( 'a', array( $this->section( 'sec_one', array( $this->text( 'three' ) ) ) ) ),
			)
		);
		$keys = array_column( FieldMapper::fields( $schema ), 'key' );
		$this->assertSame( array( 'one', 'two', 'three' ), $keys );
		$this->assertTrue( FieldMapper::isLayoutType( 'tab_panel' ) );
		$this->assertTrue( FieldMapper::isLayoutType( 'accordion_panel' ) );
	}

	public function test_a_form_without_the_containers_maps_as_before(): void {
		$schema = $this->schema(
			array(
				array( 'type' => 'step', 'key' => 's1', 'children' => array( $this->text( 'a' ), array( 'type' => 'group_container', 'key' => 'g', 'children' => array( $this->text( 'b' ) ) ) ) ),
				array( 'type' => 'step', 'key' => 's2', 'children' => array( array( 'type' => 'two_column_container', 'key' => 'c', 'columns' => array( array( $this->text( 'c1' ) ), array( $this->text( 'c2' ) ) ) ) ) ),
			)
		);
		$this->assertSame( array( 'a', 'b', 'c1', 'c2' ), array_column( FieldMapper::fields( $schema ), 'key' ) );
		$this->assertTrue( $this->validator()->validate( $schema ) );
		$this->assertSame( array(), SchemaValidator::panelNestingProblems( $schema ) );
		$this->assertSame( array(), $this->validator()->validateWithErrors( $schema ) );
	}

	// ── FieldValidator ───────────────────────────────────────────────────

	public function test_the_four_types_are_never_required(): void {
		$validator = new FieldValidator();
		foreach ( array( 'tabs_container', 'accordion_container', 'tab_panel', 'accordion_panel' ) as $type ) {
			$schema = array( 'fields' => array( array( 'key' => 'node', 'type' => $type, 'required' => true, 'children' => array() ) ) );
			$result = $validator->validate( $schema, array(), array( 'hidden_fields' => array(), 'required_fields' => array() ) );
			$this->assertTrue( $result['valid'], $type );
		}
	}

	public function test_a_required_field_inside_a_visible_panel_is_still_required(): void {
		$schema = array(
			'fields' => array( $this->tabs( 't', array( $this->tab( 'p', array( $this->text( 'name', array( 'required' => true ) ) ) ) ) ) ),
		);
		$result = ( new FieldValidator() )->validate( $schema, array(), array( 'hidden_fields' => array(), 'required_fields' => array() ) );
		$this->assertFalse( $result['valid'] );
		$this->assertArrayHasKey( 'name', $result['errors'] );
	}

	// ── ConditionalLogic ─────────────────────────────────────────────────

	public function test_a_hidden_panel_hides_its_children(): void {
		$rule   = array(
			'action' => 'show',
			'groups' => array( array( 'match' => 'all', 'rules' => array( array( 'field' => 'kind', 'operator' => 'equals', 'value' => 'company' ) ) ) ),
		);
		$schema = array(
			'fields' => array(
				array( 'key' => 'kind', 'type' => 'radio' ),
				$this->tabs( 't', array( $this->tab( 'tab_a', array( $this->text( 'first' ) ) ), $this->tab( 'tab_b', array( $this->text( 'company' ) ) ) + array( 'logic' => $rule ) ) ),
			),
		);
		$hidden = ( new ConditionalLogic() )->evaluate( $schema, array( 'kind' => 'person' ) )['hidden_fields'];
		sort( $hidden );
		$this->assertSame( array( 'company', 'tab_b' ), $hidden );
		$shown = ( new ConditionalLogic() )->evaluate( $schema, array( 'kind' => 'company' ) )['hidden_fields'];
		$this->assertSame( array(), $shown );
	}

	// ── Registry ─────────────────────────────────────────────────────────

	public function test_the_containers_are_in_the_library_and_the_panels_are_not(): void {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		FieldSettings::decorateAll( $registry );
		$grouped = $registry->byCategory();
		$layout  = array_map( static fn( $d ) => $d->type, $grouped['layout'] ?? array() );
		$this->assertContains( 'tabs_container', $layout );
		$this->assertContains( 'accordion_container', $layout );
		$this->assertNotContains( 'tab_panel', $layout );
		$this->assertNotContains( 'accordion_panel', $layout );
		foreach ( array( 'tabs_container', 'accordion_container', 'tab_panel', 'accordion_panel' ) as $type ) {
			$def = $registry->get( $type );
			$this->assertSame( 'structure', $def->kind, $type );
			$this->assertTrue( $def->acceptsChildren, $type );
		}
		$tabs = array_column( $registry->get( 'tabs_container' )->layoutControls, null, 'name' );
		$this->assertSame( 'top', $registry->get( 'tabs_container' )->fieldSpecificAttributes['position'] );
		$this->assertTrue( $registry->get( 'tabs_container' )->fieldSpecificAttributes['collapse_mobile'] );
		$this->assertSame( 0, $registry->get( 'tabs_container' )->fieldSpecificAttributes['active'] );
		$this->assertArrayHasKey( 'position', $tabs );
		$this->assertArrayHasKey( 'collapse_mobile', $tabs );
		$this->assertArrayHasKey( 'active', $tabs );
		$accordion = $registry->get( 'accordion_container' )->fieldSpecificAttributes;
		$this->assertFalse( $accordion['multiple'] );
		$this->assertSame( 'first', $accordion['open'] );
		$this->assertSame( 'chevron', $accordion['icon'] );
		$this->assertSame( array( 'label' ), array_column( $registry->get( 'tab_panel' )->layoutControls, 'name' ) );
	}
}
