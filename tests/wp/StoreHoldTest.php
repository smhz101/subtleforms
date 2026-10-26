<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

/**
 * P1-01: the submission store hooks an add-on uses to hold an entry, finish
 * its part after the entry is stored and release what it holds when the
 * entry is dropped. This plugin reads only the generic keys of the hold.
 */
final class StoreHoldTest extends TestCase {

	/** @var array[] */
	private $jobs = array();

	/** @var array */
	private $result = array();

	/** @var array[] */
	private $calls = array();

	protected function setUp(): void {
		parent::setUp();
		$this->jobs   = array();
		$this->calls  = array();
		$this->result = array();
		add_filter( 'pre_schedule_event', array( $this, 'catchJob' ), 10, 2 );
		add_filter( 'pre_wp_mail', '__return_true' );
		add_filter( 'subtleforms/submit/before_store', array( $this, 'hold' ), 10, 4 );
		add_action( 'subtleforms/submit/after_store', array( $this, 'afterStore' ), 10, 4 );
		add_action( 'subtleforms/submit/store_abandoned', array( $this, 'abandoned' ), 10, 3 );
		add_filter( 'subtleforms/submission/request_keys', array( $this, 'requestKeys' ) );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'catchJob' ), 10 );
		remove_filter( 'pre_wp_mail', '__return_true' );
		remove_filter( 'subtleforms/submit/before_store', array( $this, 'hold' ), 10 );
		remove_action( 'subtleforms/submit/after_store', array( $this, 'afterStore' ), 10 );
		remove_action( 'subtleforms/submit/store_abandoned', array( $this, 'abandoned' ), 10 );
		remove_filter( 'subtleforms/submission/request_keys', array( $this, 'requestKeys' ) );
		parent::tearDown();
	}

	public function catchJob( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_email' === $event->hook ) {
			$this->jobs[] = $event->args;
			return true;
		}
		return $pre;
	}

	public function requestKeys( $keys ) {
		$keys[] = '_example_ref';
		return $keys;
	}

	public function hold( $hold, $formId, $schema, $payload ) {
		if ( empty( $payload['email'] ) || 'refuse@example.com' === $payload['email'] ) {
			return 'refuse@example.com' === ( $payload['email'] ?? '' )
				? new \WP_REST_Response( array( 'error' => array( 'code' => 'example_refused', 'message' => 'Refused.' ) ), 422 )
				: $hold;
		}
		return array(
			'ref'           => (string) ( $payload['_example_ref'] ?? '' ),
			'defer_actions' => true,
			'context_meta'  => array( 'example_meta' => 'set' ),
		);
	}

	public function afterStore( $submissionId, $submission, $hold, $context ) {
		$this->calls[] = array( 'after_store', $hold['ref'] ?? '', $context->getMeta( 'example_meta' ) );
		$context->setMeta( 'store_result', $this->result );
	}

	public function abandoned( $hold, $formId, $submissionId ) {
		$this->calls[] = array( 'store_abandoned', $hold['ref'] ?? '', $submissionId );
	}

	private function form(): int {
		return $this->publish(
			array(
				array( 'id' => 'e', 'key' => 'email', 'type' => 'email', 'label' => 'Email' ),
			),
			array(
				array( 'id' => 'save', 'type' => 'save', 'enabled' => true ),
				array( 'id' => 'mail', 'type' => 'email', 'enabled' => true, 'config' => array( 'to' => 'owner@example.com', 'subject' => 'New entry' ) ),
			)
		);
	}

	public function test_a_form_without_a_hold_is_stored_and_completed_as_before() {
		remove_filter( 'subtleforms/submit/before_store', array( $this, 'hold' ), 10 );
		$id  = $this->form();
		$res = $this->submit( $id, array( 'email' => 'visitor@example.com' ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( 'completed', $this->storedStatus( $id ) );
		$this->assertCount( 1, $this->jobs );
		$this->assertSame( array(), $this->calls );
	}

	public function test_a_refusal_stores_nothing() {
		$id  = $this->form();
		$res = $this->submit( $id, array( 'email' => 'refuse@example.com' ) );
		$this->assertSame( 422, $res['status'] );
		$this->assertSame( '', $this->storedStatus( $id ) );
	}

	public function test_deferred_actions_wait_for_the_add_on_and_its_status_is_stored() {
		$this->result = array( 'status' => 'example_pending' );
		$id           = $this->form();
		$res          = $this->submit( $id, array( 'email' => 'visitor@example.com', '_example_ref' => 'r1' ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( array( array( 'after_store', 'r1', 'set' ) ), $this->calls );
		$this->assertSame( array(), $this->jobs, 'the email waits until the add-on asks for it' );
		$this->assertSame( 'example_pending', $this->storedStatus( $id ) );
		$this->assertArrayNotHasKey( '_example_ref', $this->storedPayload( $id ), 'request values are never stored' );
	}

	public function test_run_deferred_sends_the_emails() {
		$this->result = array( 'status' => 'completed', 'run_deferred' => true );
		$id           = $this->form();
		$res          = $this->submit( $id, array( 'email' => 'visitor@example.com' ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertCount( 1, $this->jobs );
		$this->assertSame( 'completed', $this->storedStatus( $id ) );
	}

	public function test_a_response_from_after_store_answers_the_visitor() {
		$this->result = array(
			'status'   => 'example_failed',
			'response' => new \WP_REST_Response( array( 'error' => array( 'code' => 'example_failed', 'message' => 'Not finished.' ) ), 402 ),
		);
		$id           = $this->form();
		$res          = $this->submit( $id, array( 'email' => 'visitor@example.com' ) );
		$this->assertSame( 402, $res['status'] );
		$this->assertSame( array(), $this->jobs );
		$this->assertSame( 'example_failed', $this->storedStatus( $id ) );
	}

	public function test_a_hold_that_is_not_stored_is_released() {
		$id    = $this->form();
		$token = \SubtleForms\Engine\SpamProtection::issue_token( $id, time() - 60 );
		$this->rawPost( $id, array( 'email' => 'visitor@example.com', 'form_rendered_at' => $token, '_example_ref' => 'a' ) );
		$this->calls = array();
		$this->rawPost( $id, array( 'email' => 'again@example.com', 'form_rendered_at' => $token, '_example_ref' => 'b' ) );
		$this->assertSame( array( array( 'store_abandoned', 'b', 0 ) ), $this->calls, 'a replayed token drops the entry' );
	}

	public function test_the_deprecated_names_still_fire() {
		remove_filter( 'subtleforms/submit/before_store', array( $this, 'hold' ), 10 );
		$seen  = array();
		$price = static function ( $hold ) use ( &$seen ) {
			$seen[] = 'price_order';
			return array( 'ref' => 'old' );
		};
		$finish = static function ( $id, $submission, $hold, $status ) use ( &$seen ) {
			$seen[] = 'finish_order:' . $status;
		};
		add_filter( 'deprecated_hook_trigger_error', '__return_false' );
		add_filter( 'subtleforms/submit/price_order', $price );
		add_action( 'subtleforms/submit/finish_order', $finish, 10, 4 );
		$id  = $this->form();
		$res = $this->submit( $id, array( 'email' => 'visitor@example.com' ) );
		remove_filter( 'subtleforms/submit/price_order', $price );
		remove_action( 'subtleforms/submit/finish_order', $finish, 10 );
		remove_filter( 'deprecated_hook_trigger_error', '__return_false' );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( array( 'price_order', 'finish_order:saved' ), $seen );
		$this->assertSame( 'completed', $this->storedStatus( $id ) );
	}

	private function rawPost( int $formId, array $data ): void {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/submit' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId, 'data' => $data ) ) );
		rest_do_request( $request );
	}

	private function storedStatus( int $formId ): string {
		global $wpdb;
		return (string) $wpdb->get_var( $wpdb->prepare( "SELECT status FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1", $formId ) );
	}
}
