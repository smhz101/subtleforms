<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Webhook payload selection and header rules in 2.5.0.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Engine\Actions\WebhookAction;
use SubtleForms\Engine\SubmissionContext;

final class Webhooks250Test extends TestCase {

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
			$this->jobs[] = \SubtleForms\Async\AsyncDispatcher::resolve( $event->args[0] );
			return true;
		}
		return $pre;
	}

	private function run_action( array $settings, array $payload, array $meta = array() ): array {
		$context = new SubmissionContext( 7, $payload );
		$context->setMeta(
			'form_schema',
			array(
				'metadata' => array( 'title' => 'Contact' ),
				'fields'   => array(
					array( 'type' => 'text', 'key' => 'name', 'label' => 'Name' ),
					array( 'type' => 'email', 'key' => 'email', 'label' => 'Email' ),
					array( 'type' => 'password', 'key' => 'pass', 'label' => 'Password' ),
				),
			)
		);
		$context->setMeta( 'submission_id', 41 );
		$context->setMeta( 'current_step_id', 'action:webhook:1' );
		$context->setMeta( 'current_step_settings', $settings );
		foreach ( $meta as $key => $value ) {
			$context->setMeta( $key, $value );
		}
		( new WebhookAction() )->handle( $context );
		return (array) end( $this->jobs );
	}

	public function test_selected_mode_sends_only_the_ticked_data_with_the_request_details(): void {
		$job = $this->run_action(
			array(
				'url'               => 'https://93.184.216.34/receive',
				'payload_mode'      => 'selected',
				'payload_selection' => array( 'form_id', 'submission_id', 'ip_address', 'user_agent', 'page_url', 'user_id', 'status', 'field:name', 'field:pass', 'payment_amount', 'payment_currency', 'payment_status' ),
			),
			array( 'name' => 'Ann', 'email' => 'ann@example.com', 'pass' => 'hunter2', 'g-recaptcha-response' => 'tok', 'website_url' => '' ),
			array(
				'request_ip'         => '203.0.113.9',
				'request_user_agent' => 'Agent/1.0',
				'request_page_url'   => 'https://example.com/contact/',
				'request_user_id'    => 5,
				'entry_status'       => 'completed',
				'payment_info'       => array( 'amount' => 12.5, 'currency' => 'EUR', 'status' => 'paid' ),
			)
		);
		$body = json_decode( (string) $job['body'], true );
		$this->assertSame( 'submission.created', $body['event'] );
		$this->assertSame( 7, $body['form_id'] );
		$this->assertSame( 41, $body['submission_id'] );
		$this->assertSame( '203.0.113.9', $body['ip_address'] );
		$this->assertSame( 'Agent/1.0', $body['user_agent'] );
		$this->assertSame( 'https://example.com/contact/', $body['page_url'] );
		$this->assertSame( 5, $body['user_id'] );
		$this->assertSame( 'completed', $body['status'] );
		$this->assertSame( array( 'amount' => 12.5, 'currency' => 'EUR', 'status' => 'paid' ), $body['payment'] );
		$this->assertSame( array( 'name' => 'Ann' ), $body['fields'] );
		$this->assertArrayNotHasKey( 'form_title', $body );
		$this->assertArrayNotHasKey( 'answers', $body );
		$this->assertStringNotContainsString( 'hunter2', (string) $job['body'] );
		$this->assertStringNotContainsString( 'ann@example.com', (string) $job['body'] );
		$this->assertStringNotContainsString( 'tok', (string) $job['body'] );
	}

	public function test_full_mode_still_sends_the_documented_body(): void {
		$job  = $this->run_action( array( 'url' => 'https://93.184.216.34/receive', 'payload_mode' => 'full' ), array( 'name' => 'Ann', 'form_rendered_at' => 'v1.token' ) );
		$body = json_decode( (string) $job['body'], true );
		$this->assertSame( array( 'event', 'form_id', 'form_title', 'submission_id', 'created_at', 'site_url', 'entry_url', 'fields', 'answers' ), array_keys( $body ) );
		$this->assertSame( array( 'name' => 'Ann' ), $body['fields'] );
	}

	public function test_a_webhook_saved_before_2_5_0_without_a_mode_still_sends_the_full_body(): void {
		$job  = $this->run_action( array( 'url' => 'https://93.184.216.34/receive' ), array( 'name' => 'Ann' ) );
		$body = json_decode( (string) $job['body'], true );
		$this->assertArrayHasKey( 'site_url', $body );
		$this->assertArrayHasKey( 'answers', $body );
	}

	public function test_custom_mode_body_is_unchanged_and_can_use_entry_tags(): void {
		$job = $this->run_action(
			array( 'url' => 'https://93.184.216.34/receive', 'payload_mode' => 'custom', 'custom_payload' => '{"n":"{{name}}","t":"{form_title}","e":"{{entry_id}}"}' ),
			array( 'name' => 'Ann' )
		);
		$this->assertSame( '{"n":"Ann","t":"Contact","e":"41"}', $job['body'] );

		$job = $this->run_action(
			array( 'url' => 'https://93.184.216.34/receive', 'payload_mode' => 'custom', 'custom_payload' => '{"ip":"{{entry:ip_address}}","id":"{{entry:form_id}}"}' ),
			array( 'name' => 'Ann' ),
			array( 'request_ip' => '203.0.113.9' )
		);
		$this->assertSame( '{"ip":"203.0.113.9","id":"7"}', $job['body'] );
	}

	public function test_headers_the_server_refuses_are_not_sent(): void {
		$job = $this->run_action(
			array(
				'url'     => 'https://93.184.216.34/receive',
				'headers' => array( 'X-Source' => 'sf', 'Host' => 'evil.example', 'X-SubtleForms-Signature' => 'forged', 'Bad Name' => 'x' ),
			),
			array( 'name' => 'Ann' )
		);
		$this->assertSame( 'sf', $job['headers']['X-Source'] );
		$this->assertArrayNotHasKey( 'Host', $job['headers'] );
		$this->assertArrayNotHasKey( 'X-SubtleForms-Signature', $job['headers'] );
		$this->assertArrayNotHasKey( 'Bad Name', $job['headers'] );
	}

	public function test_the_test_route_sends_the_ticked_data_built_from_the_forms_fields(): void {
		$this->asAdmin();
		$sent = array();
		add_filter(
			'pre_http_request',
			static function ( $pre, $args ) use ( &$sent ) {
				$sent = $args;
				return array( 'headers' => array(), 'body' => '', 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array() );
			},
			10,
			2
		);
		$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/webhooks/test' );
		$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
		$request->set_body_params(
			array(
				'url'               => 'https://93.184.216.34/x',
				'payload_mode'      => 'selected',
				'payload_selection' => array( 'form_title', 'field:name', 'field:pass', 'ip_address' ),
				'fields'            => array(
					array( 'key' => 'name', 'label' => 'Name', 'type' => 'text' ),
					array( 'key' => 'pass', 'label' => 'Password', 'type' => 'password' ),
				),
				'sample'            => array( 'name' => 'Sample name', 'pass' => 'secret-sample' ),
				'form_title'        => 'Contact',
			)
		);
		$response = rest_do_request( $request );
		$this->assertSame( 200, $response->get_status() );
		$body = json_decode( (string) $sent['body'], true );
		$this->assertSame( 'Contact', $body['form_title'] );
		$this->assertSame( array( 'name' => 'Sample name' ), $body['fields'] );
		$this->assertSame( '203.0.113.10', $body['ip_address'] );
		$this->assertTrue( $body['test'] );
		$this->assertStringNotContainsString( 'secret-sample', (string) $sent['body'] );
	}

	public function test_the_test_route_builds_the_full_and_custom_bodies_from_the_forms_fields(): void {
		$this->asAdmin();
		$sent = array();
		add_filter(
			'pre_http_request',
			static function ( $pre, $args ) use ( &$sent ) {
				$sent = $args;
				return array( 'headers' => array(), 'body' => '', 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array() );
			},
			10,
			2
		);
		$fields = array( array( 'key' => 'plan', 'label' => 'Plan', 'type' => 'text' ) );
		foreach ( array( 'full', 'custom' ) as $mode ) {
			$request = new \WP_REST_Request( 'POST', '/subtleforms/v1/webhooks/test' );
			$request->set_header( 'X-WP-Nonce', wp_create_nonce( 'wp_rest' ) );
			$request->set_body_params(
				array(
					'url'            => 'https://93.184.216.34/x',
					'payload_mode'   => $mode,
					'custom_payload' => '{"p":"{{field:plan}}","ip":"{{entry:ip_address}}"}',
					'fields'         => $fields,
					'sample'         => array( 'plan' => 'Pro' ),
				)
			);
			$this->assertSame( 200, rest_do_request( $request )->get_status() );
			$body = json_decode( (string) $sent['body'], true );
			if ( 'full' === $mode ) {
				$this->assertSame( array( 'plan' => 'Pro' ), $body['fields'] );
			} else {
				$this->assertSame( array( 'p' => 'Pro', 'ip' => '203.0.113.10' ), $body );
			}
		}
	}
}
