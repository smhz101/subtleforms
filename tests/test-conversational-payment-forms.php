<?php
/**
 * Class Conversational_Payment_Forms_Test
 *
 * @package SubtleForms
 */

use SubtleForms\Repositories\FormsRepository;

/**
 * Test cases for Conversational and Payment forms.
 */
class Conversational_Payment_Forms_Test extends WP_UnitTestCase {

	/**
	 * @var FormsRepository
	 */
	protected $repository;

	/**
	 * Set up the test fixture.
	 */
	public function setUp(): void {
		parent::setUp();
		
		// Ensure plugin is activated and tables exist
		\SubtleForms\Activator::activate();
		
		$this->repository = new FormsRepository();
	}

	/**
	 * Test creating a conversational form with proper metadata.
	 */
	public function test_create_conversational_form() {
		$schema = [
			'schema_version' => 1,
			'fields' => [
				[
					'key' => 'name',
					'type' => 'text',
					'config' => [
						'label' => 'What is your name?',
						'required' => true,
					],
				],
				[
					'key' => 'email',
					'type' => 'email',
					'config' => [
						'label' => 'What is your email?',
						'required' => true,
					],
				],
			],
			'metadata' => [
				'name' => 'conversational_test',
				'type' => 'conversational',
				'title' => 'Conversational Test Form',
				'description' => 'A conversational form for testing',
			],
			'actions' => [],
		];

		$form_id = $this->repository->create([
			'title' => 'Conversational Test Form',
			'status' => 'draft',
			'config' => [],
		]);
		$this->repository->saveSchemaVersion( $form_id, $schema, true );

		$this->assertIsInt( $form_id );
		$this->assertGreaterThan( 0, $form_id );

		$loaded = $this->repository->loadSchemaVersion( $form_id );
		$saved_schema = $loaded['schema'];

		$this->assertEquals( 'conversational', $saved_schema['metadata']['type'] );
		$this->assertEquals( 'Conversational Test Form', $saved_schema['metadata']['title'] );
		$this->assertCount( 2, $saved_schema['fields'] );
	}

	/**
	 * Test creating a payment form with payment settings.
	 */
	public function test_create_payment_form() {
		$schema = [
			'schema_version' => 1,
			'fields' => [
				[
					'key' => 'name',
					'type' => 'text',
					'config' => [
						'label' => 'Name',
						'required' => true,
					],
				],
				[
					'key' => 'amount',
					'type' => 'payment_amount',
					'config' => [
						'label' => 'Donation Amount',
						'required' => true,
						'min' => 5,
						'max' => 1000,
						'step' => 5,
						'currency' => 'USD',
					],
				],
			],
			'metadata' => [
				'name' => 'payment_test',
				'type' => 'payment',
				'title' => 'Payment Test Form',
				'description' => 'A payment form for testing',
				'payment' => [
					'enabled' => true,
					'mode' => 'test',
					'currency' => 'USD',
					'amountType' => 'field',
					'amountField' => 'amount',
				],
			],
			'actions' => [],
		];

		$form_id = $this->repository->create([
			'title' => 'Payment Test Form',
			'status' => 'draft',
			'config' => [],
		]);
		$this->repository->saveSchemaVersion( $form_id, $schema, true );

		$this->assertIsInt( $form_id );
		$this->assertGreaterThan( 0, $form_id );

		$loaded = $this->repository->loadSchemaVersion( $form_id );
		$saved_schema = $loaded['schema'];

		$this->assertEquals( 'payment', $saved_schema['metadata']['type'] );
		$this->assertTrue( $saved_schema['metadata']['payment']['enabled'] );
		$this->assertEquals( 'test', $saved_schema['metadata']['payment']['mode'] );
		$this->assertEquals( 'USD', $saved_schema['metadata']['payment']['currency'] );
		$this->assertEquals( 'field', $saved_schema['metadata']['payment']['amountType'] );
	}

	/**
	 * Test creating a conversational form with payment enabled (hybrid).
	 */
	public function test_create_conversational_payment_form() {
		$schema = [
			'schema_version' => 1,
			'fields' => [
				[
					'key' => 'name',
					'type' => 'text',
					'config' => [
						'label' => 'What is your name?',
						'required' => true,
					],
				],
				[
					'key' => 'amount',
					'type' => 'payment_amount',
					'config' => [
						'label' => 'How much would you like to donate?',
						'required' => true,
						'min' => 1,
						'currency' => 'USD',
					],
				],
			],
			'metadata' => [
				'name' => 'conversational_payment_test',
				'type' => 'conversational',
				'title' => 'Conversational Payment Form',
				'description' => 'A hybrid conversational payment form',
				'payment' => [
					'enabled' => true,
					'mode' => 'test',
					'currency' => 'USD',
					'amountType' => 'field',
					'amountField' => 'amount',
				],
			],
			'actions' => [],
		];

		$form_id = $this->repository->create([
			'title' => 'Conversational Payment Form',
			'status' => 'draft',
			'config' => [],
		]);
		$this->repository->saveSchemaVersion( $form_id, $schema, true );

		$this->assertIsInt( $form_id );
		$this->assertGreaterThan( 0, $form_id );

		$loaded = $this->repository->loadSchemaVersion( $form_id );
		$saved_schema = $loaded['schema'];

		// Verify it's conversational type with payment enabled
		$this->assertEquals( 'conversational', $saved_schema['metadata']['type'] );
		$this->assertTrue( $saved_schema['metadata']['payment']['enabled'] );
		$this->assertEquals( 'test', $saved_schema['metadata']['payment']['mode'] );
	}

	/**
	 * Test updating form type from regular to conversational.
	 */
	public function test_update_form_type_to_conversational() {
		// Create regular form
		$schema = [
			'schema_version' => 1,
			'fields' => [
				[
					'key' => 'name',
					'type' => 'text',
					'config' => [ 'label' => 'Name', 'required' => true ],
				],
			],
			'metadata' => [
				'name' => 'regular_form',
				'type' => 'regular',
				'title' => 'Regular Form',
			],
			'actions' => [],
		];

		$form_id = $this->repository->create([
			'title' => 'Regular Form',
			'status' => 'draft',
			'config' => [],
		]);
		$this->repository->saveSchemaVersion( $form_id, $schema, true );

		// Update to conversational
		$schema['metadata']['type'] = 'conversational';
		$this->repository->saveSchemaVersion( $form_id, $schema, true );

		$loaded = $this->repository->loadSchemaVersion( $form_id );
		$saved_schema = $loaded['schema'];

		$this->assertEquals( 'conversational', $saved_schema['metadata']['type'] );
	}

	/**
	 * Test payment field types in form schema.
	 */
	public function test_payment_field_types() {
		$schema = [
			'schema_version' => 1,
			'fields' => [
				[
					'key' => 'amount',
					'type' => 'payment_amount',
					'config' => [
						'label' => 'Amount',
						'min' => 0,
						'max' => 500,
					],
				],
				[
					'key' => 'coupon',
					'type' => 'payment_coupon',
					'config' => [
						'label' => 'Coupon Code',
						'placeholder' => 'Enter code',
					],
				],
				[
					'key' => 'summary',
					'type' => 'payment_summary',
					'config' => [
						'label' => 'Order Summary',
						'showSubtotal' => true,
						'showTax' => true,
						'showTotal' => true,
					],
				],
			],
			'metadata' => [
				'name' => 'payment_fields_test',
				'type' => 'payment',
				'payment' => [
					'enabled' => true,
					'mode' => 'test',
					'currency' => 'USD',
				],
			],
			'actions' => [],
		];

		$form_id = $this->repository->create([
			'title' => 'Payment Fields Test',
			'status' => 'draft',
			'config' => [],
		]);
		$this->repository->saveSchemaVersion( $form_id, $schema, true );

		$loaded = $this->repository->loadSchemaVersion( $form_id );
		$saved_schema = $loaded['schema'];

		// Verify all payment field types are preserved
		$field_types = array_column( $saved_schema['fields'], 'type' );
		$this->assertContains( 'payment_amount', $field_types );
		$this->assertContains( 'payment_coupon', $field_types );
		$this->assertContains( 'payment_summary', $field_types );
	}

	/**
	 * Test that regular forms don't have payment metadata by default.
	 */
	public function test_regular_form_no_payment() {
		$schema = [
			'schema_version' => 1,
			'fields' => [
				[ 'key' => 'name', 'type' => 'text', 'config' => [ 'label' => 'Name' ] ],
			],
			'metadata' => [
				'name' => 'regular_no_payment',
				'type' => 'regular',
				'title' => 'Regular Form',
			],
			'actions' => [],
		];

		$form_id = $this->repository->create([
			'title' => 'Regular Form',
			'status' => 'draft',
			'config' => [],
		]);
		$this->repository->saveSchemaVersion( $form_id, $schema, true );

		$loaded = $this->repository->loadSchemaVersion( $form_id );
		$saved_schema = $loaded['schema'];

		$this->assertEquals( 'regular', $saved_schema['metadata']['type'] );
		$this->assertArrayNotHasKey( 'payment', $saved_schema['metadata'] );
	}

	/**
	 * Clean up after each test.
	 */
	public function tearDown(): void {
		global $wpdb;
		$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}subtleforms_form_schemas" );
		$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}subtleforms_submissions" );
		$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}subtleforms_logs" );
		$wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}subtleforms_forms" );
		parent::tearDown();
	}
}
