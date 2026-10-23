<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * A cached page hands every visitor the same render ticket. Each visitor
 * trades it for their own single-use submit token.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Engine\SpamProtection;

final class SpamTicket272Test extends TestCase {

	private function ticket( int $formId ): string {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'GET', '/subtleforms/v1/forms/' . $formId . '/schema' );
		return rest_do_request( $request )->get_data()['data']['spam_token'] ?? '';
	}

	private function trade( int $formId, string $ticket ): array {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/forms/' . $formId . '/spam-token' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'token' => $ticket ) ) );
		$response = rest_do_request( $request );
		return array( $response->get_status(), $response->get_data()['data']['spam_token'] ?? '' );
	}

	private function send( int $formId, string $token, string $name ): array {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId, 'data' => array( 'name' => $name, 'form_rendered_at' => $token ) ) ) );
		$response = rest_do_request( $request );
		return array( $response->get_status(), $response->get_data() );
	}

	private function entries( int $formId ): int {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d", $formId ) );
	}

	private function form(): int {
		return $this->publish( array( array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ) ) );
	}

	public function test_two_visitors_of_one_cached_page_both_store_an_entry(): void {
		$id     = $this->form();
		$ticket = SpamProtection::issue_ticket( $id, time() - 60 );

		list( $statusA, $tokenA ) = $this->trade( $id, $ticket );
		list( $statusB, $tokenB ) = $this->trade( $id, $ticket );
		$this->assertSame( 200, $statusA );
		$this->assertSame( 200, $statusB );
		$this->assertNotSame( $tokenA, $tokenB, 'each visitor gets their own token' );

		$this->send( $id, $tokenA, 'Ada' );
		$this->send( $id, $tokenB, 'Grace' );
		$this->assertSame( 2, $this->entries( $id ) );
	}

	public function test_replaying_a_submit_token_is_rejected(): void {
		$id = $this->form();
		list( , $token ) = $this->trade( $id, SpamProtection::issue_ticket( $id, time() - 60 ) );

		$this->send( $id, $token, 'Ada' );
		$this->send( $id, $token, 'Replay' );
		$this->assertSame( 1, $this->entries( $id ) );
	}

	public function test_the_ticket_is_never_accepted_for_a_submission(): void {
		$id     = $this->form();
		$ticket = SpamProtection::issue_ticket( $id, time() - 60 );

		list( $status, $data ) = $this->send( $id, $ticket, 'Direct' );
		$this->assertSame( 409, $status );
		$this->assertSame( 0, $this->entries( $id ) );
		$this->assertStringStartsWith( 's1.', $data['error']['meta']['spam_token'] );
	}

	public function test_the_trade_keeps_the_render_time_so_the_time_trap_still_works(): void {
		$id = $this->form();
		list( , $token ) = $this->trade( $id, $this->ticket( $id ) );
		$this->send( $id, $token, 'Too fast' );
		$this->assertSame( 0, $this->entries( $id ), 'sent at once after the render' );
	}

	public function test_the_trade_is_rate_limited_per_client(): void {
		$id     = $this->form();
		$ticket = SpamProtection::issue_ticket( $id, time() - 60 );
		$last   = 200;
		for ( $i = 0; $i < 25; $i++ ) {
			list( $last ) = $this->trade( $id, $ticket );
		}
		$this->assertSame( 429, $last );
	}
}
