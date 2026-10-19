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

	private function assertWPError( $value ): void {
		$this->assertInstanceOf( \WP_Error::class, $value );
	}
}
