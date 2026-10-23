<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.3.1 server behaviour against a real WordPress:
 *
 * - QA-08: the public schema of a form with fields outside every step
 *   serves them inside the first step.
 * - QA-09: Repeater groups are validated per group, stored as a list, and
 *   formatted in emails ({all_fields}) as a list (text) or a table (HTML).
 * - QA-11: trashed forms keep the Trash status, restore to their previous
 *   status and stop rendering and accepting entries.
 * - QA-12: duplicating the form 9 shape, a payment form and a repeater form.
 * - QA-03: a payment form priced by products saves with checkout settings.
 * - Entries Trash: trash, restore, exclusion from lists and counts, and
 *   emptying after the configured days.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Engine\Actions\EmailAction;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\SubmissionsRepository;

final class Release231Test extends TestCase {

	/** @var array[] */
	private $jobs = array();

	protected function setUp(): void {
		parent::setUp();
		$this->jobs = array();
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		parent::tearDown();
	}

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && $event->hook === 'subtleforms_async_email' ) {
			$this->jobs[] = \SubtleForms\Async\AsyncDispatcher::resolve( $event->args[0] );
			return true;
		}
		return $pre;
	}

	private function rest( string $method, string $path, array $body = array() ): array {
		$parts   = explode( '?', $path, 2 );
		$request = new \WP_REST_Request( $method, '/subtleforms/v1' . $parts[0] );
		if ( isset( $parts[1] ) ) {
			parse_str( $parts[1], $query );
			$request->set_query_params( $query );
		}
		if ( get_current_user_id() ) {
			$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		}
		if ( $body ) {
			$request->set_header( 'content-type', 'application/json' );
			$request->set_body( wp_json_encode( $body ) );
		}
		$response = rest_do_request( $request );
		return array(
			'status' => $response->get_status(),
			'data'   => $response->get_data(),
		);
	}

	private function repeaterFields(): array {
		return array(
			array( 'id' => 'em', 'key' => 'email', 'type' => 'email', 'label' => 'Email' ),
			array(
				'id'       => 'rep',
				'key'      => 'companies',
				'type'     => 'repeat_container',
				'label'    => 'Companies',
				'min'      => 1,
				'max'      => 3,
				'children' => array(
					array( 'id' => 'tk', 'key' => 'ticker', 'type' => 'text', 'label' => 'Ticker', 'required' => true ),
					array( 'id' => 'sh', 'key' => 'shares', 'type' => 'number', 'label' => 'Shares' ),
				),
			),
		);
	}

	// ── QA-08 ─────────────────────────────────────────────────────────

	public function test_public_schema_moves_orphaned_fields_into_the_first_step() {
		$id = $this->publish(
			array(
				array( 'id' => 'o1', 'key' => 'o1', 'type' => 'text', 'label' => 'One' ),
				array( 'id' => 'o2', 'key' => 'o2', 'type' => 'text', 'label' => 'Two' ),
				array( 'id' => 'st', 'key' => 'st', 'type' => 'step', 'title' => 'Step 1' ),
			)
		);
		wp_set_current_user( 0 );
		$res    = $this->rest( 'GET', "/forms/{$id}/schema" );
		$fields = $res['data']['data']['schema']['fields'] ?? $res['data']['schema']['fields'] ?? array();
		$this->assertSame( array( 'step' ), array_column( $fields, 'type' ) );
		$this->assertSame( array( 'o1', 'o2' ), array_column( $fields[0]['children'], 'key' ) );
	}

	// ── QA-09 ─────────────────────────────────────────────────────────

	public function test_repeater_groups_are_validated_and_stored_as_a_list() {
		$id  = $this->publish( $this->repeaterFields() );
		$bad = $this->submit( $id, array( 'companies' => array( array( 'ticker' => 'A' ), array( 'ticker' => '' ) ) ) );
		$this->assertSame( 422, $bad['status'] );
		$this->assertArrayHasKey( 'companies.1.ticker', $bad['data']['error']['meta']['fields'] );

		$ok = $this->submit(
			$id,
			array(
				'email'     => 'a@example.com',
				'companies' => array(
					array( 'ticker' => 'AAPL', 'shares' => '8', 'evil' => '<script>' ),
					array( 'ticker' => 'MSFT' ),
				),
				// A stray top-level child key is not stored.
				'ticker'    => 'NOPE',
			)
		);
		$this->assertSame( 200, $ok['status'], wp_json_encode( $ok['data'] ) );
		$stored = $this->storedPayload( $id );
		$this->assertSame( array( array( 'ticker' => 'AAPL', 'shares' => '8' ), array( 'ticker' => 'MSFT' ) ), $stored['companies'] );
		$this->assertArrayNotHasKey( 'ticker', $stored );
	}

	public function test_all_fields_formats_repeater_groups() {
		$schema  = array( 'fields' => $this->repeaterFields() );
		$payload = array(
			'email'     => 'a@example.com',
			'companies' => array( array( 'ticker' => 'AAPL', 'shares' => '8' ), array( 'ticker' => 'MSFT' ) ),
		);
		foreach ( array( 'text', 'html' ) as $format ) {
			$this->jobs = array();
			$context    = new SubmissionContext( 1, $payload );
			$context->setMeta( 'form_schema', $schema );
			$context->setMeta( 'submission_id', 0 );
			$context->setMeta( 'current_step_settings', array( 'to' => 'owner@example.com', 'subject' => 'S', 'message' => '{all_fields}', 'format' => $format ) );
			( new EmailAction() )->handle( $context );
			$body = $this->jobs[0]['body'];
			if ( 'text' === $format ) {
				$this->assertStringContainsString( "Companies: \n1. Ticker: AAPL; Shares: 8\n2. Ticker: MSFT", $body );
			} else {
				$this->assertStringContainsString( '<th', $body );
				$this->assertStringContainsString( '>AAPL</td>', $body );
				$this->assertStringContainsString( '>MSFT</td>', $body );
			}
		}
	}

	// ── QA-11 ─────────────────────────────────────────────────────────

	public function test_trashed_form_keeps_its_status_restores_and_stops_working() {
		$this->asAdmin();
		$id = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );

		$this->assertSame( 200, $this->rest( 'DELETE', "/forms/{$id}?move_to_trash=1" )['status'] );
		$list = $this->rest( 'GET', '/forms?status=trash&per_page=100' )['data'];
		$rows = $list['data'] ?? $list;
		$row  = current( array_filter( $rows, static fn( $f ) => (int) $f['id'] === $id ) );
		$this->assertSame( 'trash', $row['status'], 'Trash tab rows show Trashed' );
		$this->assertSame( 1, (int) $this->rest( 'GET', '/forms/counts' )['data']['data']['trash'] >= 1 ? 1 : 0 );

		// A trashed form neither renders nor accepts entries.
		wp_set_current_user( 0 );
		$this->assertSame( 404, $this->rest( 'GET', "/forms/{$id}/schema" )['status'] );
		$this->assertSame( 404, $this->submit( $id, array( 'name' => 'x' ) )['status'] );

		$this->asAdmin();
		$restored = $this->rest( 'POST', "/forms/{$id}/restore" );
		$this->assertSame( 'published', $restored['data']['data']['status'] ?? $restored['data']['status'] );
		$this->assertSame( 'published', ( new FormsRepository() )->find( $id )['status'] );
	}

	// ── QA-12 ─────────────────────────────────────────────────────────

	private function duplicate( int $id ): array {
		$this->asAdmin();
		$res = $this->rest( 'POST', "/forms/{$id}/duplicate" );
		$new = (int) ( $res['data']['data']['id'] ?? $res['data']['id'] ?? 0 );
		if ( $new ) {
			$this->formIds[] = $new;
		}
		return array( $res, $new );
	}

	public function test_duplicate_form_9_shape_repairs_it() {
		$id = $this->publish(
			array(
				array( 'id' => 'a', 'key' => 'a', 'type' => 'text', 'label' => 'A' ),
				array( 'id' => 'st', 'key' => 'st', 'type' => 'step', 'title' => 'Step 1' ),
			)
		);
		$this->submit( $id, array( 'a' => 'entry' ) );
		list( $res, $new ) = $this->duplicate( $id );
		$this->assertSame( 201, $res['status'], wp_json_encode( $res['data'] ) );
		$repo = new FormsRepository();
		$copy = $repo->find( $new );
		$this->assertSame( 'draft', $copy['status'] );
		$this->assertStringEndsWith( '(copy)', $copy['title'] );
		$draft = $repo->getDraftSchema( $new );
		$this->assertSame( array( 'step' ), array_column( $draft['fields'], 'type' ) );
		$this->assertSame( array( 'a' ), array_column( $draft['fields'][0]['children'], 'key' ) );
		$this->assertSame( 0, ( new SubmissionsRepository() )->count( array( 'form_id' => $new ) ), 'no entries copied' );
	}

	public function test_duplicate_repeater_and_payment_forms() {
		$rep = $this->publish( $this->repeaterFields() );
		list( $res, $new ) = $this->duplicate( $rep );
		$this->assertSame( 201, $res['status'] );
		$this->assertSame( 'repeat_container', ( new FormsRepository() )->getDraftSchema( $new )['fields'][1]['type'] );

		$pay = $this->publish(
			array(
				array( 'id' => 'p', 'key' => 'ticket', 'type' => 'payment_product', 'label' => 'Ticket', 'price' => 10 ),
				array( 'id' => 's', 'key' => 'summary', 'type' => 'payment_summary', 'label' => 'Summary' ),
			)
		);
		list( $res, $new ) = $this->duplicate( $pay );
		$this->assertSame( 201, $res['status'], wp_json_encode( $res['data'] ) );
	}

	public function test_duplicate_of_a_missing_form_says_why() {
		list( $res ) = $this->duplicate( 99999999 );
		$this->assertSame( 404, $res['status'] );
	}

	// ── QA-03 ─────────────────────────────────────────────────────────

	public function test_product_priced_payment_form_with_checkout_settings_saves() {
		$this->asAdmin();
		$id  = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$res = $this->rest(
			'POST',
			"/forms/{$id}/schema",
			array(
				'activate' => false,
				'schema'   => array(
					'schema_version' => 1,
					'metadata'       => array(
						'type'    => 'payment',
						'name'    => 'Pay',
						'title'   => 'Pay',
						'payment' => array( 'currency' => 'USD', 'processor' => 'woocommerce' ),
					),
					'fields'         => array(
						array( 'id' => 'p', 'key' => 'ticket', 'type' => 'payment_product', 'label' => 'Ticket', 'price' => 10 ),
					),
					'actions'        => array(
						array( 'id' => 'e', 'type' => 'email', 'enabled' => false, 'settings' => array( 'to' => '', 'subject' => '', 'message' => '' ) ),
					),
				),
			)
		);
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$draft = ( new FormsRepository() )->getDraftSchema( $id );
		$this->assertSame( 'woocommerce', $draft['metadata']['payment']['processor'], 'checkout settings are kept' );
	}

	// ── Entries Trash ─────────────────────────────────────────────────

	public function test_entries_trash_restore_and_empty() {
		$id = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->submit( $id, array( 'name' => 'Ada' ) );
		$this->submit( $id, array( 'name' => 'Grace' ) );
		$repo = new SubmissionsRepository();
		$all  = $repo->findAll( array( 'form_id' => $id ) );
		$this->assertCount( 2, $all );
		$entry  = $all[0];
		$before = $entry['status'];

		$this->asAdmin();
		$this->assertSame( 200, $this->rest( 'DELETE', '/submissions/' . $entry['id'] )['status'] );
		$this->assertSame( 'trash', $repo->find( (int) $entry['id'] )['status'] );
		$this->assertSame( 1, $repo->count( array( 'form_id' => $id ) ), 'trashed entries leave counts' );
		$this->assertSame( 1, $repo->get_counts_by_forms( array( $id ) )[ $id ] );
		$this->assertCount( 1, $repo->findAll( array( 'form_id' => $id, 'status' => 'trash' ) ) );

		$list = $this->rest( 'GET', '/submissions?status=trash&form_id=' . $id )['data'];
		$this->assertCount( 1, $list['data'] ?? $list );

		// Restore returns the previous status.
		$res = $this->rest( 'POST', '/submissions/' . $entry['id'] . '/restore' );
		$this->assertSame( $before, $res['data']['data']['status'] ?? $res['data']['status'] );
		$this->assertSame( 2, $repo->count( array( 'form_id' => $id ) ) );

		// Bulk trash, then the daily job empties entries older than the setting.
		$ids = array_map( 'intval', array_column( $all, 'id' ) );
		$this->assertSame( 2, $this->rest( 'POST', '/submissions/bulk', array( 'ids' => $ids, 'action' => 'trash' ) )['data']['data']['count'] ?? 0 );
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}subtleforms_submissions SET trashed_at = %s WHERE id = %d", gmdate( 'Y-m-d H:i:s', time() - 31 * DAY_IN_SECONDS ), $ids[0] ) );
		$this->assertSame( 1, $repo->emptyTrash( 30 ) );
		$this->assertNull( $repo->find( $ids[0] ) );
		$this->assertNotNull( $repo->find( $ids[1] ) );

		// Permanent delete from the Trash.
		$this->assertSame( 200, $this->rest( 'DELETE', '/submissions/' . $ids[1] . '?force=1' )['status'] );
		$this->assertNull( $repo->find( $ids[1] ) );
	}
	/**
	 * A trashed entry is not resent, does not change status except by
	 * Restore, and an entry trashed without a time is kept for the full
	 * Trash period instead of being deleted at the next cleanup.
	 */
	public function test_trashed_entries_are_left_alone() {
		$id = $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
		$this->submit( $id, array( 'name' => 'Ada' ) );
		$repo  = new SubmissionsRepository();
		$entry = $repo->findAll( array( 'form_id' => $id ) )[0];
		$this->asAdmin();
		$this->assertTrue( $repo->trash( (int) $entry['id'] ) );

		$resend = $this->rest( 'POST', '/submissions/' . $entry['id'] . '/resend' );
		$this->assertSame( 422, $resend['status'] );
		$this->assertStringContainsString( 'Trash', wp_json_encode( $resend['data'] ) );
		$put = $this->rest( 'PUT', '/submissions/' . $entry['id'], array( 'status' => 'flagged' ) );
		$this->assertSame( 422, $put['status'] );
		$this->assertStringContainsString( 'Trash', wp_json_encode( $put['data'] ) );
		$this->assertSame( 'trash', $repo->find( (int) $entry['id'] )['status'] );

		global $wpdb;
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}subtleforms_submissions SET trashed_at = NULL WHERE id = %d", $entry['id'] ) );
		$this->assertSame( 0, $repo->emptyTrash( 30 ) );
		$row = $repo->find( (int) $entry['id'] );
		$this->assertNotNull( $row );
		$this->assertNotEmpty( $row['trashed_at'] );
		$repo->delete( (int) $entry['id'] );
	}
}
