<?php

/**
 * Gravity Forms and Fluent Forms imports.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use SubtleForms\Support\SchemaValidator;
use SubtleForms\Tools\FormMigration;
use SubtleForms\Tools\TransferPackage;

/**
 * @covers \SubtleForms\Tools\FormMigration
 * @covers \SubtleForms\Tools\TransferPackage
 */
final class FormMigrationTest extends TestCase {

	public function test_gravity_export_becomes_a_valid_form(): void {
		$payload = array(
			array(
				'title'       => 'Contact',
				'description' => 'Say hello',
				'fields'      => array(
					array( 'id' => 1, 'type' => 'text', 'label' => 'Name', 'isRequired' => true ),
					array( 'id' => 2, 'type' => 'email', 'label' => 'Email', 'isRequired' => true ),
					array(
						'id'      => 3,
						'type'    => 'select',
						'label'   => 'Topic',
						'choices' => array(
							array( 'text' => 'Sales', 'value' => 'sales' ),
						),
					),
					array( 'id' => 4, 'type' => 'product', 'label' => 'Price' ),
					array( 'id' => 5, 'type' => 'name', 'label' => 'Full name' ),
				),
				'notifications' => array(
					'abc' => array(
						'isActive' => true,
						'to'       => '{admin_email}',
						'subject'  => 'New',
						'message'  => '{all_fields}',
					),
				),
				'confirmations' => array(
					'def' => array(
						'isDefault' => true,
						'type'      => 'message',
						'message'   => 'Thanks',
						'name'      => 'Default',
					),
				),
			),
		);

		$this->assertSame( 'gravity', FormMigration::detect( $payload ) );
		$preview = FormMigration::preview( 'gravity', $payload );
		$this->assertSame( '', $preview['error'] );
		$this->assertSame( 4, $preview['forms'][0]['fields'] );
		$this->assertNotEmpty( $preview['forms'][0]['notes'] );

		$built  = FormMigration::schemas( 'gravity', $payload );
		$schema = $built['forms'][0]['schema'];
		$this->assertSame( 'email', $schema['actions'][0]['type'] );
		$this->assertSame( 'Thanks', $schema['metadata']['confirmation']['message'] );
		// A Gravity name is a Name field with parts (2.6.0), not one text box.
		$this->assertSame( 'name_group', $schema['fields'][3]['type'] );
		self::validator()->validate( $schema );
	}

	/** A validator that knows the composite types, as the plugin registry does. */
	private static function validator(): SchemaValidator {
		return new SchemaValidator( array( 'text', 'email', 'textarea', 'number', 'phone', 'url', 'password', 'checkbox', 'consent', 'radio', 'multiple_choice', 'dropdown', 'date', 'time', 'file_upload', 'hidden', 'html', 'section_break', 'step', 'name_group', 'address_group', 'country', 'range_slider', 'image_upload' ) );
	}

	public function test_fluent_export_becomes_a_valid_form(): void {
		$payload = array(
			'forms' => array(
				array(
					'title'       => 'Signup',
					'form_fields' => array(
						'fields' => array(
							array(
								'element'    => 'input_email',
								'attributes' => array( 'name' => 'email' ),
								'settings'   => array(
									'label'            => 'Email',
									'validation_rules' => array( 'required' => array( 'value' => true ) ),
								),
							),
							array(
								'element'    => 'select',
								'attributes' => array( 'name' => 'plan' ),
								'settings'   => array(
									'label'            => 'Plan',
									'advanced_options' => array(
										array( 'label' => 'Pro', 'value' => 'pro' ),
									),
								),
							),
							array(
								'element'  => 'payment_method',
								'settings' => array( 'label' => 'Pay' ),
							),
						),
					),
					'formSettings' => array(
						'confirmation' => array(
							'messageToShow' => 'Welcome',
						),
					),
				),
			),
		);

		$this->assertSame( 'fluent', FormMigration::detect( $payload ) );
		$built  = FormMigration::schemas( 'fluent', $payload );
		$schema = $built['forms'][0]['schema'];
		$this->assertSame( 'email', $schema['fields'][0]['type'] );
		$this->assertSame( 'pro', $schema['fields'][1]['options'][0]['value'] );
		$this->assertCount( 2, $schema['fields'] );
		$this->assertSame( 'Welcome', $schema['metadata']['confirmation']['message'] );
		self::validator()->validate( $schema );
	}

	public function test_submission_package_drops_password_answers(): void {
		$package = TransferPackage::submissions(
			array( 'id' => 4, 'title' => 'Join' ),
			array(
				array(
					'status'     => 'read',
					'created_at' => '2026-10-01 12:00:00',
					'payload'    => TransferPackage::withoutSecrets(
						array( 'email' => 'a@b.co', 'password' => 'secret' ),
						array( 'password' )
					),
				),
			)
		);
		$read = TransferPackage::readSubmissions( $package );
		$this->assertSame( '', $read['error'] );
		$this->assertSame( 'a@b.co', $read['submissions'][0]['payload']['email'] );
		$this->assertArrayNotHasKey( 'password', $read['submissions'][0]['payload'] );
		$this->assertSame( 'read', $read['submissions'][0]['status'] );
	}

	public function test_fluent_metas_and_one_notification_are_imported(): void {
		$payload = array(
			'forms' => array(
				array(
					'title'       => 'Metas',
					'form_fields' => array(
						'fields' => array(
							array(
								'element'    => 'input_email',
								'attributes' => array( 'name' => 'email' ),
								'settings'   => array( 'label' => 'Email' ),
							),
						),
					),
					'metas'       => array(
						array(
							'meta_key' => 'notifications',
							'value'    => wp_json_encode(
								array(
									array(
										'sendTo'  => array( 'email' => 'owner@example.com' ),
										'subject' => 'Hello {inputs.email}',
										'message' => 'Hi',
									),
								)
							),
						),
						array(
							'meta_key' => 'formSettings',
							'value'    => wp_json_encode(
								array(
									'confirmation' => array( 'messageToShow' => 'Saved' ),
								)
							),
						),
					),
				),
			),
		);
		$built = FormMigration::schemas( 'fluent', $payload );
		$schema = $built['forms'][0]['schema'];
		$this->assertSame( 'owner@example.com', $schema['actions'][0]['settings']['to'] );
		$this->assertSame( 'Hello {field:email}', $schema['actions'][0]['settings']['subject'] );
		$this->assertSame( 'Saved', $schema['metadata']['confirmation']['message'] );
		$this->assertStringContainsString( '1 email notification was copied', implode( ' ', $built['forms'][0]['notes'] ) );

		$single = array(
			'forms' => array(
				array(
					'title'         => 'Old',
					'form_fields'   => array( 'fields' => array() ),
					'notifications' => array(
						'sendTo'      => array( 'email' => 'one@example.com' ),
						'subject'     => 'Only one',
						'message'     => 'Body',
						'conditionals' => array( 'status' => true ),
					),
				),
			),
		);
		$old = FormMigration::schemas( 'fluent', $single );
		$this->assertCount( 1, $old['forms'][0]['schema']['actions'] );
		$this->assertSame( 'one@example.com', $old['forms'][0]['schema']['actions'][0]['settings']['to'] );
		$this->assertSame( 'Only one', $old['forms'][0]['schema']['actions'][0]['settings']['subject'] );
	}

	public function test_fluent_container_step_hidden_and_name_are_real_fields(): void {
		$payload = array(
			'forms' => array(
				array(
					'title'       => 'Layout',
					'form_fields' => array(
						'fields' => array(
							array(
								'element' => 'container',
								'columns' => array(
									array(
										'fields' => array(
											array(
												'element'    => 'input_text',
												'attributes' => array( 'name' => 'company' ),
												'settings'   => array( 'label' => 'Company' ),
											),
										),
									),
									array(
										'fields' => array(
											array(
												'element'    => 'input_text',
												'attributes' => array( 'name' => 'job' ),
												'settings'   => array( 'label' => 'Job title' ),
											),
										),
									),
								),
							),
							array(
								'element'  => 'form_step',
								'settings' => array( 'title' => 'Details' ),
							),
							array(
								'element'    => 'input_hidden',
								'attributes' => array( 'name' => 'source', 'value' => 'ad' ),
								'settings'   => array( 'value' => 'ad' ),
							),
							array(
								'element'    => 'input_name',
								'attributes' => array( 'name' => 'names' ),
								'settings'   => array(
									'label'              => '',
									'admin_field_label'  => 'Name',
									'validation_rules'   => array( 'required' => array( 'value' => true ) ),
								),
							),
							array(
								'element'  => 'custom_payment_amount',
								'settings' => array( 'label' => 'Amount' ),
							),
							array(
								'element'  => 'payment_summary_component',
								'settings' => array( 'label' => 'Summary' ),
							),
						),
					),
				),
			),
		);
		$built   = FormMigration::schemas( 'fluent', $payload );
		$schema  = $built['forms'][0]['schema'];
		// A Fluent step splits the form into steps that hold the fields (2.6.0).
		$this->assertSame( array( 'step', 'step' ), array_column( $schema['fields'], 'type' ) );
		$first  = $schema['fields'][0]['children'];
		$second = $schema['fields'][1]['children'];
		$this->assertSame( array( 'text', 'text' ), array_column( $first, 'type' ) );
		$this->assertSame( array( 'hidden', 'name_group' ), array_column( $second, 'type' ) );
		$this->assertSame( 'Company', $first[0]['label'] );
		$this->assertSame( 'Job title', $first[1]['label'] );
		$this->assertSame( 'ad', $second[0]['value'] );
		$this->assertSame( 'Name', $second[1]['label'] );
		$this->assertTrue( $second[1]['required'] );
		// Fluent's own field name is kept as the field ID (2.4.1).
		$this->assertSame( 'names', $second[1]['key'] );
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		$notes = implode( ' ', $built['forms'][0]['notes'] );
		$this->assertStringContainsString( 'payments are not imported', $notes );
		$this->assertStringNotContainsString( 'was a container field', $notes );
		self::validator()->validate( $schema );
	}

	public function test_gravity_pages_logic_tags_and_payments(): void {
		$payload = array(
			array(
				'title'  => 'Apply',
				'fields' => array(
					array( 'id' => 1, 'type' => 'text', 'label' => 'Full name', 'adminLabel' => '' ),
					array( 'id' => 2, 'type' => 'page', 'label' => 'Next' ),
					array(
						'id'               => 3,
						'type'             => 'select',
						'label'            => 'Plan',
						'choices'          => array( array( 'text' => 'Pro', 'value' => 'pro' ) ),
						'conditionalLogic' => array(
							'enabled'    => true,
							'actionType' => 'show',
							'logicType'  => 'all',
							'rules'      => array(
								array( 'fieldId' => '1', 'operator' => 'is', 'value' => 'Ada' ),
							),
						),
					),
					array(
						'id'            => 4,
						'type'          => 'consent',
						'label'         => 'Agree',
						'checkboxLabel' => 'I agree to the terms',
					),
					array(
						'id'      => 5,
						'type'    => 'multiselect',
						'label'   => 'Topics',
						'choices' => array( array( 'text' => 'News', 'value' => 'news' ) ),
					),
					array( 'id' => 6, 'type' => 'stripe_creditcard', 'label' => 'Card' ),
					array( 'id' => 7, 'type' => 'paypal', 'label' => 'PayPal' ),
				),
				'notifications' => array(
					'n' => array(
						'toType'  => 'field',
						'to'      => '1',
						'subject' => 'Hi {Name (First):1.3}',
						'message' => 'From {Full name:1}',
					),
				),
				'confirmations' => array(
					'c' => array(
						'isDefault' => true,
						'type'      => 'page',
						'pageId'    => 42,
						'url'       => '',
					),
				),
			),
		);
		$built  = FormMigration::schemas( 'gravity', $payload );
		$schema = $built['forms'][0]['schema'];
		// The page break splits the form into two steps (2.6.0).
		$this->assertSame( array( 'step', 'step' ), array_column( $schema['fields'], 'type' ) );
		$page1 = $schema['fields'][0]['children'];
		$page2 = $schema['fields'][1]['children'];
		$this->assertSame( 'full_name', $page1[0]['key'] );
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		$this->assertSame( 'equals', $page2[0]['logic']['groups'][0]['rules'][0]['operator'] );
		$this->assertSame( 'full_name', $page2[0]['logic']['groups'][0]['rules'][0]['field'] );
		$this->assertSame( 'I agree to the terms', $page2[1]['checkboxLabel'] );
		$this->assertSame( 'multiple_choice', $page2[2]['type'] );
		$this->assertTrue( $page2[2]['allowMultiple'] );
		$this->assertSame( '{field:full_name}', $schema['actions'][0]['settings']['to'] );
		$this->assertSame( 'Hi {field:full_name}', $schema['actions'][0]['settings']['subject'] );
		$this->assertSame( 'From {field:full_name}', $schema['actions'][0]['settings']['message'] );
		$this->assertSame( '/?page_id=42', $schema['metadata']['confirmation']['redirectUrl'] );
		$notes = implode( ' ', $built['forms'][0]['notes'] );
		$this->assertStringContainsString( 'payments are not imported', $notes );
		self::validator()->validate( $schema );
	}

	public function test_a_forms_package_rejects_the_wrong_kind(): void {
		$read = TransferPackage::readForms( array( 'subtleforms' => 1, 'kind' => 'submissions' ) );
		$this->assertSame( array(), $read['forms'] );
		$this->assertNotSame( '', $read['error'] );
	}

	public function test_submission_package_keeps_inbox_state_and_skips_trash(): void {
		$package = TransferPackage::submissions(
			array( 'id' => 4, 'title' => 'Join' ),
			array(
				array(
					'status'     => 'spam',
					'is_read'    => 1,
					'starred'    => 1,
					'created_at' => '2026-10-01 12:00:00',
					'payload'    => array( 'email' => 'a@b.co' ),
				),
				array(
					'status'     => 'processing',
					'created_at' => '2026-10-02 12:00:00',
					'payload'    => array( 'email' => 'b@b.co' ),
				),
				array(
					'status'     => 'trash',
					'created_at' => '2026-10-03 12:00:00',
					'payload'    => array( 'email' => 'c@b.co' ),
				),
				array(
					'status'     => 'made-up',
					'created_at' => '2026-10-04 12:00:00',
					'payload'    => array( 'email' => 'd@b.co' ),
				),
			)
		);
		$read = TransferPackage::readSubmissions( $package );
		$this->assertSame( '', $read['error'] );
		$this->assertCount( 3, $read['submissions'] );
		$this->assertSame( 'spam', $read['submissions'][0]['status'] );
		$this->assertSame( 1, $read['submissions'][0]['is_read'] );
		$this->assertSame( 1, $read['submissions'][0]['starred'] );
		$this->assertSame( 'processing', $read['submissions'][1]['status'] );
		$this->assertSame( 0, $read['submissions'][1]['starred'] );
		$this->assertSame( 'unread', $read['submissions'][2]['status'] );
	}

	/**
	 * Imports keep the other plugin's field names as field IDs when they are
	 * valid and unused (2.4.1): Fluent Forms' name, Gravity Forms' parameter
	 * name. Anything else gets an ID from the label, as before.
	 */
	public function test_imports_keep_incoming_field_names_when_valid(): void {
		$gravity = FormMigration::schemas(
			'gravity',
			array(
				array(
					'title'  => 'Contact',
					'fields' => array(
						array( 'id' => 1, 'type' => 'text', 'label' => 'Name', 'inputName' => 'crm_name' ),
						array( 'id' => 2, 'type' => 'email', 'label' => 'Email', 'inputName' => '2bad' ),
						array( 'id' => 3, 'type' => 'text', 'label' => 'Again', 'inputName' => 'crm_name' ),
						array( 'id' => 4, 'type' => 'text', 'label' => 'Trap', 'inputName' => 'website_url' ),
					),
				),
			)
		)['forms'][0]['schema'];
		$keys = array_column( $gravity['fields'], 'key' );
		$this->assertSame( 'crm_name', $keys[0] );
		$this->assertSame( 'email', $keys[1] );
		$this->assertSame( 'again', $keys[2] );
		$this->assertSame( 'trap', $keys[3] );
		self::validator()->validate( $gravity );

		$fluent = FormMigration::schemas(
			'fluent',
			array(
				array(
					'title'       => 'Signup',
					'form_fields' => array(
						'fields' => array(
							array( 'element' => 'input_text', 'attributes' => array( 'name' => 'company-name' ), 'settings' => array( 'label' => 'Company' ) ),
							array( 'element' => 'input_email', 'attributes' => array( 'name' => 'email' ), 'settings' => array( 'label' => 'Work email' ) ),
						),
					),
				),
			)
		)['forms'][0]['schema'];
		$this->assertSame( array( 'company-name', 'email' ), array_column( $fluent['fields'], 'key' ) );
		self::validator()->validate( $fluent );
	}
}
