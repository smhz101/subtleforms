<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * SubtleForms 2.3.2 (pure PHP, no WordPress):
 *
 * - Item 2: every free template is a valid schema; single checkboxes with a
 *   list of options become Multiple choice before saving.
 * - Item 1: the form type follows the structure.
 * - Item 4: Repeater, Group and Columns have label, help text and label
 *   visibility settings.
 * - Item 5: every input field has label visibility, help text placement,
 *   required and custom validation messages and an admin label; the server
 *   uses the messages and admin labels.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\FieldSettings;
use SubtleForms\Support\FieldMapper;
use SubtleForms\Support\SchemaRepair;
use SubtleForms\Support\SchemaValidator;
use SubtleForms\Templates\FormTemplates;

/**
 * @covers \SubtleForms\Support\SchemaRepair
 * @covers \SubtleForms\Fields\FieldSettings
 * @covers \SubtleForms\Engine\FieldValidator
 * @covers \SubtleForms\Support\FieldMapper
 */
final class Release232Test extends TestCase {

	private static ?FieldRegistry $registry = null;

	private static function registry(): FieldRegistry {
		if ( ! self::$registry ) {
			self::$registry = new FieldRegistry();
			CoreFields::register( self::$registry );
			\SubtleForms\Fields\FieldsV2::register( self::$registry );
			\SubtleForms\Fields\PaymentFields::register( self::$registry );
			FieldSettings::decorateAll( self::$registry );
		}
		return self::$registry;
	}

	private static function controls( string $type ): array {
		$def = self::registry()->get( $type );
		$out = array();
		foreach ( array_merge( (array) $def->layoutControls, (array) $def->inspectorControls ) as $c ) {
			if ( is_array( $c ) && isset( $c['name'] ) ) {
				$out[ $c['name'] ] = $c;
			}
		}
		return $out;
	}

	private function withKeys( array $fields ): array {
		foreach ( $fields as &$f ) {
			if ( empty( $f['key'] ) && ! empty( $f['id'] ) ) {
				$f['key'] = $f['id'];
			}
			foreach ( array( 'children', 'fields' ) as $c ) {
				if ( ! empty( $f[ $c ] ) && is_array( $f[ $c ] ) ) {
					$f[ $c ] = $this->withKeys( $f[ $c ] );
				}
			}
		}
		return $fields;
	}

	// ── Item 2 ───────────────────────────────────────────────────────────

	public function test_every_free_template_is_a_valid_schema_with_fields(): void {
		$templates = FormTemplates::get_all();
		$checked   = 0;
		foreach ( $templates as $key => $tpl ) {
			if ( empty( $tpl['schema']['fields'] ) ) {
				continue; // Pro stub (locked preview card).
			}
			$schema                   = $tpl['schema'];
			$schema['schema_version'] = 1;
			$schema['fields']         = $this->withKeys( $schema['fields'] );
			( new SchemaValidator() )->validate( $schema );
			$this->assertNotEmpty( $schema['fields'], $key );
			++$checked;
		}
		$this->assertGreaterThanOrEqual( 12, $checked );
	}

	public function test_checkbox_lists_become_multiple_choice_anywhere(): void {
		$fields = array(
			array( 'key' => 'one', 'type' => 'checkbox', 'checkboxLabel' => 'I agree' ),
			array( 'key' => 'list', 'type' => 'checkbox', 'checkboxLabel' => 'x', 'required' => true, 'options' => array( array( 'value' => 'a', 'label' => 'A' ) ) ),
			array(
				'key'      => 's1',
				'type'     => 'step',
				'children' => array(
					array( 'key' => 'nested', 'type' => 'checkbox', 'config' => array( 'options' => array( array( 'value' => 'b' ) ) ) ),
				),
			),
			array(
				'key'     => 'cols',
				'type'    => 'two_column_container',
				'columns' => array( array( array( 'key' => 'col', 'type' => 'checkbox', 'options' => array( array( 'value' => 'c' ) ) ) ), array() ),
			),
		);
		list( $out, $count ) = SchemaRepair::checkboxListsToMultipleChoice( $fields );
		$this->assertSame( 3, $count );
		$this->assertSame( 'checkbox', $out[0]['type'] );
		$this->assertSame( 'multiple_choice', $out[1]['type'] );
		$this->assertTrue( $out[1]['allowMultiple'] );
		$this->assertTrue( $out[1]['required'] );
		$this->assertArrayNotHasKey( 'checkboxLabel', $out[1] );
		$this->assertSame( 'multiple_choice', $out[2]['children'][0]['type'] );
		$this->assertSame( 'multiple_choice', $out[2]['children'][0]['config']['type'] );
		$this->assertSame( 'multiple_choice', $out[3]['columns'][0][0]['type'] );
		$this->assertSame( array(), SchemaValidator::checkboxOptionErrors( $out, 'fields' ) );
	}

	// ── Item 1 ───────────────────────────────────────────────────────────

	public function test_type_follows_structure(): void {
		$step = array( 'key' => 's', 'type' => 'step', 'children' => array() );
		$text = array( 'key' => 't', 'type' => 'text' );

		$this->assertSame( 'multi-step', SchemaRepair::structuralType( array( 'metadata' => array( 'type' => 'regular' ), 'fields' => array( $step ) ) ) );
		$this->assertSame( 'multi-step', SchemaRepair::structuralType( array( 'fields' => array( $step ) ) ) );
		$this->assertSame( 'regular', SchemaRepair::structuralType( array( 'metadata' => array( 'type' => 'multi-step' ), 'fields' => array( $text ) ) ) );
		$this->assertSame( 'regular', SchemaRepair::structuralType( array( 'metadata' => array( 'type' => 'multistep' ), 'fields' => array() ) ) );
		$this->assertSame( 'conversational', SchemaRepair::structuralType( array( 'metadata' => array( 'type' => 'conversational' ), 'fields' => array( $step ) ) ) );
		$this->assertSame( 'payment', SchemaRepair::structuralType( array( 'metadata' => array( 'type' => 'payment' ), 'fields' => array( $step ) ) ) );

		list( $schema, $changed ) = SchemaRepair::syncType( array( 'metadata' => array( 'type' => 'regular' ), 'fields' => array( $step ) ) );
		$this->assertTrue( $changed );
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		list( , $again ) = SchemaRepair::syncType( $schema );
		$this->assertFalse( $again );
	}

	// ── Item 4 ───────────────────────────────────────────────────────────

	public function test_containers_have_label_help_text_and_visibility_first(): void {
		foreach ( array( 'repeat_container', 'group_container', 'two_column_container', 'three_column_container' ) as $type ) {
			$def   = self::registry()->get( $type );
			$names = array_column( $def->layoutControls, 'name' );
			$this->assertSame( array( 'label', 'description', 'labelVisibility' ), array_slice( $names, 0, 3 ), $type );
		}
		// The Repeater keeps its own settings after them.
		$this->assertArrayHasKey( 'buttonLabel', self::controls( 'repeat_container' ) );
		$this->assertArrayHasKey( 'max', self::controls( 'repeat_container' ) );
		$this->assertArrayHasKey( 'adminLabel', self::controls( 'repeat_container' ) );
		// Group had a label control already: not duplicated.
		$labels = array_filter( self::registry()->get( 'group_container' )->layoutControls, static fn( $c ) => ( $c['name'] ?? '' ) === 'label' );
		$this->assertCount( 1, $labels );
	}

	// ── Item 5 ───────────────────────────────────────────────────────────

	public function test_every_input_field_has_the_universal_settings(): void {
		$inputs = array( 'text', 'email', 'number', 'phone', 'url', 'textarea', 'password', 'dropdown', 'radio', 'multiple_choice', 'checkbox', 'consent', 'date', 'time', 'file_upload', 'rating', 'scale', 'net_promoter_score', 'name_group', 'address_group', 'country', 'toggle', 'rich_text' );
		foreach ( $inputs as $type ) {
			$c = self::controls( $type );
			foreach ( array( 'label', 'description', 'labelVisibility', 'descriptionPlacement', 'requiredMessage', 'validationMessage', 'adminLabel' ) as $name ) {
				$this->assertArrayHasKey( $name, $c, "{$type} has {$name}" );
			}
			$this->assertSame( 'appearance', $c['labelVisibility']['section'] );
			$this->assertSame( 'appearance', $c['descriptionPlacement']['section'] );
			if ( isset( $c['label'] ) ) {
				$this->assertSame( 'general', $c['label']['section'] );
			}
			if ( isset( $c['description'] ) ) {
				$this->assertSame( 'general', $c['description']['section'] );
			}
			$this->assertSame( 'validation', $c['validationMessage']['section'] );
			$this->assertSame( 'advanced', $c['adminLabel']['section'] );
			$this->assertSame( array( '', 'visible', 'hidden' ), array_column( $c['labelVisibility']['options'], 'value' ) );
			$this->assertSame( array( '', 'below', 'above' ), array_column( $c['descriptionPlacement']['options'], 'value' ) );
		}
		// The text pattern message is now the universal custom message.
		$this->assertArrayNotHasKey( 'patternMessage', self::controls( 'text' ) );
	}

	public function test_fields_without_a_label_only_get_settings_that_make_sense(): void {
		foreach ( array( 'html', 'section_break', 'disclaimer' ) as $type ) {
			$c = self::controls( $type );
			foreach ( array( 'labelVisibility', 'descriptionPlacement', 'requiredMessage', 'validationMessage' ) as $name ) {
				$this->assertArrayNotHasKey( $name, $c, "{$type} has no {$name}" );
			}
		}
		$hidden = self::controls( 'hidden' );
		$this->assertArrayHasKey( 'adminLabel', $hidden );
		foreach ( array( 'description', 'labelVisibility', 'descriptionPlacement', 'requiredMessage', 'validationMessage' ) as $name ) {
			$this->assertArrayNotHasKey( $name, $hidden, "hidden has no {$name}" );
		}
	}

	public function test_hidden_field_is_in_the_library_for_tracking(): void {
		$def = self::registry()->get( 'hidden' );
		$this->assertFalse( $def->paletteHidden );
		$this->assertSame( 'advanced', $def->category );
		$types = array_map(
			static fn( $field ) => $field->type,
			self::registry()->byCategory()['advanced']
		);
		$this->assertContains( 'hidden', $types );
		$value = self::controls( 'hidden' )['value'];
		$this->assertSame( 'general', $value['section'] );
		$this->assertStringContainsString( '{get:param}', $value['help'] );
		$this->assertStringContainsString( 'Visitors never see it', self::controls( 'hidden' )['label']['help'] );
	}

	private function validate( array $schema, array $payload ): array {
		return ( new FieldValidator() )->validate( $schema, $payload, array( 'hidden_fields' => array(), 'required_fields' => array() ) )['errors'];
	}

	public function test_server_uses_custom_validation_and_required_messages(): void {
		$schema = array(
			'fields' => array(
				array( 'key' => 'email', 'type' => 'email', 'label' => 'Email', 'required' => true, 'requiredMessage' => 'We need your email.', 'validationMessage' => 'Not an email.' ),
				array( 'key' => 'age', 'type' => 'number', 'label' => 'Age', 'max' => 120, 'config' => array( 'validationMessage' => 'Enter a real age.' ) ),
				array( 'key' => 'code', 'type' => 'text', 'label' => 'Code', 'pattern' => '^[A-Z]{2}$', 'patternMessage' => 'Two capitals.' ),
				array( 'key' => 'site', 'type' => 'url', 'label' => 'Site' ),
			),
		);
		$this->assertSame( 'We need your email.', $this->validate( $schema, array() )['email'] );
		$errors = $this->validate( $schema, array( 'email' => 'nope', 'age' => '500', 'code' => 'abc', 'site' => 'nope' ) );
		$this->assertSame( 'Not an email.', $errors['email'] );
		$this->assertSame( 'Enter a real age.', $errors['age'] );
		// Older forms keep their pattern message.
		$this->assertSame( 'Two capitals.', $errors['code'] );
		// No custom message: the standard one.
		$this->assertSame( 'Invalid URL.', $errors['site'] );
	}

	public function test_form_default_messages_apply_when_a_field_has_none(): void {
		$schema = array(
			'metadata' => array( 'requiredMessage' => 'Please answer this.', 'validationMessage' => 'Please check this answer.' ),
			'fields'   => array(
				array( 'key' => 'a', 'type' => 'text', 'label' => 'A', 'required' => true ),
				array( 'key' => 'b', 'type' => 'email', 'label' => 'B', 'required' => true, 'requiredMessage' => 'B please.' ),
				array( 'key' => 'c', 'type' => 'email', 'label' => 'C', 'validationMessage' => 'Own message.' ),
				array( 'key' => 'd', 'type' => 'email', 'label' => 'D' ),
			),
		);
		$errors = $this->validate( $schema, array( 'c' => 'x', 'd' => 'y' ) );
		$this->assertSame( 'Please answer this.', $errors['a'] );
		$this->assertSame( 'B please.', $errors['b'] );
		$this->assertSame( 'Own message.', $errors['c'] );
		$this->assertSame( 'Please check this answer.', $errors['d'] );
	}

	public function test_admin_label_names_fields_in_entries_emails_exports_and_integrations(): void {
		$schema = array(
			'fields' => array(
				array( 'key' => 'email', 'type' => 'email', 'label' => 'Your email', 'adminLabel' => 'Contact email' ),
				array( 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'key' => 'wrapped', 'type' => 'text', 'config' => array( 'label' => 'Public', 'adminLabel' => 'Internal' ) ),
				array( 'key' => 'ref', 'type' => 'hidden', 'adminLabel' => 'Referral code' ),
				array(
					'key'        => 'jobs',
					'type'       => 'repeat_container',
					'label'      => 'Jobs',
					'adminLabel' => 'Employment history',
					'children'   => array( array( 'key' => 'co', 'type' => 'text', 'label' => 'Company', 'adminLabel' => 'Employer' ) ),
				),
			),
		);
		$fields = array_column( FieldMapper::fields( $schema ), null, 'key' );
		$this->assertSame( 'Contact email', $fields['email']['label'] );
		$this->assertSame( 'Your email', $fields['email']['public_label'] );
		$this->assertSame( 'Name', $fields['name']['label'] );
		$this->assertSame( 'Internal', $fields['wrapped']['label'] );
		$this->assertSame( 'Referral code', $fields['ref']['label'] );
		$this->assertSame( 'Employment history', $fields['jobs']['label'] );

		$answers = array_column( FieldMapper::answers( $schema, array( 'email' => 'a@b.co', 'name' => 'Ada', 'ref' => 'X1' ) ), 'label', 'key' );
		$this->assertSame( array( 'email' => 'Contact email', 'name' => 'Name', 'ref' => 'Referral code' ), $answers );
	}
}
