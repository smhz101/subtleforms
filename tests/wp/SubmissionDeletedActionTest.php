<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Pro PRO-07: deleting an entry for good tells add-ons, so they can remove
 * what they keep about it.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\SubmissionsRepository;

final class SubmissionDeletedActionTest extends TestCase {

	public function test_a_permanent_delete_fires_the_deleted_action_with_the_entry(): void {
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$repo   = new SubmissionsRepository();
		$id     = $repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Ada' ), 'status' => 'completed' ) );

		$seen     = array();
		$callback = static function ( $deletedId, $submission ) use ( &$seen ) {
			$seen[] = array( (int) $deletedId, (int) ( $submission['form_id'] ?? 0 ) );
		};
		add_action( 'subtleforms/submission/deleted', $callback, 10, 2 );
		$repo->trash( $id );
		$this->assertSame( array(), $seen, 'Moving to the Trash is not a delete.' );
		$repo->delete( $id );
		remove_action( 'subtleforms/submission/deleted', $callback, 10 );

		$this->assertSame( array( array( $id, $formId ) ), $seen );
	}
}
