<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Tab counts of the Submissions screen: one query gives every tab its
 * number, and entries in the Trash count only under Trash.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\SubmissionsRepository;

final class SubmissionTabCountsTest extends TestCase {

	/** @var SubmissionsRepository */
	private $repo;

	protected function setUp(): void {
		parent::setUp();
		$this->repo = new SubmissionsRepository();
	}

	private function entry( int $formId, array $row = array() ): int {
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'subtleforms_submissions',
			array_merge(
				array(
					'form_id'        => $formId,
					'schema_version' => 1,
					'payload'        => '{"name":"Ada"}',
					'meta'           => '{}',
					'status'         => 'completed',
					'is_read'        => 0,
					'starred'        => 0,
					'created_at'     => gmdate( 'Y-m-d H:i:s' ),
				),
				$row
			)
		);
		return (int) $wpdb->insert_id;
	}

	private function seed(): int {
		$form = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->entry( $form );                                              // new.
		$this->entry( $form );                                              // new.
		$this->entry( $form, array( 'is_read' => 1 ) );                     // read.
		$this->entry( $form, array( 'is_read' => 1, 'starred' => 1 ) );     // read and starred.
		$this->entry( $form, array( 'status' => 'spam' ) );                 // new spam.
		$this->entry( $form, array( 'status' => 'flagged', 'is_read' => 1 ) );
		// Trashed entries: unread, starred and spam before they were trashed.
		$this->entry( $form, array( 'status' => 'trash', 'trashed_from' => 'spam' ) );
		$this->entry( $form, array( 'status' => 'trash', 'trashed_from' => 'completed', 'starred' => 1 ) );
		return $form;
	}

	public function test_every_tab_gets_its_number_and_trash_counts_only_under_trash(): void {
		$form   = $this->seed();
		$counts = $this->repo->tabCounts( $form );

		$this->assertSame(
			array(
				'all'     => 6,
				'unread'  => 3,
				'read'    => 3,
				'spam'    => 1,
				'starred' => 1,
				'flagged' => 1,
				'trash'   => 2,
			),
			$counts
		);
	}

	public function test_each_number_matches_the_total_its_tab_lists(): void {
		$form   = $this->seed();
		$counts = $this->repo->tabCounts( $form );

		$this->assertSame( $this->repo->count( array( 'form_id' => $form ) ), $counts['all'] );
		$this->assertSame( $this->repo->count( array( 'form_id' => $form, 'is_read' => 0 ) ), $counts['unread'] );
		$this->assertSame( $this->repo->count( array( 'form_id' => $form, 'is_read' => 1 ) ), $counts['read'] );
		$this->assertSame( $this->repo->count( array( 'form_id' => $form, 'status' => 'spam' ) ), $counts['spam'] );
		$this->assertSame( $this->repo->count( array( 'form_id' => $form, 'starred' => 1 ) ), $counts['starred'] );
		$this->assertSame( $this->repo->count( array( 'form_id' => $form, 'status' => 'flagged' ) ), $counts['flagged'] );
		$this->assertSame( $this->repo->count( array( 'form_id' => $form, 'status' => 'trash' ) ), $counts['trash'] );
	}

	public function test_builder_preview_entries_count_nowhere(): void {
		$form   = $this->seed();
		$before = $this->repo->tabCounts( $form );
		$this->entry( $form, array( 'status' => 'preview', 'starred' => 1 ) );
		$this->entry( $form, array( 'status' => 'preview', 'is_read' => 1 ) );
		$this->assertSame( $before, $this->repo->tabCounts( $form ) );
	}

	public function test_a_form_filter_counts_only_that_form(): void {
		$first  = $this->seed();
		$second = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->entry( $second, array( 'status' => 'trash', 'trashed_from' => 'completed' ) );

		$this->assertSame( 6, $this->repo->tabCounts( $first )['all'] );
		$this->assertSame( 0, $this->repo->tabCounts( $second )['all'] );
		$this->assertSame( 1, $this->repo->tabCounts( $second )['trash'] );
		$this->assertGreaterThanOrEqual( 3, $this->repo->tabCounts( null )['trash'] );
	}

	public function test_counts_follow_trash_and_restore(): void {
		$form = $this->seed();
		$id   = $this->entry( $form, array( 'starred' => 1 ) );

		$before = $this->repo->tabCounts( $form );
		$this->repo->trash( $id );
		$trashed = $this->repo->tabCounts( $form );
		$this->assertSame( $before['all'] - 1, $trashed['all'] );
		$this->assertSame( $before['unread'] - 1, $trashed['unread'] );
		$this->assertSame( $before['starred'] - 1, $trashed['starred'] );
		$this->assertSame( $before['trash'] + 1, $trashed['trash'] );

		$this->repo->untrash( $id );
		$this->assertSame( $before, $this->repo->tabCounts( $form ) );
	}

	public function test_the_endpoint_returns_every_count_in_one_response(): void {
		$form = $this->seed();
		wp_set_current_user( 1 );
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/submissions/unread-count' );
		$request->set_query_params( array( 'form_id' => $form ) );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$data = rest_do_request( $request )->get_data();

		$payload = $data['data'] ?? $data;
		$this->assertSame( 3, $payload['count'] );
		$this->assertSame( 3, $payload['counts']['unread'] );
		$this->assertSame( 2, $payload['counts']['trash'] );
		$this->assertSame( 6, $payload['counts']['all'] );
	}
}
