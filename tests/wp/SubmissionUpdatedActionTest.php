<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Changing an entry tells add-ons, so they can keep an index of it.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\SubmissionsRepository;

final class SubmissionUpdatedActionTest extends TestCase {

	public function test_an_update_fires_the_updated_action_with_the_stored_entry(): void {
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$repo   = new SubmissionsRepository();
		$id     = $repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Ada' ), 'status' => 'completed' ) );

		$seen     = array();
		$callback = static function ( $updatedId, $submission ) use ( &$seen ) {
			$seen[] = array( (int) $updatedId, $submission['meta']['payment']['status'] ?? '' );
		};
		add_action( 'subtleforms/submission/updated', $callback, 10, 2 );
		$repo->update( $id, array( 'status' => 'completed', 'meta' => array( 'payment' => array( 'status' => 'paid' ) ) ) );
		remove_action( 'subtleforms/submission/updated', $callback, 10 );

		$this->assertSame( array( array( $id, 'paid' ) ), $seen );
	}
}
