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

	public function test_export_by_ids_returns_spam_entries(): void {
		$form = $this->form();
		$a    = $this->entry( $form, array( 'status' => 'spam' ) );
		$b    = $this->entry( $form, array( 'status' => 'spam' ) );
		$this->entry( $form );

		$caps = new \SubtleForms\Support\Capabilities( array_merge( \SubtleForms\Support\Capabilities::defaults(), array( 'submissions.export' => true, 'api.read' => true, 'api.write' => true ) ) );
		$api  = new \SubtleForms\Api\SubmissionsApi( new \SubtleForms\Repositories\FormsRepository(), $this->repo, new \SubtleForms\Support\FeatureGate( $caps ) );
		$h    = fopen( 'php://temp', 'r+' );
		$this->assertSame( 2, $api->streamCsv( $form, array( 'status' => 'spam', 'ids' => array( $a, $b ) ), $h ) );
		fclose( $h );
		$h = fopen( 'php://temp', 'r+' );
		$this->assertSame( 2, $api->streamCsv( $form, array( 'ids' => array( $a, $b ) ), $h ), 'Ids alone return exactly those entries.' );
		fclose( $h );
	}

	public function test_importing_a_package_with_spam_twice_adds_nothing(): void {
		$form    = $this->form();
		$service = new \SubtleForms\Tools\TransferService( new \SubtleForms\Repositories\FormsRepository(), $this->repo );
		$package = \SubtleForms\Tools\TransferPackage::submissions(
			array( 'id' => 1, 'title' => 'T' ),
			array(
				array( 'entry_id' => 7, 'status' => 'spam', 'created_at' => '2026-01-01 00:00:00', 'payload' => array( 'name' => 'Spammer' ) ),
				array( 'entry_id' => 8, 'status' => 'completed', 'created_at' => '2026-01-02 00:00:00', 'payload' => array( 'name' => 'Ada' ) ),
			)
		);
		$this->assertSame( 2, $service->importSubmissions( $form, $package )['imported'] );
		$again = $service->importSubmissions( $form, $package );
		$this->assertSame( 0, $again['imported'], wp_json_encode( $again ) );
		$this->assertSame( 1, $this->repo->count( array( 'form_id' => $form, 'status' => 'spam' ) ) );
	}
}
