<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Pro PRO2-02 and PRO-26: every path that stores a schema a person made runs
 * the subtleforms/forms/schema_before_save filter, so add-ons can finish it
 * (a signed webhook's secret, logic rules for missing fields).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Tools\TransferPackage;
use SubtleForms\Tools\TransferService;

final class SchemaBeforeSaveTest extends TestCase {

	/** @var array<int, array{form:int, activate:bool}> */
	private array $calls = array();

	/** @var callable */
	private $filter;

	protected function setUp(): void {
		parent::setUp();
		$this->calls  = array();
		$this->filter = function ( $schema, $formId, $activate ) {
			$this->calls[]              = array( 'form' => (int) $formId, 'activate' => (bool) $activate );
			$schema['metadata']['title'] = 'Seen by the filter';
			return $schema;
		};
		add_filter( 'subtleforms/forms/schema_before_save', $this->filter, 10, 3 );
	}

	protected function tearDown(): void {
		remove_filter( 'subtleforms/forms/schema_before_save', $this->filter, 10 );
		parent::tearDown();
	}

	private function schema(): array {
		return array(
			'metadata'       => array( 'type' => 'regular', 'name' => 'Imported', 'title' => 'Imported' ),
			'schema_version' => 1,
			'fields'         => array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ),
		);
	}

	private function stored( int $formId ): array {
		$row = ( new FormsRepository() )->loadSchemaVersion( $formId ) ?: array();
		return is_array( $row['schema'] ?? null ) ? $row['schema'] : array();
	}

	public function test_forms_imported_in_tools_run_the_filter(): void {
		$service = new TransferService( new FormsRepository(), new SubmissionsRepository() );
		$result  = $service->importForms( TransferPackage::forms( array( array( 'title' => 'Imported', 'status' => 'draft', 'schema' => $this->schema() ) ) ) );
		$id      = (int) $result['created'][0]['id'];
		$this->formIds[] = $id;

		$this->assertSame( array( array( 'form' => $id, 'activate' => true ) ), $this->calls );
		$this->assertSame( 'Seen by the filter', $this->stored( $id )['metadata']['title'] ?? '' );
	}

	public function test_forms_migrated_from_another_plugin_run_the_filter(): void {
		$service = new TransferService( new FormsRepository(), new SubmissionsRepository() );
		$payload = array(
			'0' => array(
				'title'  => 'From Gravity Forms',
				'fields' => array( array( 'id' => 1, 'type' => 'text', 'label' => 'Name' ) ),
			),
		);
		$result = $service->importMigrated( 'gravity', $payload );
		$this->assertNotEmpty( $result['created'], $result['error'] );
		$id              = (int) $result['created'][0]['id'];
		$this->formIds[] = $id;

		$this->assertSame( $id, $this->calls[0]['form'] ?? 0 );
		$this->assertSame( 'Seen by the filter', $this->stored( $id )['metadata']['title'] ?? '' );
	}

	public function test_a_form_created_with_a_schema_runs_the_filter(): void {
		wp_set_current_user( 1 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/forms' );
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_body( wp_json_encode( array( 'title' => 'Created', 'schema' => $this->schema() ) ) );
		$response = rest_do_request( $request );
		$data     = $response->get_data();
		$id       = (int) ( $data['data']['id'] ?? $data['id'] ?? 0 );
		$this->assertGreaterThan( 0, $id, wp_json_encode( $data ) );
		$this->formIds[] = $id;

		$this->assertSame( $id, $this->calls[0]['form'] ?? 0 );
		$this->assertSame( 'Seen by the filter', $this->stored( $id )['metadata']['title'] ?? '' );
	}
}
