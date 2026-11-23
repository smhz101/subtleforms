<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Opening an unread entry says it was marked read, so the screen can lower
 * the Unread count (issue 130).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\SubmissionsRepository;

final class UnreadMarkedRead130Test extends TestCase {

	private function entry( int $formId, int $isRead ): int {
		$repo = new SubmissionsRepository();
		$id   = $repo->create(
			array(
				'form_id'        => $formId,
				'schema_version' => 1,
				'payload'        => array( 'name' => 'Ada' ),
				'status'         => 'completed',
			)
		);
		$repo->update( $id, array( 'is_read' => $isRead ) );
		return $id;
	}

	private function open( int $entryId ): array {
		$this->asAdmin();
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/submissions/' . $entryId );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		return rest_do_request( $request )->get_data()['data'];
	}

	public function test_get_of_an_unread_entry_returns_is_read_1_and_marked_read_true(): void {
		$formId = $this->publish( array( array( 'type' => 'text', 'key' => 'name', 'label' => 'Name' ) ) );
		$id     = $this->entry( $formId, 0 );
		$data   = $this->open( $id );
		$this->assertSame( 1, (int) $data['is_read'] );
		$this->assertTrue( $data['marked_read'] );
		$this->assertSame( 1, (int) ( new SubmissionsRepository() )->find( $id )['is_read'] );
	}

	public function test_get_of_a_read_entry_has_no_marked_read(): void {
		$formId = $this->publish( array( array( 'type' => 'text', 'key' => 'name', 'label' => 'Name' ) ) );
		$data   = $this->open( $this->entry( $formId, 1 ) );
		$this->assertArrayNotHasKey( 'marked_read', $data );
		$this->assertSame( 1, (int) $data['is_read'] );
	}
}
