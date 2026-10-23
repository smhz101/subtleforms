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
		$this->jobs  = array();
		$this->mails = array();
		add_filter( 'pre_schedule_event', array( $this, 'catchJob' ), 10, 2 );
		add_filter( 'pre_wp_mail', array( $this, 'catchMail' ), 10, 2 );
		add_filter( 'subtleforms/submit/price_order', array( $this, 'priceOrder' ), 10, 3 );
		add_action( 'subtleforms/submit/finish_order', array( $this, 'finishOrder' ), 10, 4 );
		add_filter( 'subtleforms/payment/capture', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'catchJob' ), 10 );
		remove_filter( 'pre_wp_mail', array( $this, 'catchMail' ), 10 );
		remove_filter( 'subtleforms/submit/price_order', array( $this, 'priceOrder' ), 10 );
		remove_action( 'subtleforms/submit/finish_order', array( $this, 'finishOrder' ), 10 );
		remove_filter( 'subtleforms/payment/capture', array( $this, 'capture' ), 10 );
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

	public function finishOrder( $submissionId, $submission, $order, $status ) {
		( new \SubtleForms\Repositories\SubmissionsRepository() )->update( $submissionId, array( 'status' => $status ) );
	}

	public function capture( $payment, $submissionId ) {
		return $this->capture instanceof \WP_Error ? $this->capture : array_merge( $payment, array( 'status' => 'paid' ) );
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

	public function test_a_failed_capture_sends_no_receipt_and_tells_the_owner() {
		$this->capture = new \WP_Error( 'card_declined', 'Your card was declined.' );
		$id            = $this->payForm();
		$res           = $this->submit( $id, array( 'email' => 'buyer@example.com' ) );
		$this->assertSame( 402, $res['status'] );
		$this->assertSame( array(), $this->jobs, 'no order email is queued' );
		$subjects = array_column( $this->mails, 'subject' );
		$this->assertCount( 1, $subjects );
		$this->assertStringStartsWith( 'Payment failed', $subjects[0] );
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

	private function storedStatus( int $formId ): string {
		global $wpdb;
		return (string) $wpdb->get_var( $wpdb->prepare( "SELECT status FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1", $formId ) );
	}
}
