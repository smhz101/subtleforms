<?php
// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * Webhooks in 2.4.1: the address check with a readable reason.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

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

}
