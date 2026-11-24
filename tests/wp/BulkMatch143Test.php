<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * #143: a bulk action can apply to every entry that matches a view, resolved
 * by the server from the same filters the list uses.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Repositories\SubmissionsRepository;

final class BulkMatch143Test extends TestCase {

	private function bulk( array $body ): array {
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submissions/bulk' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( $body ) );
		$response = rest_do_request( $request );
		return array(
			'status' => $response->get_status(),
			'data'   => $response->get_data(),
		);
	}

	private function form(): int {
		return $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
	}

	public function test_match_hits_the_entries_the_list_shows_for_a_tab_and_search() {
		$id = $this->form();
		$this->submit( $id, array( 'name' => 'Ada' ) );
		$this->submit( $id, array( 'name' => 'Ada Two' ) );
		$this->submit( $id, array( 'name' => 'Grace' ) );
		$repo = new SubmissionsRepository();
		$ada  = $repo->findAll( array( 'form_id' => $id, 'search' => 'Ada', 'is_read' => 0 ) );
		$this->assertCount( 2, $ada );

		$this->asAdmin();
		$res = $this->bulk( array( 'match' => true, 'action' => 'read', 'form_id' => $id, 'status' => 'unread', 'search' => 'Ada' ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( 2, $res['data']['data']['affected'] );
		foreach ( $ada as $row ) {
			$this->assertSame( 1, (int) $repo->find( (int) $row['id'] )['is_read'] );
		}
		$this->assertCount( 1, $repo->findAll( array( 'form_id' => $id, 'is_read' => 0 ) ), 'Grace is still unread' );
	}

	public function test_ids_and_match_together_or_neither_are_refused() {
		$id = $this->form();
		$this->submit( $id, array( 'name' => 'Ada' ) );
		$row = ( new SubmissionsRepository() )->findAll( array( 'form_id' => $id ) )[0];
		$this->asAdmin();

		foreach ( array(
			array( 'ids' => array( (int) $row['id'] ), 'match' => true, 'action' => 'read' ),
			array( 'action' => 'read' ),
			array( 'ids' => array(), 'match' => false, 'action' => 'read' ),
		) as $body ) {
			$res = $this->bulk( $body );
			$this->assertSame( 400, $res['status'] );
			$this->assertSame( 'subtleforms_bulk_target', $res['data']['error']['code'] );
		}
	}

	public function test_match_over_the_cap_is_refused_and_changes_nothing() {
		global $wpdb;
		$id = $this->form();
		$this->submit( $id, array( 'name' => 'Ada' ) );
		$table = $wpdb->prefix . 'subtleforms_submissions';
		// Double the form's rows until there are more than 20,000.
		for ( $i = 0; $i < 15; $i++ ) {
			$wpdb->query( $wpdb->prepare( "INSERT INTO {$table} (form_id, schema_version, payload, meta, status, is_read, starred, created_at) SELECT form_id, schema_version, payload, meta, status, is_read, starred, created_at FROM {$table} WHERE form_id = %d", $id ) );
		}
		$this->asAdmin();
		$res = $this->bulk( array( 'match' => true, 'action' => 'read', 'form_id' => $id ) );
		$this->assertSame( 400, $res['status'] );
		$this->assertSame( 'subtleforms_bulk_too_many', $res['data']['error']['code'] );
		$this->assertSame( 0, (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE form_id = %d AND is_read = 1", $id ) ) );
	}

	public function test_match_over_500_entries_runs_in_batches() {
		global $wpdb;
		$id = $this->form();
		$this->submit( $id, array( 'name' => 'Ada' ) );
		$table = $wpdb->prefix . 'subtleforms_submissions';
		// 1 entry doubled 10 times: 1,024 entries.
		for ( $i = 0; $i < 10; $i++ ) {
			$wpdb->query( $wpdb->prepare( "INSERT INTO {$table} (form_id, schema_version, payload, meta, status, is_read, starred, created_at) SELECT form_id, schema_version, payload, meta, status, is_read, starred, created_at FROM {$table} WHERE form_id = %d", $id ) );
		}
		$this->asAdmin();
		$res = $this->bulk( array( 'match' => true, 'action' => 'star', 'form_id' => $id ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( 1024, $res['data']['data']['affected'] );
		$this->assertSame( 1024, (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE form_id = %d AND starred = 1", $id ) ) );
	}

	public function test_ids_mode_still_works_and_reports_affected() {
		$id = $this->form();
		$this->submit( $id, array( 'name' => 'Ada' ) );
		$row = ( new SubmissionsRepository() )->findAll( array( 'form_id' => $id ) )[0];
		$this->asAdmin();
		$res = $this->bulk( array( 'ids' => array( (int) $row['id'] ), 'action' => 'star' ) );
		$this->assertSame( 200, $res['status'] );
		$this->assertSame( 1, $res['data']['data']['affected'] );
		$this->assertSame( 1, $res['data']['data']['count'] );
	}
}
