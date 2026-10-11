<?php
// phpcs:disable -- Test helper; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\FormsRepository;

/**
 * Base class: creates published forms and cleans up after each test.
 */
abstract class TestCase extends \PHPUnit\Framework\TestCase {

	/** @var int[] */
	protected $formIds = array();

	protected function tearDown(): void {
		global $wpdb;
		foreach ( $this->formIds as $id ) {
			$wpdb->delete( $wpdb->prefix . 'subtleforms_submissions', array( 'form_id' => $id ) );
			$wpdb->delete( $wpdb->prefix . 'subtleforms_form_schemas', array( 'form_id' => $id ) );
			$wpdb->delete( $wpdb->prefix . 'subtleforms_forms', array( 'id' => $id ) );
		}
		$this->formIds = array();
		wp_set_current_user( 0 );
		parent::tearDown();
	}

	/**
	 * Create and publish a form.
	 *
	 * @param array $fields  Field nodes.
	 * @param array $actions Pipeline actions.
	 * @return int Form ID.
	 */
	protected function publish( array $fields, array $actions = array() ): int {
		$repo   = new FormsRepository();
		$schema = array(
			'metadata'       => array(
				'type'  => 'regular',
				'name'  => 'WP test',
				'title' => 'WP test',
			),
			'schema_version' => 1,
			'fields'         => $fields,
		);
		if ( $actions ) {
			$schema['actions'] = $actions;
		}
		$id = $repo->create(
			array(
				'title'  => 'WP test',
				'status' => 'published',
				'schema' => $schema,
			)
		);
		$repo->saveSchemaVersion( $id, $schema, true );
		$this->formIds[] = $id;
		return $id;
	}

	/**
	 * Submit answers through the public REST endpoint as a visitor.
	 *
	 * @return array{status:int,data:mixed}
	 */
	protected function submit( int $formId, array $data ): array {
		wp_set_current_user( 0 );
		$data['form_rendered_at'] = time() - 60;
		$request                  = new \WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body(
			wp_json_encode(
				array(
					'form_id' => $formId,
					'data'    => $data,
				)
			)
		);
		$response = rest_do_request( $request );
		return array(
			'status' => $response->get_status(),
			'data'   => $response->get_data(),
		);
	}

	/** Stored payload of the newest entry of a form, straight from the table. */
	protected function storedPayload( int $formId ): array {
		global $wpdb;
		$raw = $wpdb->get_var( $wpdb->prepare( "SELECT payload FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1", $formId ) );
		return is_string( $raw ) ? (array) json_decode( $raw, true ) : array();
	}

	/** Raw stored payload and meta of the newest entry, as one string. */
	protected function storedRow( int $formId ): string {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT payload, meta FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1", $formId ), ARRAY_A );
		return $row ? ( (string) $row['payload'] . ' ' . (string) $row['meta'] ) : '';
	}

	/** Become the first administrator. */
	protected function asAdmin(): void {
		$admins = get_users(
			array(
				'role'   => 'administrator',
				'number' => 1,
			)
		);
		wp_set_current_user( $admins ? $admins[0]->ID : 1 );
	}
}
