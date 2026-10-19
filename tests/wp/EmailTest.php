<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.2.1 bugs 4 and 6 in notification emails: line breaks are kept, and
 * passwords are never sent.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Engine\Actions\EmailAction;
use SubtleForms\Engine\SubmissionContext;

final class EmailTest extends TestCase {

	/** @var array[] */
	private $jobs = array();

	protected function setUp(): void {
		parent::setUp();
		$this->jobs = array();
		add_filter( 'pre_schedule_event', array( $this, 'capture' ), 10, 2 );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_schedule_event', array( $this, 'capture' ), 10 );
		parent::tearDown();
	}

	public function capture( $pre, $event ) {
		if ( isset( $event->hook ) && $event->hook === 'subtleforms_async_email' ) {
			$this->jobs[] = $event->args[0];
			return true;
		}
		return $pre;
	}

	private function send( array $settings, array $payload ): array {
		$schema = array(
			'fields' => array(
				array( 'key' => 'notes', 'type' => 'textarea', 'label' => 'Notes' ),
				array( 'key' => 'bio', 'type' => 'rich_text', 'label' => 'Bio' ),
				array( 'key' => 'secret', 'type' => 'password', 'label' => 'Password' ),
			),
		);
		$context = new SubmissionContext( 1, $payload );
		$context->setMeta( 'form_schema', $schema );
		$context->setMeta( 'submission_id', 0 );
		$context->setMeta( 'current_step_settings', $settings );
		( new EmailAction() )->handle( $context );
		$this->assertCount( 1, $this->jobs, 'one email queued' );
		return $this->jobs[0];
	}

	public function test_plain_text_email_keeps_line_breaks_and_drops_passwords() {
		$job = $this->send(
			array(
				'to'      => 'owner@example.com',
				'subject' => 'New entry',
				'body'    => "Notes: {{notes}}\nPassword: {{secret}}\nBio: {{bio}}",
			),
			array( 'notes' => "Multi\nline", 'secret' => 'hunter2', 'bio' => '<b>Bold</b> rich' )
		);
		$this->assertStringContainsString( "Notes: Multi\nline", $job['body'] );
		$this->assertStringContainsString( 'Bio: Bold rich', $job['body'] );
		$this->assertStringNotContainsString( 'hunter2', $job['body'] );
		$this->assertContains( 'Content-Type: text/plain; charset=UTF-8', $job['headers'] );
	}

	public function test_html_email_turns_line_breaks_into_br() {
		$job = $this->send(
			array(
				'to'      => 'owner@example.com',
				'subject' => 'New entry from {{notes}}',
				'body'    => "Notes: {{notes}}\nBio: {{bio}}\nPassword: {{secret}}",
				'format'  => 'html',
			),
			array( 'notes' => "Multi\n<line>", 'secret' => 'hunter2', 'bio' => '<b>Bold</b> rich' )
		);
		$this->assertStringContainsString( "Multi<br />\n&lt;line&gt;", $job['body'] );
		$this->assertStringContainsString( '<b>Bold</b> rich', $job['body'] );
		$this->assertStringNotContainsString( 'hunter2', $job['body'] );
		$this->assertContains( 'Content-Type: text/html; charset=UTF-8', $job['headers'] );
		// The subject is plain text.
		$this->assertStringNotContainsString( '<br', $job['subject'] );
		$this->assertSame( 'New entry from Multi <line>', $job['subject'] );
	}
}
