<?php
/**
 * Class FormsRepositoryTest
 *
 * @package SubtleForms
 */

use SubtleForms\Repositories\FormsRepository;

/**
 * Test cases for FormsRepository.
 */
class FormsRepositoryTest extends WP_UnitTestCase {

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
	 * Test creating a form.
	 */
	public function test_create_form() {
		$data = [
			'title'  => 'Test Form',
			'status' => 'draft',
			'config' => [ 'key' => 'value' ],
		];

		$form_id = $this->repository->create( $data );

		$this->assertIsInt( $form_id );
		$this->assertGreaterThan( 0, $form_id );

		$form = $this->repository->find( $form_id );

		$this->assertEquals( 'Test Form', $form['title'] );
		$this->assertEquals( 'draft', $form['status'] );
		$this->assertEquals( [ 'key' => 'value' ], $form['config'] );
	}

	/**
	 * Test finding a form that does not exist.
	 */
	public function test_find_non_existent_form() {
		$form = $this->repository->find( 99999 );
		$this->assertNull( $form );
	}

	/**
	 * Test retrieving all forms.
	 */
	public function test_all_forms() {
		// Create a few forms
		$this->repository->create( [ 'title' => 'Form 1', 'status' => 'published' ] );
		$this->repository->create( [ 'title' => 'Form 2', 'status' => 'draft' ] );
		$this->repository->create( [ 'title' => 'Form 3', 'status' => 'published' ] );

		$forms = $this->repository->all();
		$this->assertCount( 3, $forms );

		$published_forms = $this->repository->all( [ 'status' => 'published' ] );
		$this->assertCount( 2, $published_forms );
	}

	/**
	 * Test saving a schema version.
	 */
	public function test_save_schema_version() {
		$form_id = $this->repository->create( [ 'title' => 'Schema Test Form' ] );

		$schema = [
			'schema_version' => 1,
			'metadata' => [
				'name' => 'Test Form Schema',
				'status' => 'draft',
			],
			'fields' => [
				[
					'key' => 'field_1',
					'type' => 'text',
					'label' => 'Name',
				],
			],
		];

		$version = $this->repository->saveSchemaVersion( $form_id, $schema, true );

		$this->assertEquals( 1, $version );

		// Save another version
		$schema['fields'][] = [
			'key' => 'field_2',
			'type' => 'email',
			'label' => 'Email',
		];

		$version_2 = $this->repository->saveSchemaVersion( $form_id, $schema, true );
		$this->assertEquals( 2, $version_2 );
	}
}
