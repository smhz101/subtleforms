<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * The public form data tells the browser how long the time trap waits, so a
 * fast submit can be held instead of dropped (issue 126).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Engine\SpamProtection;
use SubtleForms\Repositories\FormsRepository;

final class TimeTrapMinSeconds126Test extends TestCase {

	private function formWithSpam( array $spam ): int {
		$repo   = new FormsRepository();
		$schema = array(
			'metadata'       => array(
				'type'  => 'regular',
				'name'  => 'Trap',
				'title' => 'Trap',
				'spam'  => $spam,
			),
			'schema_version' => 1,
			'fields'         => array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ),
		);
		$id     = $repo->create( array( 'title' => 'Trap', 'status' => 'published', 'schema' => $schema ) );
		$repo->saveSchemaVersion( $id, $schema, true );
		$this->formIds[] = $id;
		return $id;
	}

	private function config( int $formId ): array {
		wp_set_current_user( 0 );
		$response = rest_do_request( new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $formId . '/schema' ) );
		$this->assertSame( 200, $response->get_status() );
		return $response->get_data()['data'];
	}

	public function test_config_carries_the_minimum_when_the_time_trap_is_on(): void {
		$id   = $this->formWithSpam( array( 'honeypot' => true, 'timeTrap' => true ) );
		$min  = SpamProtection::for_form( array( 'metadata' => array( 'spam' => array( 'timeTrap' => true ) ) ) )['minSeconds'];
		$data = $this->config( $id );

		$this->assertGreaterThan( 0, $min );
		$this->assertSame( $min, $data['spam_min_seconds'] );
	}

	public function test_config_carries_zero_when_the_time_trap_is_off(): void {
		$id = $this->formWithSpam( array( 'honeypot' => true, 'timeTrap' => false ) );
		$this->assertSame( 0, $this->config( $id )['spam_min_seconds'] );
	}
}
