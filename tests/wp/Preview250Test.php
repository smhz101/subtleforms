<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * FF-14: an entry sent from the builder Preview is a test answer. It stays
 * out of the dashboard, reports, the unread count and the inbox, and the
 * preview submit checks the draft the builder shows, not the published form.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;

final class Preview250Test extends TestCase {

	private function get( string $route, array $params = array() ): array {
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1' . $route );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		foreach ( $params as $key => $value ) {
			$request->set_param( $key, $value );
		}
		$response = rest_do_request( $request );
		return array( 'status' => $response->get_status(), 'data' => (array) $response->get_data() );
	}

	private function previewSubmit( int $formId, array $data ): array {
		$this->asAdmin();
		$data['form_rendered_at'] = \SubtleForms\Engine\SpamProtection::issue_token( $formId, time() - 60 );
		$request                  = new \WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId, 'data' => $data, 'preview' => true ) ) );
		$response = rest_do_request( $request );
		return array( 'status' => $response->get_status(), 'data' => $response->get_data() );
	}

	private function row( int $id ): array {
		return (array) ( new SubmissionsRepository() )->find( $id );
	}

	private function fresh(): void {
		delete_transient( 'subtleforms_dashboard_stats_v2' );
		global $wpdb;
		$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '%subtleforms_counts%'" );
		wp_cache_flush();
	}

	public function test_preview_entries_are_not_counted_anywhere(): void {
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$repo   = new SubmissionsRepository();
		$this->asAdmin();

		$this->fresh();
		$before      = $this->get( '/dashboard' )['data']['data'];
		$this->assertArrayHasKey( 'stats', $before, wp_json_encode( $before ) );
		$beforeData  = $before['stats'];
		$reportsBase = $this->get( '/reports/overview' )['data']['data'];
		$unreadBase  = (int) $this->get( '/submissions/unread-count' )['data']['data']['count'];

		$live    = $repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Real' ), 'status' => 'completed' ) );
		$preview = $repo->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Test' ), 'status' => 'preview' ) );
		$this->assertGreaterThan( 0, $live );
		$this->assertGreaterThan( 0, $preview );

		$this->fresh();
		$after     = $this->get( '/dashboard' )['data']['data'];
		$afterData = $after['stats'];
		$this->assertSame( (int) $beforeData['total_submissions'] + 1, (int) $afterData['total_submissions'], 'Total counts the live entry only.' );
		$this->assertSame( (int) $beforeData['submissions_today'] + 1, (int) $afterData['submissions_today'] );
		$this->assertSame( (int) $beforeData['submissions_this_week'] + 1, (int) $afterData['submissions_this_week'] );
		$this->assertSame( (int) $beforeData['unread_submissions'] + 1, (int) $afterData['unread_submissions'] );

		$trendBefore = array_sum( array_column( (array) $before['trend'], 'count' ) );
		$trendAfter  = array_sum( array_column( (array) $after['trend'], 'count' ) );
		$this->assertSame( $trendBefore + 1, $trendAfter, 'The trend counts the live entry only.' );

		$ids = array_column( (array) $after['recent_submissions'], 'id' );
		$this->assertContains( $live, $ids );
		$this->assertNotContains( $preview, $ids, 'Recent entries do not list the preview.' );

		$reports = $this->get( '/reports/overview' )['data']['data'];
		$this->assertSame( (int) $reportsBase['total_submissions'] + 1, (int) $reports['total_submissions'] );
		$this->assertSame( (int) $reportsBase['unread_submissions'] + 1, (int) $reports['unread_submissions'] );
		$this->assertSame(
			array_sum( array_column( $reportsBase['series'], 'count' ) ) + 1,
			array_sum( array_column( $reports['series'], 'count' ) )
		);

		$unread = (int) $this->get( '/submissions/unread-count' )['data']['data']['count'];
		$this->assertSame( $unreadBase + 1, $unread, 'The unread count leaves the preview out.' );

		$all = $this->get( '/submissions', array( 'per_page' => 50 ) );
		$allIds = array_column( (array) $all['data']['data'], 'id' );
		$this->assertContains( $live, array_map( 'intval', $allIds ) );
		$this->assertNotContains( $preview, array_map( 'intval', $allIds ), 'The Inbox All tab leaves the preview out.' );

		$form = $this->get( '/forms/' . $formId . '/submissions' );
		$this->assertNotContains( $preview, array_map( 'intval', array_column( (array) $form['data']['data'], 'id' ) ) );

		// Asking for them by name still works, so an admin can find them.
		$named = $this->get( '/submissions', array( 'processing_status' => 'preview', 'per_page' => 50 ) );
		$this->assertSame( 200, $named['status'] );
		$this->assertContains( $preview, array_map( 'intval', array_column( (array) $named['data']['data'], 'id' ) ) );
	}

	public function test_a_preview_entry_does_not_use_up_the_form_entry_limit(): void {
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		( new SubmissionsRepository() )->create( array( 'form_id' => $formId, 'payload' => array( 'name' => 'Test' ), 'status' => 'preview' ) );
		$count = new \ReflectionMethod( \SubtleForms\Engine\FormRestrictions::class, 'countEntries' );
		$count->setAccessible( true );
		$this->assertSame( 0, $count->invoke( null, $formId ) );
	}

	public function test_preview_submit_validates_the_draft_and_stores_a_preview_entry(): void {
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name', 'required' => true ) ) );

		// The builder holds an unpublished draft that adds a required field.
		$repo  = new FormsRepository();
		$draft = $repo->getDraftSchema( $formId );
		$this->assertIsArray( $draft );
		$draft['fields'][] = array( 'id' => 'f2', 'key' => 'city', 'type' => 'text', 'label' => 'City', 'required' => true );
		$this->assertTrue( $repo->saveDraftSchema( $formId, $draft ) );

		// The preview checks the draft: City is missing.
		$missing = $this->previewSubmit( $formId, array( 'name' => 'Ada' ) );
		$this->assertSame( 422, $missing['status'], wp_json_encode( $missing['data'] ) );

		// A live submit of the same answers still passes: the published form has no City.
		$live = $this->submit( $formId, array( 'name' => 'Ada' ) );
		$this->assertContains( $live['status'], array( 200, 201 ), wp_json_encode( $live['data'] ) );
		$liveRow = $this->storedRow( $formId );
		$this->assertStringContainsString( 'Ada', $liveRow );

		// With the draft's field filled the preview is stored as a preview entry.
		$ok = $this->previewSubmit( $formId, array( 'name' => 'Grace', 'city' => 'Lahore' ) );
		$this->assertContains( $ok['status'], array( 200, 201 ), wp_json_encode( $ok['data'] ) );
		global $wpdb;
		$status = $wpdb->get_var( $wpdb->prepare( "SELECT status FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d AND payload LIKE %s", $formId, '%Grace%' ) );
		$this->assertSame( 'preview', $status );
		$liveStatus = $wpdb->get_var( $wpdb->prepare( "SELECT status FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d AND payload LIKE %s", $formId, '%Ada%' ) );
		$this->assertSame( 'completed', $liveStatus );
	}

	public function test_a_visitor_cannot_send_a_preview(): void {
		$formId = $this->publish( array( array( 'id' => 'f1', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		wp_set_current_user( 0 );
		$data                     = array( 'name' => 'Ada' );
		$data['form_rendered_at'] = \SubtleForms\Engine\SpamProtection::issue_token( $formId, time() - 60 );
		$request                  = new \WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId, 'data' => $data, 'preview' => true ) ) );
		$this->assertSame( 403, rest_do_request( $request )->get_status() );
	}
}
