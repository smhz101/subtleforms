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
		( new SchemaValidator() )->validate( $schema );
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
		( new SchemaValidator() )->validate( $schema );
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
					'form_fields' => array( 'fields' => array() ),
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
		$this->assertStringContainsString( 'Imported 1 email notification', implode( ' ', $built['forms'][0]['notes'] ) );

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
		$types   = array_column( $schema['fields'], 'type' );
		$this->assertSame( array( 'text', 'text', 'form_step', 'hidden', 'text' ), $types );
		$this->assertSame( 'Company', $schema['fields'][0]['label'] );
		$this->assertSame( 'Job title', $schema['fields'][1]['label'] );
		$this->assertSame( 'ad', $schema['fields'][3]['value'] );
		$this->assertSame( 'Name', $schema['fields'][4]['label'] );
		$this->assertTrue( $schema['fields'][4]['required'] );
		$this->assertNotSame( 'names', $schema['fields'][4]['key'] );
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		$notes = implode( ' ', $built['forms'][0]['notes'] );
		$this->assertStringContainsString( 'left out', $notes );
		$this->assertStringNotContainsString( 'was a container field', $notes );
		foreach ( $schema['fields'] as $field ) {
			$this->assertNotSame( 'html', $field['type'] );
		}
		( new SchemaValidator() )->validate( $schema );
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
		$this->assertSame( 'full_name', $schema['fields'][0]['key'] );
		$this->assertSame( 'form_step', $schema['fields'][1]['type'] );
		$this->assertSame( 'multi-step', $schema['metadata']['type'] );
		$this->assertSame( 'equals', $schema['fields'][2]['logic']['groups'][0]['rules'][0]['operator'] );
		$this->assertSame( 'full_name', $schema['fields'][2]['logic']['groups'][0]['rules'][0]['field'] );
		$this->assertSame( 'I agree to the terms', $schema['fields'][3]['checkboxLabel'] );
		$this->assertSame( 'multiple_choice', $schema['fields'][4]['type'] );
		$this->assertTrue( $schema['fields'][4]['allowMultiple'] );
		$this->assertSame( '{field:full_name}', $schema['actions'][0]['settings']['to'] );
		$this->assertSame( 'Hi {field:full_name}', $schema['actions'][0]['settings']['subject'] );
		$this->assertSame( 'From {field:full_name}', $schema['actions'][0]['settings']['message'] );
		$this->assertSame( '/?page_id=42', $schema['metadata']['confirmation']['redirectUrl'] );
		$notes = implode( ' ', $built['forms'][0]['notes'] );
		$this->assertStringContainsString( 'left out', $notes );
		$this->assertStringContainsString( 'WordPress page 42', $notes );
		foreach ( $schema['fields'] as $field ) {
			$this->assertNotContains( $field['type'], array( 'html' ) );
		}
		( new SchemaValidator() )->validate( $schema );
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
}
