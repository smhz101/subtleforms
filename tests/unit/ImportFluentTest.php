<?php
/**
 * Fluent Forms import: fields, steps, logic, notifications and confirmation.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/ImportTestCase.php';

use SubtleForms\Tools\Import\FluentMapper;

/**
 * @covers \SubtleForms\Tools\Import\FluentMapper
 */
final class ImportFluentTest extends ImportTestCase {

	/**
	 * The fixture as FluentSource::read() returns it: form_fields and meta
	 * values are JSON strings, as in the tables.
	 *
	 * @return array
	 */
	private static function form(): array {
		$row   = self::fixture( 'fluent-booking.json' );
		$metas = array();
		foreach ( $row['meta'] as $meta ) {
			$metas[] = array(
				'meta_key' => $meta['meta_key'],
				'value'    => is_string( $meta['value'] ) ? $meta['value'] : json_encode( $meta['value'] ),
			);
		}
		return array(
			'id'          => (string) $row['form']['id'],
			'title'       => $row['form']['title'],
			'form_fields' => json_encode( $row['form']['form_fields'] ),
			'metas'       => $metas,
		);
	}

	public function test_steps_take_their_titles_and_hold_their_fields(): void {
		$schema = FluentMapper::map( self::form(), self::CONTEXT )['schema'];
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		$this->assertSame( array( 'Your details', 'Your visit' ), array_column( $schema['fields'], 'title' ) );
		$this->assertSame( array( 'names', 'email', 'phone', 'service', 'visit_type', 'extras' ), array_column( $schema['fields'][0]['children'], 'key' ) );
		$this->assertSame( 'visit_date', $schema['fields'][1]['children'][0]['key'] );
		$this->assertSame( 'Book now', $schema['metadata']['submitText'] );
		self::assertSavable( $schema );
	}

	public function test_each_common_element_keeps_its_settings(): void {
		$f = self::byKey( FluentMapper::map( self::form(), self::CONTEXT )['schema']['fields'] );

		$this->assertSame( 'name_group', $f['names']['type'] );
		$this->assertTrue( $f['names']['required'], 'A required first name makes the Name required.' );
		$this->assertSame( 'First name', $f['names']['fields']['first_name']['placeholder'] );
		$this->assertFalse( $f['names']['fields']['middle_name']['enabled'] );
		$this->assertTrue( $f['email']['required'] );
		$this->assertSame( 'you@example.com', $f['email']['placeholder'] );
		$this->assertSame( 'phone', $f['phone']['type'] );
		$this->assertSame( 'dropdown', $f['service']['type'] );
		$this->assertSame( 'Pick a service', $f['service']['placeholder'] );
		$this->assertSame( array( 'label' => 'Colour', 'value' => 'colour' ), $f['service']['options'][1] );
		$this->assertSame( 'radio', $f['visit_type']['type'] );
		$this->assertSame( 'first', $f['visit_type']['defaultValue'] );
		$this->assertSame( 'multiple_choice', $f['extras']['type'] );
		$this->assertSame( 'wash', $f['extras']['defaultValue'] );
		$this->assertSame( 'date', $f['visit_date']['type'] );
		$this->assertSame( array( 1, 4, 1, '1' ), array( $f['people']['min'], $f['people']['max'], $f['people']['step'], $f['people']['defaultValue'] ) );
		$this->assertSame( 'text', $f['company']['type'], 'Fields inside columns come across.' );
		$this->assertSame( 'url', $f['website']['type'] );
		$this->assertSame( 'address_group', $f['address_1']['type'] );
		$this->assertTrue( $f['address_1']['required'] );
		$this->assertFalse( $f['address_1']['fields']['state']['enabled'] );
		$this->assertSame( 'Postcode', $f['address_1']['fields']['postal']['label'] );
		$this->assertSame( 'section_break', $f['anything_else']['type'] );
		$this->assertSame( array( 800, 4 ), array( $f['message']['maxLength'], $f['message']['rows'] ) );
		$this->assertSame( 'Allergies, accessibility needs, anything.', $f['message']['description'] );
		$this->assertSame( 3145728, $f['photo']['maxSize'] );
		$this->assertSame( 2, $f['photo']['maxFiles'] );
		$this->assertTrue( $f['photo']['multiple'] );
		$this->assertSame( 'jpg, jpeg, gif, png, bmp', $f['photo']['allowedExtensions'] );
		$this->assertSame( '{get:ref}', $f['referrer']['value'] );
		$this->assertSame( 'consent', $f['terms-n-condition']['type'] );
		$this->assertSame( 'I have read the booking terms.', $f['terms-n-condition']['checkboxLabel'] );
		$this->assertSame( 'https://example.com/salon-terms', $f['terms-n-condition']['privacyPolicyUrl'] );
		$this->assertTrue( $f['gdpr-agreement']['required'] );

		$html = array_values( array_filter( $f, static fn( $field ) => 'html' === $field['type'] ) );
		$this->assertSame( '<p>Please arrive five minutes early.</p>', $html[0]['content'] );
	}

	public function test_conditions_map_and_unknown_operators_are_reported(): void {
		$form            = self::form();
		$fields          = json_decode( $form['form_fields'], true );
		$fields['fields'][2]['settings']['conditional_logics'] = array(
			'status'     => true,
			'type'       => 'all',
			'conditions' => array( array( 'field' => 'people', 'operator' => '>=', 'value' => '2' ) ),
		);
		$form['form_fields'] = json_encode( $fields );
		$mapped              = FluentMapper::map( $form, self::CONTEXT );
		$f                   = self::byKey( $mapped['schema']['fields'] );

		$this->assertSame( 'any', $f['extras']['logic']['groups'][0]['match'] );
		$this->assertSame( array( 'service', 'service' ), array_column( $f['extras']['logic']['groups'][0]['rules'], 'field' ) );
		$this->assertArrayNotHasKey( 'logic', $f['phone'] );
		$this->assertStringContainsString( "Some conditions on 'Phone' were not copied", self::report( $mapped['notes'] ) );
	}

	public function test_notifications_confirmation_and_skipped_elements(): void {
		$mapped  = FluentMapper::map( self::form(), self::CONTEXT );
		$schema  = $mapped['schema'];
		$actions = $schema['actions'];
		$report  = self::report( $mapped['notes'] );

		$this->assertCount( 2, $actions );
		$this->assertSame( '{admin_email}', $actions[0]['settings']['to'] );
		$this->assertSame( 'New booking: {field:names}', $actions[0]['settings']['subject'] );
		$this->assertStringContainsString( '{all_fields}', $actions[0]['settings']['message'] );
		$this->assertStringContainsString( 'entry {entry_id}', $actions[0]['settings']['message'] );
		$this->assertSame( '{field:email}', $actions[1]['settings']['to'] );
		$this->assertSame( 'Your booking at {site_name}', $actions[1]['settings']['subject'] );
		$this->assertSame( 'text', $actions[1]['settings']['format'] );
		$this->assertSame( array( 'From: Salon <hello@example.com>' ), $actions[1]['settings']['headers'] );
		$this->assertSame( 'visit_type', $actions[1]['settings']['logic']['groups'][0]['rules'][0]['field'] );

		$this->assertSame( '<p>Thanks {field:names}, your booking for {field:visit_date} is in.</p>', $schema['metadata']['confirmation']['message'] );

		$this->assertStringContainsString( "Fluent Forms field 'Pay deposit' (type payment_method) was skipped: payments are not imported.", $report );
		$this->assertStringContainsString( '(type recaptcha) was skipped', $report );
		$this->assertStringContainsString( 'side by side in columns', $report );
		$this->assertSame( '{field:email}', $actions[0]['settings']['replyTo'], 'Reply-To from an answer comes across.' );
		$this->assertStringNotContainsString( 'Reply-To', $report );
		$this->assertStringContainsString( '{inputs.names.first_name} now gives the whole answer', $report );
	}

	public function test_redirects_restrictions_and_routing(): void {
		$mapped = FluentMapper::map(
			array(
				'title'         => 'Quote',
				'form_fields'   => array(
					'fields' => array(
						array( 'element' => 'input_email', 'attributes' => array( 'name' => 'email' ), 'settings' => array( 'label' => 'Email' ) ),
						array( 'element' => 'multi_select', 'attributes' => array( 'name' => 'colours', 'multiple' => true ), 'settings' => array( 'label' => 'Colours', 'advanced_options' => array( array( 'label' => 'Red', 'value' => 'red' ) ) ) ),
					),
				),
				'formSettings'  => array(
					'confirmation' => array( 'redirectTo' => 'customUrl', 'customUrl' => 'https://example.com/thanks?e={inputs.email}' ),
					'restrictions' => array(
						'requireLogin'         => array( 'enabled' => true, 'requireLoginMsg' => 'Log in first.' ),
						'limitNumberOfEntries' => array( 'enabled' => true, 'numberOfEntries' => 5, 'period' => 'day' ),
					),
				),
				'notifications' => array(
					array( 'name' => 'Route', 'sendTo' => array( 'type' => 'routing' ), 'subject' => 'S', 'message' => 'M' ),
				),
			),
			self::CONTEXT
		);
		$schema = $mapped['schema'];
		$this->assertSame( 'https://example.com/thanks?e={field:email}', $schema['metadata']['confirmation']['redirectUrl'] );
		$this->assertSame( array( 'requireLogin' => true, 'loginMessage' => 'Log in first.' ), $schema['metadata']['restrictions'] );
		$this->assertFalse( $schema['actions'][0]['enabled'] );
		$this->assertSame( 'multiple_choice', $schema['fields'][1]['type'] );
		$report = self::report( $mapped['notes'] );
		$this->assertStringContainsString( 'per day, week, month or year', $report );
		$this->assertStringContainsString( 'routing rules', $report );
		self::assertSavable( $schema );
	}
}
