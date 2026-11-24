<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Spam stays out of All, Unread, Read, the badge count and the per-form
 * totals, and stays in the Spam tab (#131).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\SubmissionsRepository;

final class SpamOutOfCounts131Test extends TestCase {

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

	private function form(): int {
		return $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
	}

	public function test_all_unread_and_read_leave_spam_out_and_spam_still_counts(): void {
		$form = $this->form();
		$this->entry( $form );
		$this->entry( $form, array( 'is_read' => 1 ) );
		$this->entry( $form, array( 'status' => 'spam' ) );
		$this->entry( $form, array( 'status' => 'spam', 'is_read' => 1, 'starred' => 1 ) );

		$counts = $this->repo->tabCounts( $form );
		$this->assertSame( 2, $counts['all'] );
		$this->assertSame( 1, $counts['unread'] );
		$this->assertSame( 1, $counts['read'] );
		$this->assertSame( 0, $counts['starred'] );
		$this->assertSame( 2, $counts['spam'] );
	}

	public function test_lists_and_unread_count_leave_spam_out(): void {
		$form = $this->form();
		$this->entry( $form );
		$this->entry( $form, array( 'status' => 'spam' ) );

		$this->assertSame( 1, $this->repo->count( array( 'form_id' => $form ) ) );
		$this->assertSame( 1, $this->repo->count( array( 'form_id' => $form, 'is_read' => 0 ) ) );
		$this->assertSame( 1, $this->repo->count( array( 'form_id' => $form, 'status' => 'spam' ) ) );
		$this->assertSame( array( 1 ), array_values( $this->repo->get_counts_by_forms( array( $form ) ) ) );
	}

	public function test_restoring_a_spam_entry_brings_it_back(): void {
		$form = $this->form();
		$id   = $this->entry( $form, array( 'status' => 'spam' ) );
		$this->assertSame( 0, $this->repo->tabCounts( $form )['all'] );

		global $wpdb;
		$wpdb->update( $wpdb->prefix . 'subtleforms_submissions', array( 'status' => 'completed' ), array( 'id' => $id ) );
		$counts = $this->repo->tabCounts( $form );
		$this->assertSame( 1, $counts['all'] );
		$this->assertSame( 1, $counts['unread'] );
		$this->assertSame( 0, $counts['spam'] );
	}

	public function test_trashed_spam_shows_only_in_trash(): void {
		$form = $this->form();
		$this->entry( $form, array( 'status' => 'trash', 'trashed_from' => 'spam' ) );

		$counts = $this->repo->tabCounts( $form );
		$this->assertSame( 0, $counts['all'] );
		$this->assertSame( 0, $counts['spam'] );
		$this->assertSame( 1, $counts['trash'] );
	}
}
