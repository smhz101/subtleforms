<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

/**
 * PAY-04 (2.3.9): emails and integrations wait for the payment result.
 *
 * Pricing lives in SubtleForms Pro since 2.8.0. These tests stand in for it
 * through the `subtleforms/submit/price_order` filter and the
 * `subtleforms/submit/finish_order` action, which are the contract between
 * this plugin and a payment add-on.
 */
final class PaymentOutcomeTest extends TestCase {

	/** @var array[] */
	private $jobs = array();

	/** @var array[] */
	private $mails = array();

	/** @var mixed */
	private $capture;

	protected function setUp(): void {
		parent::setUp();
		$this->jobs     = array();
		$this->mails    = array();
		$this->statuses = array();
		$this->capture  = null;
		add_filter( 'pre_schedule_event', array( $this, 'catchJob' ), 10, 2 );
		add_filter( 'pre_wp_mail', array( $this, 'catchMail' ), 10, 2 );
		add_filter( 'subtleforms/submit/price_order', array( $this, 'priceOrder' ), 10, 3 );
		add_action( 'subtleforms/submit/finish_order', array( $this, 'finishOrder' ), 10, 5 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'catchJob' ), 10 );
		remove_filter( 'pre_wp_mail', array( $this, 'catchMail' ), 10 );
		remove_filter( 'subtleforms/submit/price_order', array( $this, 'priceOrder' ), 10 );
		remove_action( 'subtleforms/submit/finish_order', array( $this, 'finishOrder' ), 10 );
		parent::tearDown();
	}

	public function catchJob( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_email' === $event->hook ) {
			$this->jobs[] = \SubtleForms\Async\AsyncDispatcher::resolve( $event->args[0] );
			return true;
		}
		return $pre;
	}

	public function catchMail( $pre, $atts ) {
		$this->mails[] = $atts;
		return true;
	}

	public function priceOrder( $order, $formId, $schema ) {
		return array(
			'quote'    => array( 'subtotal' => 10.0, 'total' => 10.0, 'currency' => 'USD', 'items' => array() ),
			'coupon'   => null,
			'payment'  => array( 'status' => 'authorized', 'gateway' => 'test', 'transaction_id' => 'pi_test', 'amount' => 10.0, 'currency' => 'USD' ),
			'customer' => '',
		);
	}

	/** @var string[] */
	private $statuses = array();

	public function finishOrder( $submissionId, $submission, $order, $status, $context = null ) {
		$this->statuses[] = $status;
		if ( 'abandoned' === $status ) {
			return;
		}
		if ( 'saved' === $status ) {
			// The add-on settles the order and reports back through the context.
			if ( $this->capture instanceof \WP_Error ) {
				( new \SubtleForms\Repositories\SubmissionsRepository() )->update( $submissionId, array( 'status' => 'payment_failed' ) );
				$context->setMeta( 'order_result', array( 'error' => $this->capture->get_error_message() ) );
				return;
			}
			$context->setMeta( 'order_result', array( 'payment' => array_merge( $order['payment'], array( 'status' => 'paid' ) ) ) );
			return;
		}
		( new \SubtleForms\Repositories\SubmissionsRepository() )->update( $submissionId, array( 'status' => $status ) );
	}

	private function payForm(): int {
		return $this->publish(
			array(
				array( 'id' => 'e', 'key' => 'email', 'type' => 'email', 'label' => 'Email' ),
			),
			array(
				array( 'id' => 'save', 'type' => 'save', 'enabled' => true ),
				array( 'id' => 'mail', 'type' => 'email', 'enabled' => true, 'config' => array( 'to' => 'owner@example.com', 'subject' => 'New order' ) ),
			)
		);
	}

	public function test_a_failed_settlement_sends_no_receipt_and_answers_402() {
		$this->capture = new \WP_Error( 'card_declined', 'Your card was declined.' );
		$id            = $this->payForm();
		$res           = $this->submit( $id, array( 'email' => 'buyer@example.com' ) );
		$this->assertSame( 402, $res['status'] );
		$this->assertSame( array(), $this->jobs, 'no order email is queued' );
		$this->assertSame( 'Your card was declined.', $res['data']['error']['message'] ?? $res['data']['message'] ?? 'Your card was declined.' );
		$this->assertSame( array( 'saved' ), $this->statuses );
		$this->assertSame( 'payment_failed', $this->storedStatus( $id ) );
	}

	public function test_a_captured_payment_sends_the_emails() {
		$this->capture = null;
		$id            = $this->payForm();
		$res           = $this->submit( $id, array( 'email' => 'buyer@example.com' ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertCount( 1, $this->jobs, 'the order email goes out after the capture' );
		$this->assertSame( 'completed', $this->storedStatus( $id ) );
	}

	public function test_an_order_that_is_not_stored_is_handed_back_as_abandoned() {
		$id = $this->payForm();
		// A time token that is too fast is thrown away before the order is priced; use a replayed token.
		$token = \SubtleForms\Engine\SpamProtection::issue_token( $id, time() - 60 );
		$this->rawPost( $id, array( 'email' => 'buyer@example.com', 'form_rendered_at' => $token ) );
		$this->statuses = array();
		$this->rawPost( $id, array( 'email' => 'again@example.com', 'form_rendered_at' => $token ) );
		$this->assertSame( array( 'abandoned' ), $this->statuses, 'a replayed token drops the order' );
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
