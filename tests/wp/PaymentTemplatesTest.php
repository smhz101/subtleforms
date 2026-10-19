<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * Forms made from the Payment Form and Donation Form templates charge what
 * the visitor sees (review of PR #15).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Templates\FormTemplates;

final class PaymentTemplatesTest extends TestCase {

	/** @var array|null Quote the gateway was asked to charge at intent. */
	private $intentQuote;

	protected function setUp(): void {
		parent::setUp();
		$this->intentQuote = null;
	}

	protected function tearDown(): void {
		remove_all_filters( 'subtleforms/extension/payments/create_intent' );
		parent::tearDown();
	}

	/**
	 * Create and publish a form from a template, the way the New form screen
	 * does: POST /forms with the template's schema.
	 */
	private function fromTemplate( string $templateId ): int {
		$template = FormTemplates::get( $templateId );
		$this->assertIsArray( $template );
		$this->asAdmin();
		$schema             = $template['schema'];
		$schema['metadata'] = array_merge(
			(array) ( $schema['metadata'] ?? array() ),
			array(
				'name'     => 'form_schema',
				'title'    => 'Template test',
				'type'     => 'regular',
				'template' => $templateId,
			)
		);
		$schema['schema_version'] = 1;

		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/forms' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_body( wp_json_encode( array( 'title' => 'Template test', 'schema' => $schema ) ) );
		$response = rest_do_request( $request );
		$this->assertSame( 201, $response->get_status(), wp_json_encode( $response->get_data() ) );
		$data = $response->get_data();
		$id   = (int) ( $data['data']['id'] ?? $data['id'] ?? 0 );
		$this->assertGreaterThan( 0, $id );
		$this->formIds[] = $id;

		( new \SubtleForms\Repositories\FormsRepository() )->update( $id, array( 'status' => 'published' ) );
		wp_set_current_user( 0 );
		return $id;
	}

	/** POST a public payments route as a visitor. */
	private function quote( int $formId, array $data ): array {
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/payments/quote' );
		$request->set_header( 'content-type', 'application/json' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_body( wp_json_encode( array( 'form_id' => $formId, 'data' => $data ) ) );
		$response = rest_do_request( $request );
		$this->assertSame( 200, $response->get_status(), wp_json_encode( $response->get_data() ) );
		return (array) $response->get_data()['data'];
	}

	/** The amount the payment intent would charge, as the card field asks for it. */
	private function intentTotal( int $formId, array $data ): float {
		add_filter(
			'subtleforms/extension/payments/create_intent',
			function ( $result, $request, $settings, $quote ) {
				$this->intentQuote = $quote;
				return array( 'client_secret' => 'test' );
			},
			10,
			4
		);
		$ext     = new \SubtleForms\Extensions\PaymentsExtension(
			new \SubtleForms\Support\Settings(),
			new \SubtleForms\Support\FeatureGate( new \SubtleForms\Support\Capabilities() )
		);
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/payments/intent' );
		$request->set_param( 'form_id', $formId );
		$request->set_param( 'data', $data );
		$ext->createIntent( $request );
		return (float) ( $this->intentQuote['total'] ?? 0 );
	}

	/**
	 * Review #15 (4309435330): the fixed product sends no value, because it has
	 * no quantity box. The quote, the payment intent and the stored order
	 * still charge it once, as the order summary shows.
	 */
	public function test_payment_template_charges_its_fixed_product_without_a_submitted_value(): void {
		$id = $this->fromTemplate( 'payment_form' );

		$quote = $this->quote( $id, array() );
		$this->assertSame( 10.0, (float) $quote['total'] );
		$this->assertCount( 1, $quote['items'] );
		$this->assertSame( 1, (int) $quote['items'][0]['qty'] );

		$this->assertSame( 10.0, $this->intentTotal( $id, array() ) );

		$res = $this->submit( $id, array() );
		$this->assertSame( 200, $res['status'], wp_json_encode( $res['data'] ) );
		$this->assertStringContainsString( '"total":10', $this->storedRow( $id ) );
	}
}
