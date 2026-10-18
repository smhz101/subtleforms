<?php
/**
 * Gravity Forms and Fluent Forms imports.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

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
