<?php
/**
 * Free 2.4.0 field behavior that can be checked without WordPress.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\ConditionalLogic;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Fields\ActionHooks;
use SubtleForms\Fields\CoreFields;
use SubtleForms\Fields\FieldDefinition;
use SubtleForms\Fields\FieldRegistry;
use SubtleForms\Fields\FieldSettings;
use SubtleForms\Fields\ImplicitDefaults;
use SubtleForms\Support\Captcha\FieldCaptcha;

/**
 * @covers \SubtleForms\Fields\ImplicitDefaults
 * @covers \SubtleForms\Fields\ActionHooks
 * @covers \SubtleForms\Support\Captcha\FieldCaptcha
 */
final class Release240Test extends TestCase {

	public function test_color_default_is_the_answer_when_the_visitor_leaves_it(): void {
		$schema = array(
			'fields' => array(
				array(
					'type'    => 'color_picker',
					'key'     => 'brand',
					'config'  => array( 'default' => '#ff0000' ),
					'required'=> true,
				),
			),
		);
		$payload = ImplicitDefaults::apply( $schema, array( 'brand' => '' ) );
		$this->assertSame( '#ff0000', $payload['brand'] );

		$result = ( new FieldValidator() )->validate( $schema, $payload, array() );
		$this->assertTrue( $result['valid'], implode( ' ', $result['errors'] ) );
	}

	public function test_us_phone_and_password_confirmation_are_checked(): void {
		$schema = array(
			'fields' => array(
				array(
					'type'   => 'phone',
					'key'    => 'tel',
					'config' => array( 'format' => 'us' ),
				),
				array(
					'type'   => 'password',
					'key'    => 'pw',
					'config' => array( 'requireConfirmation' => true, 'minLength' => 8 ),
				),
			),
		);
		$bad = ( new FieldValidator() )->validate(
			$schema,
			array(
				'tel' => '12',
				'pw'  => 'correct-horse',
				'pw_confirm' => 'different',
			),
			array()
		);
		$this->assertArrayHasKey( 'tel', $bad['errors'] );
		$this->assertArrayHasKey( 'pw', $bad['errors'] );

		$good = ( new FieldValidator() )->validate(
			$schema,
			array(
				'tel' => '(555) 010-1234',
				'pw'  => 'correct-horse',
				'pw_confirm' => 'correct-horse',
			),
			array()
		);
		$this->assertTrue( $good['valid'], implode( ' ', $good['errors'] ) );
	}

	public function test_choice_fields_start_with_choices_and_hidden_has_one_admin_label(): void {
		$registry = new FieldRegistry();
		CoreFields::register( $registry );
		\SubtleForms\Fields\FieldsV2::register( $registry );
		FieldSettings::decorateAll( $registry );

		foreach ( array( 'dropdown', 'radio', 'multiple_choice' ) as $type ) {
			$options = $registry->get( $type )->fieldSpecificAttributes['options'] ?? array();
			$this->assertGreaterThanOrEqual( 2, count( $options ), $type );
		}

		$hidden = $this->names( $registry->get( 'hidden' ) );
		$this->assertSame( 1, count( array_keys( $hidden, 'adminLabel', true ) ) );
		$this->assertNotContains( 'defaultValue', $hidden );

		$color = $this->names( $registry->get( 'color_picker' ) );
		$this->assertContains( 'default', $color );
		$this->assertNotContains( 'defaultValue', $color );

		$score = $this->names( $registry->get( 'net_promoter_score' ) );
		$this->assertContains( 'minLabel', $score );
		$this->assertContains( 'maxLabel', $score );

		$chained = $registry->get( 'chained_select' )->fieldSpecificAttributes['source'] ?? '';
		$this->assertSame( 'manual', $chained );
	}

	public function test_calculation_gets_prefix_and_suffix_controls(): void {
		$registry = new FieldRegistry();
		$registry->register( new FieldDefinition( 'calculation', 'Calculation', 'advanced', 'dashicons-calculator' ) );
		FieldSettings::decorateAll( $registry );
		$names = $this->names( $registry->get( 'calculation' ) );
		$this->assertContains( 'prefix', $names );
		$this->assertContains( 'suffix', $names );
	}

	public function test_action_hook_names_are_sanitized_and_empty_names_are_skipped(): void {
		$names = ActionHooks::names(
			array(
				'fields' => array(
					array( 'type' => 'action_hook', 'config' => array( 'hook_name' => 'My Hook!' ) ),
					array( 'type' => 'action_hook', 'config' => array( 'hook_name' => '' ) ),
				),
			)
		);
		$this->assertSame( array( 'myhook' ), $names );
	}

	public function test_captcha_field_uses_its_own_provider_and_refuses_a_foreign_widget(): void {
		$resolved = FieldCaptcha::resolve(
			array(
				'type'     => 'hcaptcha',
				'site_key' => 'site-hc',
				'config'   => array( 'secret_key' => 'secret-hc' ),
			),
			array(
				'recaptcha' => array(
					'site_key'   => 'site-rc',
					'secret_key' => 'secret-rc',
				),
			)
		);
		$this->assertTrue( $resolved['ready'] );
		$this->assertSame( 'hcaptcha', $resolved['provider'] );
		$this->assertStringContainsString( 'h-captcha', $resolved['html'] );
		$this->assertStringNotContainsString( 'g-recaptcha', $resolved['html'] );

		$missing = FieldCaptcha::resolve( array( 'type' => 'turnstile' ), array() );
		$this->assertFalse( $missing['ready'] );
		$this->assertNotSame( '', $missing['warning'] );
	}

	public function test_checkbox_yes_matches_and_toggle_off_is_empty(): void {
		$logic = new ConditionalLogic();
		$schema = array(
			'fields' => array(
				array(
					'type' => 'checkbox',
					'key'  => 'agree',
				),
				array(
					'type'     => 'toggle',
					'key'      => 'news',
					'offValue' => 'no',
					'logic'    => array(
						'action' => 'show',
						'groups' => array(
							array(
								'match' => 'all',
								'rules' => array(
									array(
										'field'    => 'agree',
										'operator' => 'equals',
										'value'    => 'yes',
									),
								),
							),
						),
					),
				),
			),
		);
		$state = $logic->evaluate( $schema, array( 'agree' => true, 'news' => 'no' ) );
		$this->assertNotContains( 'news', $state['hidden_fields'] );

		$this->assertTrue( $logic->evaluateCondition( 'no', 'empty', '', '', array( 'type' => 'toggle', 'offValue' => 'no' ) ) );
		$this->assertFalse( $logic->evaluateCondition( 'no', 'empty', '', '', array( 'type' => 'text' ) ) );
	}

	/**
	 * @param object $definition Field definition.
	 * @return string[]
	 */
	private function names( $definition ): array {
		$names = array();
		foreach ( array_merge( (array) $definition->layoutControls, (array) $definition->inspectorControls ) as $control ) {
			if ( is_array( $control ) && isset( $control['name'] ) ) {
				$names[] = $control['name'];
			}
		}
		return $names;
	}
}
