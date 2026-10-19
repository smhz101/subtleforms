<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
namespace SubtleForms\Tests\WP;

use SubtleForms\Payments\CouponsRepository;
use SubtleForms\Repositories\FormsRepository;

/**
 * Payments, free side (2.4.0, package F240-6).
 */
final class Payments240Test extends TestCase {

	/** @var int[] */
	private $couponIds = array();

	/** @var array|null Quote the gateway was asked to charge at intent. */
	private $intentQuote;

	/** @var array|null Quote the gateway was asked to confirm at submit. */
	private $verifyQuote;

	protected function setUp(): void {
		parent::setUp();
		CouponsRepository::maybeInstall();
		$this->intentQuote = null;
		$this->verifyQuote = null;
	}

	protected function tearDown(): void {
		foreach ( $this->couponIds as $id ) {
			CouponsRepository::delete( $id );
		}
		$this->couponIds = array();
		remove_all_filters( 'subtleforms/extension/payments/create_intent' );
		remove_all_filters( 'subtleforms/payment/verify' );
		remove_all_filters( 'subtleforms_is_pro_active' );
		parent::tearDown();
	}

	/** Create a form with the given status and payment metadata. */
	private function form( array $fields, string $status = 'published', array $payment = array() ): int {
		$repo   = new FormsRepository();
		$schema = array(
			'metadata'       => array_filter(
				array(
					'type'    => 'regular',
					'name'    => 'Pay test',
					'title'   => 'Pay test',
					'payment' => $payment,
				)
			),
			'schema_version' => 1,
			'fields'         => $fields,
			'actions'        => array( array( 'id' => 'save', 'type' => 'save', 'enabled' => true ) ),
		);
		$id     = $repo->create(
			array(
				'title'  => 'Pay test',
				'status' => $status,
				'schema' => $schema,
			)
		);
		$repo->saveSchemaVersion( $id, $schema, true );
		$this->formIds[] = $id;
		return $id;
	}

	private function coupon( string $code, array $extra = array() ): array {
		$saved = CouponsRepository::save( array_merge( array( 'code' => $code, 'type' => 'percent', 'amount' => 10 ), $extra ) );
		$this->assertIsArray( $saved, is_wp_error( $saved ) ? $saved->get_error_message() : '' );
		$this->couponIds[] = (int) $saved['id'];
		return $saved;
	}

	/** POST a public payments route as the current user. */
	private function post( string $route, array $body ): array {
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1' . $route );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_body( wp_json_encode( $body ) );
		$response = rest_do_request( $request );
		return array(
			'status' => $response->get_status(),
			'data'   => $response->get_data(),
		);
	}

	/** Call the intent endpoint's handler (the route only exists while Payments is switched on). */
	private function intent( int $formId, array $data ) {
		$ext     = new \SubtleForms\Extensions\PaymentsExtension(
			new \SubtleForms\Support\Settings(),
			new \SubtleForms\Support\FeatureGate( new \SubtleForms\Support\Capabilities() )
		);
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/payments/intent' );
		$request->set_param( 'form_id', $formId );
		$request->set_param( 'data', $data );
		return $ext->createIntent( $request );
	}

	private function catchIntent(): void {
		add_filter(
			'subtleforms/extension/payments/create_intent',
			function ( $result, $request, $settings, $quote ) {
				$this->intentQuote = $quote;
				return array( 'client_secret' => 'test' );
			},
			10,
			4
		);
	}

	private function catchVerify(): void {
		add_filter(
			'subtleforms/payment/verify',
			function ( $result, $quote ) {
				$this->verifyQuote = $quote;
				return $result;
			},
			10,
			2
		);
	}

	private function couponForm(): int {
		return $this->form(
			array(
				array( 'id' => 'p', 'key' => 'ticket', 'type' => 'payment_product', 'label' => 'Ticket', 'price' => 20 ),
				array( 'id' => 'c', 'key' => 'promo', 'type' => 'payment_coupon', 'label' => 'Coupon' ),
			)
		);
	}

	/** PAY-13: a code typed only in the Coupon field prices the same at quote, intent and submit. */
	public function test_pay13_coupon_field_code_is_used_by_quote_intent_and_submit() {
		$this->coupon( 'PAY13CF' );
		$id = $this->couponForm();
		$this->catchIntent();
		$this->catchVerify();

		$quote = $this->post( '/payments/quote', array( 'form_id' => $id, 'data' => array( 'promo' => 'pay13cf' ) ) );
		$this->assertSame( 200, $quote['status'] );
		$this->assertSame( 18.0, (float) $quote['data']['data']['total'] );

		$this->intent( $id, array( 'promo' => 'pay13cf' ) );
		$this->assertSame( 18.0, (float) $this->intentQuote['total'], 'intent applies the Coupon field code' );

		$res = $this->submit( $id, array( 'promo' => 'pay13cf' ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( 18.0, (float) $this->verifyQuote['total'] );
	}

	/** PAY-13: spaces in a code, in the field or the coupon box, change nothing. */
	public function test_pay13_codes_with_spaces_price_the_same_everywhere() {
		$this->coupon( 'PAY13SP' );
		$id = $this->couponForm();
		$this->catchIntent();
		$this->catchVerify();

		$this->intent( $id, array( '_coupon' => '   ', 'promo' => ' pay13 sp ' ) );
		$this->assertSame( 18.0, (float) $this->intentQuote['total'] );

		$res = $this->submit( $id, array( '_coupon' => '   ', 'promo' => ' pay13 sp ' ) );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertSame( 18.0, (float) $this->verifyQuote['total'] );
	}

	/** PAY-16: guests get 404 from quote, coupon and intent on a draft form, as from submit. */
	public function test_pay16_draft_forms_are_not_priced_for_guests() {
		$this->coupon( 'PAY16' );
		$id = $this->form(
			array( array( 'id' => 'p', 'key' => 'ticket', 'type' => 'payment_product', 'label' => 'Ticket', 'price' => 20 ) ),
			'draft'
		);
		$this->catchIntent();
		wp_set_current_user( 0 );

		$this->assertSame( 404, $this->post( '/payments/quote', array( 'form_id' => $id, 'data' => array() ) )['status'] );
		$this->assertSame( 404, $this->post( '/payments/coupon', array( 'form_id' => $id, 'code' => 'PAY16', 'data' => array() ) )['status'] );
		$intent = $this->intent( $id, array() );
		$this->assertWPError( $intent );
		$this->assertSame( 404, $intent->get_error_data()['status'] );
		$this->assertNull( $this->intentQuote, 'no intent is created' );

		// The builder preview (an admin) still prices a draft.
		$this->asAdmin();
		$this->assertSame( 200, $this->post( '/payments/quote', array( 'form_id' => $id, 'data' => array() ) )['status'] );
	}

	/** PAY-24: with Pro active and no gateway connected, the answer is about connecting Stripe. */
	public function test_pay24_pro_without_a_gateway_asks_to_connect_stripe() {
		add_filter( 'subtleforms_is_pro_active', '__return_true' );
		$id = $this->form( array( array( 'id' => 'p', 'key' => 'ticket', 'type' => 'payment_product', 'label' => 'Ticket', 'price' => 20 ) ) );

		$this->asAdmin();
		$admin = $this->intent( $id, array() );
		$this->assertWPError( $admin );
		$this->assertSame( 'subtleforms_payment_unavailable', $admin->get_error_code() );
		$this->assertStringContainsString( 'Connect Stripe', $admin->get_error_message() );

		wp_set_current_user( 0 );
		$guest = $this->intent( $id, array() );
		$this->assertStringNotContainsString( 'Pro plugin', $guest->get_error_message() );

		remove_all_filters( 'subtleforms_is_pro_active' );
		$this->assertSame( 'subtleforms_pro_required', $this->intent( $id, array() )->get_error_code() );
	}

	/** PAY-26: a card order below the gateway minimum is refused with a clear message. */
	public function test_pay26_card_orders_below_the_minimum_are_refused() {
		$id = $this->form(
			array(
				array( 'id' => 'p', 'key' => 'sticker', 'type' => 'payment_product', 'label' => 'Sticker', 'price' => 0.30 ),
				array( 'id' => 'k', 'key' => 'card', 'type' => 'payment_card', 'label' => 'Card' ),
			),
			'published',
			array( 'currency' => 'USD' )
		);
		$this->catchIntent();
		$this->catchVerify();

		$intent = $this->intent( $id, array() );
		$this->assertWPError( $intent );
		$this->assertSame( 'subtleforms_amount_too_small', $intent->get_error_code() );
		$this->assertStringContainsString( '0.50 USD', $intent->get_error_message() );
		$this->assertNull( $this->intentQuote );

		$res = $this->submit( $id, array() );
		$this->assertSame( 422, $res['status'] );
		$this->assertNull( $this->verifyQuote, 'the gateway is not asked to confirm' );
	}

	/** PAY-26: without a card field (offline payment) a small order is still saved. */
	public function test_pay26_small_offline_orders_are_kept() {
		$id  = $this->form(
			array( array( 'id' => 'p', 'key' => 'sticker', 'type' => 'payment_product', 'label' => 'Sticker', 'price' => 0.30 ) ),
			'published',
			array( 'currency' => 'USD' )
		);
		$res = $this->submit( $id, array() );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
	}

	/** PAY-25: payment validation messages go through translation. */
	public function test_pay25_payment_validation_messages_are_translated() {
		$marker = static function ( $translation, $text, $domain ) {
			return 'subtleforms' === $domain ? '[t] ' . $translation : $translation;
		};
		add_filter( 'gettext', $marker, 10, 3 );
		$schema = array(
			'fields' => array(
				array( 'id' => 'a', 'type' => 'payment_amount', 'key' => 'tip', 'config' => array( 'key' => 'tip', 'label' => 'Tip', 'min' => 5, 'max' => 50 ) ),
				array( 'id' => 'c', 'type' => 'payment_coupon', 'key' => 'promo', 'config' => array( 'key' => 'promo', 'label' => 'Coupon' ) ),
			),
		);
		$messages = array();
		foreach ( array( array( 'tip' => 'abc' ), array( 'tip' => '-1' ), array( 'tip' => '2' ), array( 'tip' => '99' ), array( 'promo' => 'BAD!' ) ) as $payload ) {
			$result     = ( new \SubtleForms\Engine\FieldValidator() )->validate( $schema, $payload, array( 'hidden_fields' => array(), 'required_fields' => array() ) );
			$messages[] = implode( ' ', array_map( static fn( $e ) => is_array( $e ) ? implode( ' ', $e ) : (string) $e, (array) ( $result['errors'] ?? $result ) ) );
		}
		remove_filter( 'gettext', $marker, 10 );
		foreach ( $messages as $message ) {
			$this->assertStringContainsString( '[t] ', $message, $message );
		}
	}

	/** PAY-14: coupon dates that cannot be read, or end before they start, are refused. */
	public function test_pay14_coupon_dates_are_checked() {
		$bad = array(
			array( 'starts_at' => '2027-01-01', 'expires_at' => '2026-01-01' ),
			array( 'expires_at' => 'not a date' ),
			array( 'starts_at' => 'soon-ish' ),
		);
		foreach ( $bad as $i => $dates ) {
			$saved = CouponsRepository::save( array_merge( array( 'code' => 'PAY14BAD' . $i, 'type' => 'percent', 'amount' => 10 ), $dates ) );
			if ( is_array( $saved ) ) {
				$this->couponIds[] = (int) $saved['id'];
			}
			$this->assertWPError( $saved );
			$this->assertSame( 'subtleforms_coupon_date', $saved->get_error_code() );
			$this->assertSame( 400, $saved->get_error_data()['status'] );
		}
		$this->assertNull( CouponsRepository::findByCode( 'PAY14BAD1' ), 'an unreadable expiry is not saved as never expires' );

		$ok = $this->coupon( 'PAY14OK', array( 'starts_at' => '2026-01-01', 'expires_at' => '2027-01-01' ) );
		$this->assertSame( '2027-01-01 00:00:00', $ok['expires_at'] );
		$this->assertNull( $this->coupon( 'PAY14NONE', array( 'expires_at' => '' ) )['expires_at'] );
	}

	/** PAY2-01: Tools export and import keep the order, payment record and payment status. */
	public function test_pay2_01_transfer_keeps_order_and_payment() {
		$this->asAdmin();
		$fields = array( array( 'id' => 'p', 'key' => 'ticket', 'type' => 'payment_product', 'label' => 'Ticket', 'price' => 20 ) );
		$from   = $this->form( $fields );
		$to     = $this->form( $fields );
		$subs   = new \SubtleForms\Repositories\SubmissionsRepository();
		$order  = array(
			'currency' => 'EUR',
			'items'    => array( array( 'key' => 'ticket', 'label' => 'Ticket', 'qty' => 1, 'unit' => 20, 'amount' => 20 ) ),
			'subtotal' => 20,
			'discount' => 2,
			'coupon'   => 'SAVE10',
			'tax_rate' => 0,
			'tax'      => 0,
			'total'    => 18,
		);
		$paid   = array( 'status' => 'paid', 'gateway' => 'stripe', 'transaction_id' => 'pi_123', 'amount' => 18, 'currency' => 'EUR', 'mode' => 'test' );
		$subs->create( array( 'form_id' => $from, 'payload' => array( 'ticket' => '1' ), 'status' => 'completed', 'meta' => array( 'order' => $order, 'payment' => $paid, 'notes' => array() ) ) );
		$subs->create( array( 'form_id' => $from, 'payload' => array( 'ticket' => '1' ), 'status' => 'payment_failed', 'meta' => array( 'order' => $order, 'payment' => array_merge( $paid, array( 'status' => 'failed' ) ) ) ) );

		$service = new \SubtleForms\Tools\TransferService( new FormsRepository(), $subs );
		$package = json_decode( wp_json_encode( $service->exportSubmissions( $from ) ), true );
		$this->assertSame( 'pi_123', $package['submissions'][0]['payment']['transaction_id'] );

		$result = $service->importSubmissions( $to, $package );
		$this->assertSame( 2, $result['imported'], $result['error'] );

		$rows = $subs->findByForm( $to, array( 'orderby' => 'id', 'order' => 'ASC' ) );
		$this->assertCount( 2, $rows );
		$this->assertSame( 'completed', $rows[0]['status'] );
		$this->assertSame( 'payment_failed', $rows[1]['status'], 'a failed payment is not imported as unread' );
		$this->assertSame( 'SAVE10', $rows[0]['meta']['order']['coupon'] );
		$this->assertEquals( 18, $rows[0]['meta']['order']['total'] );
		$this->assertSame( 'Ticket', $rows[0]['meta']['order']['items'][0]['label'] );
		$this->assertSame( 'paid', $rows[0]['meta']['payment']['status'] );
		$this->assertSame( 'stripe', $rows[0]['meta']['payment']['gateway'] );
		$this->assertSame( 'pi_123', $rows[0]['meta']['payment']['transaction_id'] );
		$this->assertArrayNotHasKey( 'notes', $rows[0]['meta'] );
	}

	private function assertWPError( $value ): void {
		$this->assertInstanceOf( \WP_Error::class, $value );
	}
}
