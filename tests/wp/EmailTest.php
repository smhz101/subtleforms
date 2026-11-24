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
			$this->jobs[] = \SubtleForms\Async\AsyncDispatcher::resolve( $event->args[0] );
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

	public function test_submitter_email_is_queued_when_the_switch_is_on_and_skipped_when_off_134() {
		$before = get_option( 'subtleforms_settings', null );
		$run    = function ( bool $on ): array {
			update_option( 'subtleforms_settings', array( 'user_confirmation_enabled' => $on ) );
			$this->jobs = array();
			$context    = new SubmissionContext( 1, array( 'email' => 'visitor@example.com' ) );
			$context->setMeta( 'form_schema', array( 'fields' => array( array( 'key' => 'email', 'type' => 'email', 'label' => 'Email' ) ) ) );
			$context->setMeta( 'submission_id', 0 );
			$context->setMeta( 'current_step_settings', array( 'to' => '{email}', 'subject' => 'Thanks', 'body' => 'Hello' ) );
			( new EmailAction() )->handle( $context );
			return array( count( $this->jobs ), $context->getMeta( 'action_skips', array() ) );
		};

		list( $queued, $skips ) = $run( false );
		$this->assertSame( 0, $queued, 'nothing is sent with the switch off' );
		$this->assertSame( 'submitter_emails_off', $skips[0]['reason'] );
		$this->assertSame( 'Submitter emails are turned off in Settings, Email.', $skips[0]['message'] );

		list( $queued, $skips ) = $run( true );
		$this->assertSame( 1, $queued, 'the auto-reply is queued with the switch on' );
		$this->assertSame( array(), $skips );

		null === $before ? delete_option( 'subtleforms_settings' ) : update_option( 'subtleforms_settings', $before );
	}

	public function test_fresh_install_helper_turns_submitter_emails_on_only_on_a_fresh_install_134() {
		$before = get_option( 'subtleforms_settings', null );

		delete_option( 'subtleforms_settings' );
		\SubtleForms\Support\Settings::afterActivate( true );
		$this->assertTrue( get_option( 'subtleforms_settings' )['user_confirmation_enabled'] );

		update_option( 'subtleforms_settings', array( 'user_confirmation_enabled' => false ) );
		\SubtleForms\Support\Settings::afterActivate( false );
		$this->assertFalse( get_option( 'subtleforms_settings' )['user_confirmation_enabled'] );

		null === $before ? delete_option( 'subtleforms_settings' ) : update_option( 'subtleforms_settings', $before );
	}
}
