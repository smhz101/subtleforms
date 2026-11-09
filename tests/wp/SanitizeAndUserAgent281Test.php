<?php
// phpcs:disable -- Integration tests; not shipped in production plugin.
/**
 * Answers and request values that used to lose data or the whole entry:
 * a "<" in an answer (issue #80) and a long User-Agent (issue #81).
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

use SubtleForms\Engine\Actions\EmailAction;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Repositories\SubmissionsRepository;

final class SanitizeAndUserAgent281Test extends TestCase {

	private function form(): int {
		return $this->publish(
			array(
				array( 'id' => 'n', 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
				array( 'id' => 'm', 'key' => 'message', 'type' => 'textarea', 'label' => 'Message' ),
			)
		);
	}

	/** @var array[] */
	private $jobs = array();

	protected function setUp(): void {
		parent::setUp();
		$this->jobs = array();
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		unset( $_SERVER['HTTP_USER_AGENT'] );
		parent::tearDown();
	}

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && 'subtleforms_async_email' === $event->hook ) {
			$this->jobs[] = \SubtleForms\Async\AsyncDispatcher::resolve( $event->args[0] );
			return true;
		}
		return $pre;
	}

	private function emailFor( string $answer, string $format ): array {
		$context = new SubmissionContext( 1, array( 'message' => $answer ) );
		$context->setMeta( 'form_schema', array( 'fields' => array( array( 'key' => 'message', 'type' => 'textarea', 'label' => 'Message' ) ) ) );
		$context->setMeta( 'submission_id', 0 );
		$context->setMeta(
			'current_step_settings',
			array(
				'to'      => 'owner@example.com',
				'subject' => 'New entry',
				'body'    => 'Message: {{message}}',
				'format'  => $format,
			)
		);
		( new EmailAction() )->handle( $context );
		$this->assertCount( 1, $this->jobs, 'one email queued' );
		return $this->jobs[0];
	}

	public function test_a_stored_less_than_sign_reaches_a_plain_text_email_unchanged(): void {
		$job = $this->emailFor( 'Budget <5000 USD', 'text' );
		$this->assertStringContainsString( 'Message: Budget <5000 USD', $job['body'] );
	}

	public function test_a_stored_less_than_sign_is_escaped_once_in_an_html_email(): void {
		$job = $this->emailFor( 'Budget <5000 & more', 'html' );
		$this->assertStringContainsString( 'Message: Budget &lt;5000 &amp; more', $job['body'] );
		$this->assertStringNotContainsString( '&amp;lt;', $job['body'] );
		$this->assertStringNotContainsString( '<5000', $job['body'] );
	}

	public function test_an_answer_with_a_less_than_sign_is_stored_whole(): void {
		$id      = $this->form();
		$message = "Budget <5000 USD, please call me after 6pm\nI <3 it";
		$result  = $this->submit( $id, array( 'name' => 'x<y', 'message' => $message ) );

		$this->assertSame( 200, $result['status'] );
		$stored = $this->storedPayload( $id );
		$this->assertSame( $message, $stored['message'] );
		$this->assertSame( 'x<y', $stored['name'] );
	}

	public function test_the_entry_view_shows_the_answer_escaped_once(): void {
		$id = $this->form();
		$this->submit( $id, array( 'name' => 'Ada', 'message' => 'a <5 b & c' ) );
		$stored = $this->storedPayload( $id );
		$this->assertSame( 'a <5 b & c', $stored['message'] );
		$shown = \SubtleForms\Support\AnswerFormatter::html( $stored['message'], array( 'type' => 'textarea' ) );
		$this->assertStringContainsString( 'a &lt;5 b &amp; c', $shown );
		$this->assertStringNotContainsString( '&amp;lt;', $shown );
		$this->assertStringNotContainsString( 'a <5', $shown );
	}

	public function test_a_long_user_agent_does_not_lose_the_entry(): void {
		global $wpdb;
		$id                        = $this->form();
		$_SERVER['HTTP_USER_AGENT'] = str_repeat( 'Mozilla/5.0 ', 30 ) . '[FBAN/FBIOS;FBAV/450.0]';
		$result                    = $this->submit( $id, array( 'name' => 'Ada', 'message' => 'Hello' ) );

		$this->assertSame( 200, $result['status'] );
		$agent = (string) $wpdb->get_var( $wpdb->prepare( "SELECT user_agent FROM {$wpdb->prefix}subtleforms_submissions WHERE form_id = %d ORDER BY id DESC LIMIT 1", $id ) );
		$this->assertSame( 255, strlen( $agent ) );
		$this->assertSame( substr( trim( $_SERVER['HTTP_USER_AGENT'] ), 0, 255 ), $agent );
	}

	public function test_the_repository_cuts_values_longer_than_their_columns(): void {
		global $wpdb;
		$id   = $this->form();
		$repo = new SubmissionsRepository();
		$sid  = $repo->create(
			array(
				'form_id'    => $id,
				'payload'    => array( 'name' => 'Imported' ),
				'ip_address' => str_repeat( '1', 100 ),
				'user_agent' => str_repeat( 'u', 256 ),
			)
		);
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT ip_address, user_agent FROM {$wpdb->prefix}subtleforms_submissions WHERE id = %d", $sid ), ARRAY_A );
		$this->assertSame( 255, strlen( $row['user_agent'] ) );
		$this->assertSame( 45, strlen( $row['ip_address'] ) );
	}
}
