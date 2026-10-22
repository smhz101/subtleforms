<?php
/**
 * Gravity Forms import: fields, pages, logic, notifications and confirmations.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/ImportTestCase.php';

use SubtleForms\Tools\Import\GravityMapper;

/**
 * @covers \SubtleForms\Tools\Import\GravityMapper
 */
final class ImportGravityTest extends ImportTestCase {

	/**
	 * The fixture as GravitySource::read() returns it.
	 *
	 * @return array
	 */
	private static function form(): array {
		$row                     = self::fixture( 'gf-application.json' );
		$form                    = $row['display_meta'];
		$form['notifications']   = $row['notifications'];
		$form['confirmations']   = $row['confirmations'];
		return $form;
	}

	public function test_pages_become_steps_holding_their_fields(): void {
		$schema = GravityMapper::map( self::form(), self::CONTEXT )['schema'];
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		$this->assertSame( array( 'step', 'step' ), array_column( $schema['fields'], 'type' ) );
		$this->assertSame( array( 'About you', 'Your application' ), array_column( $schema['fields'], 'title' ) );
		$this->assertSame( array( 'name', 'applicant_email', 'phone', 'address', 'portfolio' ), array_column( $schema['fields'][0]['children'], 'key' ) );
		$this->assertSame( 'the_role', $schema['fields'][1]['children'][0]['key'] );
		self::assertSavable( $schema );
	}

	public function test_each_common_field_keeps_its_settings(): void {
		$f = self::byKey( GravityMapper::map( self::form(), self::CONTEXT )['schema']['fields'] );

		$this->assertSame( 'name_group', $f['name']['type'] );
		$this->assertTrue( $f['name']['required'] );
		$this->assertTrue( $f['name']['fields']['first_name']['enabled'] );
		$this->assertSame( 'Jane', $f['name']['fields']['first_name']['placeholder'] );
		$this->assertFalse( $f['name']['fields']['middle_name']['enabled'] );
		$this->assertTrue( $f['name']['fields']['last_name']['enabled'] );
		$this->assertFalse( $f['name']['fields']['suffix']['enabled'] );

		$this->assertSame( 'email', $f['applicant_email']['type'], 'The parameter name is kept as the field ID.' );
		$this->assertSame( 'you@example.com', $f['applicant_email']['placeholder'] );
		$this->assertSame( 'We only call about this application.', $f['phone']['description'] );

		$this->assertSame( 'address_group', $f['address']['type'] );
		$this->assertTrue( $f['address']['fields']['street']['enabled'] );
		$this->assertFalse( $f['address']['fields']['street2']['enabled'] );
		$this->assertSame( 'ZIP / Postal Code', $f['address']['fields']['postal']['label'] );

		$this->assertSame( 'url', $f['portfolio']['type'] );
		$this->assertSame( 'section_break', $f['the_role']['type'] );
		$this->assertSame( 'Tell us which role you want.', $f['the_role']['description'] );

		$this->assertSame( 'dropdown', $f['role']['type'] );
		$this->assertSame( array( 'label' => 'Developer', 'value' => 'dev' ), $f['role']['options'][1] );
		$this->assertSame( 'dev', $f['role']['defaultValue'], 'The selected choice is the default.' );
		$this->assertSame( 'Choose a role', $f['role']['placeholder'] );
		$this->assertSame( 'radio', $f['can_you_start_this_month']['type'] );
		$this->assertSame( 300, $f['when_can_you_start']['maxLength'] );
		$this->assertSame( 'multiple_choice', $f['skills']['type'] );
		$this->assertSame( 'react, writing', $f['skills']['defaultValue'] );
		$this->assertTrue( $f['languages']['allowMultiple'] );
		$this->assertSame( array( 0, 40 ), array( $f['years_of_experience']['min'], $f['years_of_experience']['max'] ) );
		$this->assertSame( 'date', $f['available_from']['type'] );
		$this->assertSame( 'time', $f['best_time_to_call']['type'] );
		$this->assertSame( 'file_upload', $f['cv']['type'] );
		$this->assertSame( 'pdf, docx', $f['cv']['allowedExtensions'] );
		$this->assertSame( 5 * 1048576, $f['cv']['maxSize'] );
		$this->assertSame( 'hidden', $f['source']['type'] );
		$this->assertSame( '{user_email}', $f['source']['value'], 'Gravity tags SubtleForms has become its tokens.' );
		$this->assertSame( '<p>We read every application.</p>', $f['html_block']['content'] );
		$this->assertSame( 'consent', $f['consent']['type'] );
		$this->assertSame( 'I agree to the privacy policy.', $f['consent']['checkboxLabel'] );
		$this->assertTrue( $f['consent']['required'] );
	}

	public function test_conditional_logic_maps_onto_subtleforms_logic(): void {
		$f = self::byKey( GravityMapper::map( self::form(), self::CONTEXT )['schema']['fields'] );
		$this->assertSame(
			array(
				'action' => 'show',
				'groups' => array(
					array(
						'match' => 'all',
						'rules' => array(
							array(
								'field'    => 'can_you_start_this_month',
								'operator' => 'equals',
								'value'    => 'no',
							),
						),
					),
				),
			),
			$f['when_can_you_start']['logic']
		);
	}

	public function test_logic_on_a_part_of_a_field_is_reported_not_guessed(): void {
		$form             = self::form();
		$form['fields'][] = array(
			'id'               => 40,
			'type'             => 'text',
			'label'            => 'Nickname',
			'conditionalLogic' => array(
				'actionType' => 'hide',
				'logicType'  => 'any',
				'rules'      => array(
					array( 'fieldId' => '1.3', 'operator' => 'is', 'value' => 'Jane' ),
					array( 'fieldId' => '8', 'operator' => 'greater_than_or_equal', 'value' => '1' ),
				),
			),
		);
		$mapped = GravityMapper::map( $form, self::CONTEXT );
		$f      = self::byKey( $mapped['schema']['fields'] );
		$this->assertArrayNotHasKey( 'logic', $f['nickname'] );
		$this->assertStringContainsString( "Some conditions on 'Nickname' were not copied", self::report( $mapped['notes'] ) );
	}

	public function test_notifications_map_recipients_merge_tags_conditions_and_headers(): void {
		$mapped  = GravityMapper::map( self::form(), self::CONTEXT );
		$actions = $mapped['schema']['actions'];
		$this->assertCount( 3, $actions );

		$admin = $actions[0]['settings'];
		$this->assertTrue( $actions[0]['enabled'] );
		$this->assertSame( '{admin_email}', $admin['to'] );
		$this->assertSame( 'New application: {field:name}', $admin['subject'], 'First and last name parts read as the one Name answer.' );
		$this->assertSame( '{all_fields}', $admin['message'] );
		$this->assertSame( array( 'From: Careers <admin@demo.test>', 'Bcc: hiring@example.com' ), $admin['headers'] );

		$receipt = $actions[1]['settings'];
		$this->assertSame( '{field:applicant_email}', $receipt['to'], 'A notification sent to a field goes to that answer.' );
		$this->assertSame( 'Thanks for applying, {field:name}', $receipt['subject'] );
		$this->assertStringContainsString( '{field:role}', $receipt['message'] );
		$this->assertStringContainsString( 'on {date}', $receipt['message'] );
		$this->assertSame( 'not_equals', $receipt['logic']['groups'][0]['rules'][0]['operator'] );
		$this->assertSame( array( 'From: careers@example.com' ), $receipt['headers'] );

		$this->assertFalse( $actions[2]['enabled'], 'Routing is not copied, so that email is off.' );
		$this->assertSame( '{admin_email}', $actions[2]['settings']['to'] );

		$report = self::report( $mapped['notes'] );
		$this->assertStringContainsString( 'routing rules', $report );
		$this->assertSame( '{field:applicant_email}', $admin['replyTo'], 'Reply-To from an answer comes across.' );
		$this->assertStringNotContainsString( 'Reply-To', $report );
		$this->assertStringContainsString( 'The merge tag {ip} has no SubtleForms equivalent', $report );
		$this->assertStringContainsString( 'The file attachments of the email \'Admin Notification\'', $report );
		$this->assertStringContainsString( '3 email notifications were copied.', $report );
	}

	public function test_the_default_confirmation_is_used_and_the_conditional_one_reported(): void {
		$mapped = GravityMapper::map( self::form(), self::CONTEXT );
		$this->assertSame(
			array(
				'type'    => 'message',
				'message' => 'Thanks {field:name}! We will reply to {field:applicant_email} within a week.',
			),
			$mapped['schema']['metadata']['confirmation']
		);
		$this->assertStringContainsString( '1 conditional confirmation was not copied', self::report( $mapped['notes'] ) );
	}

	public function test_redirect_and_page_confirmations_become_redirects(): void {
		$form                  = self::form();
		$form['confirmations'] = array(
			'a' => array( 'isDefault' => true, 'type' => 'redirect', 'url' => 'https://example.com/thanks', 'queryString' => 'role={Role:8}' ),
		);
		$this->assertSame( 'https://example.com/thanks?role={field:role}', GravityMapper::map( $form, self::CONTEXT )['schema']['metadata']['confirmation']['redirectUrl'] );
		$form['confirmations'] = array( 'b' => array( 'isDefault' => true, 'type' => 'page', 'pageId' => 12 ) );
		$this->assertSame( '/?page_id=12', GravityMapper::map( $form, self::CONTEXT )['schema']['metadata']['confirmation']['redirectUrl'] );
	}

	public function test_unsupported_fields_are_skipped_with_a_plain_reason(): void {
		$mapped = GravityMapper::map( self::form(), self::CONTEXT );
		$f      = self::byKey( $mapped['schema']['fields'] );
		$report = self::report( $mapped['notes'] );
		foreach ( array( 'references', 'application_fee', 'captcha' ) as $key ) {
			$this->assertArrayNotHasKey( $key, $f );
		}
		$this->assertStringContainsString( "Gravity Forms field 'Application fee' (type product) was skipped: payments are not imported.", $report );
		$this->assertStringContainsString( "Gravity Forms field 'References' (type list) was skipped: list fields have no SubtleForms equivalent.", $report );
		$this->assertStringContainsString( "(type captcha) was skipped", $report );
		$this->assertStringContainsString( 'confirm email', $report );
		$this->assertStringContainsString( 'The "Other" choice', $report );
	}

	public function test_form_settings_carry_across(): void {
		$metadata = GravityMapper::map( self::form(), self::CONTEXT )['schema']['metadata'];
		$this->assertSame( 'Job application', $metadata['title'] );
		$this->assertSame( 'Apply for an open role.', $metadata['description'] );
		$this->assertSame( 'Send application', $metadata['submitText'] );
		$this->assertSame( array( 'entryLimit' => 200, 'limitMessage' => 'Applications are closed.' ), $metadata['restrictions'] );
	}

	public function test_a_hidden_or_admin_only_field_is_a_hidden_field(): void {
		$mapped = GravityMapper::map(
			array(
				'title'  => 'Internal',
				'fields' => array(
					array( 'id' => 1, 'type' => 'text', 'label' => 'Staff note', 'visibility' => 'administrative', 'defaultValue' => 'n/a' ),
					array( 'id' => 2, 'type' => 'name', 'label' => 'Name', 'nameFormat' => 'simple' ),
					array( 'id' => 3, 'type' => 'text', 'label' => 'Ref', 'defaultValue' => '{embed_url}' ),
				),
			),
			self::CONTEXT
		);
		$f = self::byKey( $mapped['schema']['fields'] );
		$this->assertSame( 'hidden', $f['staff_note']['type'] );
		$this->assertSame( 'n/a', $f['staff_note']['value'] );
		$this->assertSame( 'text', $f['name']['type'], 'A one-box name stays one box.' );
		$this->assertArrayNotHasKey( 'defaultValue', $f['ref'] );
		$this->assertStringContainsString( 'The default value {embed_url}', self::report( $mapped['notes'] ) );
		self::assertSavable( $mapped['schema'] );
	}
}
