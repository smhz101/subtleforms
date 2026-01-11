<?php
/**
 * Class SubmissionsRepositoryTest
 *
 * @package SubtleForms
 */

use PHPUnit\Framework\TestCase;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Repositories\FormsRepository;

/**
 * Test cases for SubmissionsRepository.
 */
class SubmissionsRepositoryTest extends WP_UnitTestCase {

	/**
	 * @var SubmissionsRepository
	 */
	protected $repository;

	/**
	 * @var FormsRepository
	 */
	protected $forms_repository;

	/**
	 * @var int
	 */
	protected $form_id;

	/**
	 * Set up the test fixture.
	 */
	public function setUp(): void {
		parent::setUp();
		
		// Ensure plugin is activated and tables exist
		\SubtleForms\Activator::activate();
		
		$this->repository = new SubmissionsRepository();
		$this->forms_repository = new FormsRepository();

		// Create a dummy form for submissions
		$this->form_id = $this->forms_repository->create( [ 'title' => 'Submission Test Form' ] );
	}

	/**
	 * Test creating a submission.
	 */
	public function test_create_submission() {
		$data = [
			'form_id' => $this->form_id,
			'payload' => [ 'field_1' => 'value_1' ],
			'status' => 'unread',
		];

		$submission_id = $this->repository->create( $data );

		$this->assertIsInt( $submission_id );
		$this->assertGreaterThan( 0, $submission_id );

		$submission = $this->repository->find( $submission_id );

		$this->assertEquals( $this->form_id, $submission['form_id'] );
		$this->assertEquals( [ 'field_1' => 'value_1' ], $submission['payload'] );
		$this->assertEquals( 'unread', $submission['status'] );
	}

	/**
	 * Test finding submissions by form.
	 */
	public function test_find_by_form() {
		// Create a few submissions
		$this->repository->create( [ 'form_id' => $this->form_id, 'payload' => [ 'a' => 1 ] ] );
		$this->repository->create( [ 'form_id' => $this->form_id, 'payload' => [ 'b' => 2 ] ] );

		$submissions = $this->repository->findByForm( $this->form_id );
		$this->assertCount( 2, $submissions );
	}

	/**
	 * Test finding a non-existent submission.
	 */
	public function test_find_non_existent_submission() {
		$submission = $this->repository->find( 99999 );
		$this->assertNull( $submission );
	}
}
