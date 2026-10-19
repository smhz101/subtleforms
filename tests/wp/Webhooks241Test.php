<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Webhooks in 2.4.1: the default body, the address check with a readable
 * reason, and the free Settings test request.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Api\WebhooksApi;
use SubtleForms\Engine\Actions\WebhookAction;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Support\Webhooks;

final class Webhooks241Test extends TestCase {

	/** @var array[] */
	private $jobs = array();

	protected function setUp(): void {
		parent::setUp();
		$this->jobs = array();
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		remove_all_filters( 'pre_http_request' );
		parent::tearDown();
	}

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_webhook' === $event->hook ) {
			$this->jobs[] = $event->args[0];
			return true;
		}
		return $pre;
	}

	private function handle( array $settings, array $payload, array $meta = array() ): SubmissionContext {
		$context = new SubmissionContext( 7, $payload );
		$context->setMeta( 'form_schema', array( 'metadata' => array( 'title' => 'Contact' ), 'fields' => array( array( 'type' => 'text', 'key' => 'name', 'label' => 'Name' ) ) ) );
		$context->setMeta( 'submission_id', 41 );
		$context->setMeta( 'current_step_id', 'action:webhook:1' );
		$context->setMeta( 'current_step_settings', $settings );
		foreach ( $meta as $key => $value ) {
			$context->setMeta( $key, $value );
		}
		( new WebhookAction() )->handle( $context );
		return $context;
	}

	public function test_full_body_is_the_documented_shape_without_spam_or_captcha_values(): void {
		$this->handle(
			array( 'url' => 'https://93.184.216.34/receive', 'payload_mode' => 'full' ),
			array( 'name' => 'Ann', 'form_rendered_at' => 'v1.token', 'website_url' => '', 'g-recaptcha-response' => 'tok', '_payment' => 'pi_1' )
		);
		$this->assertCount( 1, $this->jobs );
		$body = json_decode( (string) $this->jobs[0]['body'], true );
		$this->assertSame( 'submission.created', $body['event'] );
		$this->assertSame( 7, $body['form_id'] );
		$this->assertSame( 'Contact', $body['form_title'] );
		$this->assertSame( 41, $body['submission_id'] );
		$this->assertStringContainsString( 'submission_id=41', $body['entry_url'] );
		$this->assertSame( array( 'name' => 'Ann' ), $body['fields'] );
		$this->assertSame( array( array( 'key' => 'name', 'label' => 'Name', 'value' => 'Ann' ) ), $body['answers'] );
	}

	public function test_custom_body_never_offers_internal_values(): void {
		$this->handle(
			array( 'url' => 'https://93.184.216.34/receive', 'payload_mode' => 'custom', 'custom_payload' => '{"n":"{{name}}","t":"{{form_rendered_at}}"}' ),
			array( 'name' => 'Ann', 'form_rendered_at' => 'v1.token' )
		);
		$body = json_decode( (string) $this->jobs[0]['body'], true );
		$this->assertSame( 'Ann', $body['n'] );
		$this->assertStringNotContainsString( 'v1.token', (string) $this->jobs[0]['body'] );
	}

	public function test_an_address_without_scheme_gets_https(): void {
		$this->handle( array( 'url' => '  93.184.216.34/receive ' ), array( 'name' => 'Ann' ) );
		$this->assertSame( 'https://93.184.216.34/receive', $this->jobs[0]['url'] );
	}

	public function test_a_blocked_address_is_logged_with_a_reason_instead_of_a_code(): void {
		$context = $this->handle( array( 'url' => 'http://127.0.0.1:5678/webhook' ), array( 'name' => 'Ann' ) );
		$this->assertCount( 0, $this->jobs );
		$fail = $context->getMeta( 'action_failures' )[0];
		$this->assertSame( 'blocked_url', $fail['reason'] );
		$this->assertStringContainsString( '127.0.0.1:5678', $fail['response'] );
		$this->assertStringContainsString( 'http_request_host_is_external', $fail['response'] );
	}

	public function test_a_host_the_site_allows_is_delivered(): void {
		$allow = static fn( $external, $host ) => '127.0.0.1' === $host ? true : $external;
		$ports = static fn( $p ) => array_merge( (array) $p, array( 5678 ) );
		add_filter( 'http_request_host_is_external', $allow, 10, 2 );
		add_filter( 'http_allowed_safe_ports', $ports );
		$this->handle( array( 'url' => 'http://127.0.0.1:5678/webhook' ), array( 'name' => 'Ann' ) );
		remove_filter( 'http_request_host_is_external', $allow, 10 );
		remove_filter( 'http_allowed_safe_ports', $ports );
		$this->assertCount( 1, $this->jobs );
	}

	public function test_a_malformed_address_asks_for_the_full_address(): void {
		$this->assertSame( 'invalid_url', Webhooks::urlProblem( 'https://' )->get_error_code() );
		$this->assertSame( 'invalid_url', Webhooks::urlProblem( 'ftp://example.com/x' )->get_error_code() );
		$this->assertNull( Webhooks::urlProblem( 'https://93.184.216.34/x' ) );
	}

	public function test_the_settings_test_route_needs_no_pro_and_reports_the_answer(): void {
		$this->asAdmin();
		$sent = array();
		add_filter(
			'pre_http_request',
			static function ( $pre, $args, $url ) use ( &$sent ) {
				$sent = array( 'url' => $url, 'args' => $args );
				return array( 'headers' => array(), 'body' => '{"ok":true}', 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array() );
			},
			10,
			3
		);
		update_option( 'subtleforms_settings', array_merge( (array) get_option( 'subtleforms_settings', array() ), array( 'ext_webhooks_signing_secret' => 'fixture' . 'secret' ) ) );

		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/webhooks/test' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_body_params( array( 'url' => '93.184.216.34/abc', 'method' => 'PUT', 'sign' => true ) );
		$response = rest_do_request( $request );

		$this->assertSame( 200, $response->get_status() );
		$this->assertTrue( $response->get_data()['ok'] );
		$this->assertTrue( $response->get_data()['signed'] );
		$this->assertSame( 'https://93.184.216.34/abc', $sent['url'] );
		$this->assertSame( 'PUT', $sent['args']['method'] );
		$body = json_decode( (string) $sent['args']['body'], true );
		$this->assertTrue( $body['test'] );
		$this->assertSame( 'Test Person', $body['fields']['name'] );
		$this->assertSame( Webhooks::signature( (string) $sent['args']['body'], 'fixture' . 'secret' ), $sent['args']['headers']['X-SubtleForms-Signature'] );
	}

	public function test_the_settings_test_route_explains_a_blocked_address(): void {
		$this->asAdmin();
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/webhooks/test' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_body_params( array( 'url' => 'http://localhost:9/x' ) );
		$response = rest_do_request( $request );
		$this->assertSame( 400, $response->get_status() );
		$this->assertStringContainsString( 'WordPress blocks requests to localhost:9', $response->as_error()->get_error_message() );
	}

	public function test_the_settings_test_route_is_for_administrators(): void {
		wp_set_current_user( 0 );
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/webhooks/test' );
		$request->set_body_params( array( 'url' => 'https://hooks.example.com/abc' ) );
		$this->assertSame( 403, rest_do_request( $request )->get_status() );
	}
}
