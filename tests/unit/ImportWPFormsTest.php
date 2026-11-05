<?php
/**
 * WPForms import: fields, steps, logic, notifications, confirmation, entries.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/ImportTestCase.php';

use SubtleForms\Tools\Import\WPFormsMapper;

/**
 * @covers \SubtleForms\Tools\Import\WPFormsMapper
 */
final class ImportWPFormsTest extends ImportTestCase {

	/**
	 * The form as the post content decodes.
	 *
	 * @return array
	 */
	private static function form(): array {
		$form          = self::fixture( 'wpforms-contact.json' );
		$form['title'] = 'Contact request';
		return $form;
	}

	/**
	 * @return array
	 */
	private static function mapped(): array {
		return WPFormsMapper::map( self::form(), self::CONTEXT );
	}

	public function test_pages_become_steps_with_the_titles_of_the_breaks(): void {
		$schema = self::mapped()['schema'];
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		$this->assertSame( array( 'Contact us', 'Details' ), array_column( $schema['fields'], 'title' ) );
		$this->assertSame( 'Send request', $schema['metadata']['submitText'] );
		$this->assertSame( 'Ask us anything.', $schema['metadata']['description'] );
		self::assertSavable( $schema );
	}

	public function test_each_field_type_keeps_its_settings(): void {
		$f = self::byKey( self::mapped()['schema']['fields'] );

		$this->assertSame( 'name_group', $f['your_name']['type'] );
		$this->assertTrue( $f['your_name']['required'] );
		$this->assertFalse( $f['your_name']['fields']['middle_name']['enabled'] );
		$this->assertSame( 'First', $f['your_name']['fields']['first_name']['placeholder'] );
		$this->assertSame( 'email', $f['email']['type'] );
		$this->assertSame( 'We reply within a day.', $f['email']['description'] );
		$this->assertSame( 'dropdown', $f['topic']['type'] );
		$this->assertSame( 'Choose one', $f['topic']['placeholder'] );
		$this->assertSame( array( 'Sales', 'Support', 'Other' ), array_column( $f['topic']['options'], 'label' ) );
		$this->assertSame( 'multiple_choice', $f['products']['type'] );
		$this->assertSame( 'textarea', $f['message']['type'] );
		$this->assertSame( 500, $f['message']['maxLength'] );
		$this->assertSame( 'consent', $f['gdpr_agreement']['type'] );
		$this->assertTrue( $f['gdpr_agreement']['required'] );
		$this->assertSame( 'I agree to the privacy policy', $f['gdpr_agreement']['checkboxLabel'] );
		$this->assertSame( 'date', $f['preferred_day']['type'] );
		$this->assertSame( 'file_upload', $f['attachment']['type'] );
		$this->assertSame( 'pdf, png', $f['attachment']['allowedExtensions'] );
		$this->assertSame( 5242880, $f['attachment']['maxSize'] );
		$this->assertSame( 3, $f['attachment']['maxFiles'] );
		$this->assertSame( 'rating', $f['how_did_we_do']['type'] );
		$this->assertSame( 5, $f['how_did_we_do']['max'] );
		$this->assertSame( 'text', $f['company']['type'], 'Fields inside a layout come across.' );
		$this->assertSame( 'url', $f['website']['type'] );
	}

	public function test_layout_children_appear_once_where_the_layout_was(): void {
		$keys = array_keys( self::byKey( self::mapped()['schema']['fields'] ) );
		$this->assertSame( 1, count( array_keys( $keys, 'company', true ) ) );
		$this->assertLessThan( array_search( 'website', $keys, true ), array_search( 'company', $keys, true ) );
		$this->assertStringContainsString( 'side by side', self::report( self::mapped()['notes'] ) );
	}

	public function test_unsupported_types_are_skipped_with_a_reason(): void {
		$mapped = self::mapped();
		$f      = self::byKey( $mapped['schema']['fields'] );
		foreach ( array( 'prove_you_are_human', 'fee', 'satisfaction', 'sign_here' ) as $gone ) {
			$this->assertArrayNotHasKey( $gone, $f );
		}
		$report = self::report( $mapped['notes'] );
		$this->assertStringContainsString( "WPForms field 'Prove you are human' (type captcha) was skipped: SubtleForms has its own spam protection", $report );
		$this->assertStringContainsString( "WPForms field 'Fee' (type payment-single) was skipped: payments are not imported.", $report );
		$this->assertStringContainsString( "(type likert_scale)", $report );
		$this->assertStringContainsString( "(type signature)", $report );
		$this->assertStringContainsString( "The confirm email box of 'Email' was not copied.", $report );
	}

	public function test_one_group_of_rules_maps_and_choice_ids_become_values(): void {
		$f     = self::byKey( self::mapped()['schema']['fields'] );
		$logic = $f['message']['logic'];
		$this->assertSame( 'show', $logic['action'] );
		$this->assertSame( 'all', $logic['groups'][0]['match'] );
		$this->assertSame(
			array(
				array( 'field' => 'topic', 'operator' => 'equals', 'value' => 'Support' ),
				array( 'field' => 'email', 'operator' => 'not_empty', 'value' => '' ),
			),
			$logic['groups'][0]['rules']
		);
	}

	public function test_or_groups_are_reported_and_never_dropped_silently(): void {
		$mapped = self::mapped();
		$f      = self::byKey( $mapped['schema']['fields'] );
		$this->assertArrayNotHasKey( 'logic', $f['order_number'] );
		$this->assertStringContainsString( "The conditional logic of 'Order number' has several groups joined by OR", self::report( $mapped['notes'] ) );
	}

	public function test_unsupported_operators_are_reported(): void {
		$form                                           = self::form();
		$form['fields']['6']['conditionals'][0][0]['operator'] = '^';
		$mapped = WPFormsMapper::map( $form, self::CONTEXT );
		$this->assertArrayNotHasKey( 'logic', self::byKey( $mapped['schema']['fields'] )['message'] );
		$this->assertStringContainsString( "The conditional logic of 'Message'", self::report( $mapped['notes'] ) );
	}

	public function test_hide_when_maps_to_the_hide_action(): void {
		$form                                       = self::form();
		$form['fields']['6']['conditional_type']    = 'hide';
		$logic = self::byKey( WPFormsMapper::map( $form, self::CONTEXT )['schema']['fields'] )['message']['logic'];
		$this->assertSame( 'hide', $logic['action'] );
	}

	public function test_notifications_become_emails_with_translated_smart_tags(): void {
		$mapped  = self::mapped();
		$actions = $mapped['schema']['actions'];
		$this->assertCount( 2, $actions );
		$one = $actions[0]['settings'];
		$this->assertTrue( $actions[0]['enabled'] );
		$this->assertSame( '{admin_email}', $one['to'] );
		$this->assertSame( 'New request: {field:topic}', $one['subject'] );
		$this->assertSame( "{all_fields}\nSent from {form_title}", $one['message'] );
		$this->assertSame( '{field:email}', $one['replyTo'] );
		$this->assertSame( array( 'From: Demo Site <admin@demo.test>' ), $one['headers'] );

		$two = $actions[1]['settings'];
		$this->assertSame( 'support@example.com, {field:email}', $two['to'] );
		$this->assertStringContainsString( 'Thanks {field:your_name}. {user_ip}', $two['message'] );
		$this->assertSame( 'equals', $two['logic']['groups'][0]['rules'][0]['operator'] );
		$this->assertStringContainsString( 'The merge tag {user_ip} has no SubtleForms equivalent', self::report( $mapped['notes'] ) );
	}

	public function test_a_notification_that_stops_on_a_match_is_imported_off(): void {
		$form = self::form();
		$form['settings']['notifications']['2']['conditional_type'] = 'stop';
		$mapped = WPFormsMapper::map( $form, self::CONTEXT );
		$this->assertFalse( $mapped['schema']['actions'][1]['enabled'] );
		$this->assertStringContainsString( "The email 'Support only' had conditions that could not be copied", self::report( $mapped['notes'] ) );
	}

	public function test_all_notifications_off_when_the_form_switch_is_off(): void {
		$form = self::form();
		$form['settings']['notification_enable'] = '0';
		$mapped = WPFormsMapper::map( $form, self::CONTEXT );
		$this->assertFalse( $mapped['schema']['actions'][0]['enabled'] );
	}

	public function test_the_first_confirmation_is_used_and_the_rest_reported(): void {
		$mapped = self::mapped();
		$conf   = $mapped['schema']['metadata']['confirmation'];
		$this->assertSame( 'message', $conf['type'] );
		$this->assertSame( '<p>Thanks {field:your_name}, we will be in touch.</p>', $conf['message'] );
		$this->assertStringContainsString( '1 more confirmation, shown only under conditions, was not copied.', self::report( $mapped['notes'] ) );
	}

	public function test_redirect_and_page_confirmations(): void {
		$form                                       = self::form();
		$form['settings']['confirmations']          = array( '1' => array( 'type' => 'redirect', 'redirect' => 'https://example.com/thanks?a={field_id="2"}' ) );
		$conf = WPFormsMapper::map( $form, self::CONTEXT )['schema']['metadata']['confirmation'];
		$this->assertSame( array( 'type' => 'redirect', 'redirectUrl' => 'https://example.com/thanks?a={field:email}' ), $conf );

		$form['settings']['confirmations'] = array( '1' => array( 'type' => 'page', 'page' => '7' ) );
		$conf = WPFormsMapper::map( $form, self::CONTEXT )['schema']['metadata']['confirmation'];
		$this->assertSame( array( 'type' => 'redirect', 'redirectUrl' => '/?page_id=7' ), $conf );

		$file = WPFormsMapper::map( $form, self::CONTEXT + array( 'from_file' => true ) );
		$this->assertArrayNotHasKey( 'confirmation', $file['schema']['metadata'] );
		$this->assertStringContainsString( 'page of the other site', self::report( $file['notes'] ) );
	}

	public function test_the_export_file_shape_and_stored_json_both_read(): void {
		$export = self::fixture( 'wpforms-export.json' );
		$tiny   = WPFormsMapper::map( $export['102'], self::CONTEXT );
		$this->assertSame( 'Tiny form', $tiny['title'] );
		$stored = WPFormsMapper::map( array( 'id' => '5', 'title' => 'From post', 'content' => json_encode( $export['102'] ) ), self::CONTEXT );
		$this->assertSame( 'From post', $stored['title'] );
		$this->assertSame( 'subject', $stored['schema']['fields'][0]['key'] );
	}

	public function test_simple_names_are_one_text_box_and_dates_pick_their_kind(): void {
		$form = array(
			'id'       => '9',
			'title'    => 'T',
			'fields'   => array(
				'1' => array( 'id' => '1', 'type' => 'name', 'label' => 'Full name', 'format' => 'simple' ),
				'2' => array( 'id' => '2', 'type' => 'date-time', 'label' => 'When', 'format' => 'date-time' ),
				'3' => array( 'id' => '3', 'type' => 'date-time', 'label' => 'At', 'format' => 'time' ),
				'4' => array( 'id' => '4', 'type' => 'number-slider', 'label' => 'Size', 'min' => '1', 'max' => '9', 'step' => '2' ),
				'5' => array( 'id' => '5', 'type' => 'richtext', 'label' => 'Story' ),
				'6' => array( 'id' => '6', 'type' => 'net_promoter_score', 'label' => 'Would you recommend us' ),
				'7' => array( 'id' => '7', 'type' => 'content', 'label' => 'Info', 'content' => '<p>Hello</p>' ),
				'8' => array( 'id' => '8', 'type' => 'divider', 'label' => 'Part two' ),
				'9' => array( 'id' => '9', 'type' => 'password', 'label' => 'Secret' ),
				'10' => array( 'id' => '10', 'type' => 'hidden', 'label' => 'Ref', 'default_value' => 'abc' ),
				'11' => array( 'id' => '11', 'type' => 'entry-preview', 'label' => 'Preview' ),
				'12' => array( 'id' => '12', 'type' => 'select', 'label' => 'Many', 'multiple' => '1', 'choices' => array( '1' => array( 'label' => 'A' ), '2' => array( 'label' => 'B' ) ) ),
			),
			'settings' => array(),
		);
		$mapped = WPFormsMapper::map( $form, self::CONTEXT );
		$f      = self::byKey( $mapped['schema']['fields'] );
		$this->assertSame( 'text', $f['full_name']['type'] );
		$this->assertSame( 'datetime', $f['when']['type'] );
		$this->assertSame( 'time', $f['at']['type'] );
		$this->assertSame( array( 1, 9, 2 ), array( $f['size']['min'], $f['size']['max'], $f['size']['step'] ) );
		$this->assertSame( 'range_slider', $f['size']['type'] );
		$this->assertSame( 'rich_text', $f['story']['type'] );
		$this->assertSame( 'net_promoter_score', $f['would_you_recommend_us']['type'] );
		$this->assertSame( '<p>Hello</p>', $f['info']['content'] );
		$this->assertSame( 'section_break', $f['part_two']['type'] );
		$this->assertSame( 'password', $f['secret']['type'] );
		$this->assertSame( 'abc', $f['ref']['value'] );
		$this->assertSame( 'multiple_choice', $f['many']['type'] );
		$this->assertArrayNotHasKey( 'preview', $f );
		$this->assertStringContainsString( '(type entry-preview) was skipped: entry preview fields are not imported', self::report( $mapped['notes'] ) );
	}

	public function test_entries_become_answers_for_the_new_keys(): void {
		$map    = self::mapped()['entry_map'];
		$values = array(
			'1'  => array( 'value' => 'Ada Lovelace', 'first' => 'Ada', 'last' => 'Lovelace' ),
			'2'  => array( 'value' => 'ada@example.com' ),
			'3'  => array( 'value' => 'Support' ),
			'4'  => array( 'value' => "Widgets\nGizmos" ),
			'10' => array( 'value' => 'I agree to the privacy policy' ),
			'11' => array( 'value' => '03/15/2025', 'date' => '03/15/2025' ),
			'12' => array( 'value' => "https://example.com/a.pdf\nhttps://example.com/b.png" ),
			'13' => array( 'value' => '4' ),
			'6'  => array( 'value' => '' ),
			'99' => array( 'value' => 'not mapped' ),
		);
		$files   = 0;
		$payload = WPFormsMapper::payload( $map, $values, $files );
		$this->assertSame( array( 'first_name' => 'Ada', 'last_name' => 'Lovelace' ), $payload['your_name'] );
		$this->assertSame( 'ada@example.com', $payload['email'] );
		$this->assertSame( 'Support', $payload['topic'] );
		$this->assertSame( array( 'Widgets', 'Gizmos' ), $payload['products'] );
		$this->assertTrue( $payload['gdpr_agreement'] );
		$this->assertSame( '2025-03-15', $payload['preferred_day'] );
		$this->assertSame( "https://example.com/a.pdf\nhttps://example.com/b.png", $payload['attachment'] );
		$this->assertSame( 2, $files );
		$this->assertSame( '4', $payload['how_did_we_do'] );
		$this->assertArrayNotHasKey( 'message', $payload, 'Empty answers are left out.' );
		$this->assertCount( 8, $payload );
	}

	public function test_address_entries_use_the_part_names(): void {
		$form = array(
			'id'       => '1',
			'title'    => 'A',
			'fields'   => array( '1' => array( 'id' => '1', 'type' => 'address', 'label' => 'Where', 'scheme' => 'international', 'address2_hide' => '1' ) ),
			'settings' => array(),
		);
		$mapped = WPFormsMapper::map( $form, self::CONTEXT );
		$field  = $mapped['schema']['fields'][0];
		$this->assertFalse( $field['fields']['street2']['enabled'] );
		$payload = WPFormsMapper::payload( $mapped['entry_map'], array( '1' => array( 'value' => 'x', 'address1' => '1 High St', 'city' => 'Leeds', 'postal' => 'LS1', 'country' => 'GB' ) ) );
		$this->assertSame( array( 'street_address' => '1 High St', 'city' => 'Leeds', 'postal_code' => 'LS1', 'country' => 'GB' ), $payload['where'] );
	}
}
