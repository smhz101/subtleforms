<?php

// phpcs:disable -- Integration test; not shipped in production plugin.
/**
 * 2.3.3: a drawn signature reads as an image in HTML emails (embedded, not a
 * data URI), as "Signed" in plain text and CSV, never as its long code.
 *
 * @package SubtleForms\Tests\WP
 */

namespace SubtleForms\Tests\WP;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use SubtleForms\Engine\Actions\EmailAction;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Support\EntryValues;
use SubtleForms\Support\Mailer;

final class SignatureTest extends TestCase {

	/** 1x1 transparent PNG. */
	const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

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

	private function send( string $format ): array {
		$context = new SubmissionContext( 1, array( 'name' => 'Ada', 'sig' => self::PNG ) );
		$context->setMeta(
			'form_schema',
			array(
				'fields' => array(
					array( 'key' => 'name', 'type' => 'text', 'label' => 'Name' ),
					array( 'key' => 'sig', 'type' => 'signature', 'label' => 'Signature' ),
				),
			)
		);
		$context->setMeta( 'submission_id', 0 );
		$context->setMeta( 'current_step_settings', array( 'to' => 'owner@example.com', 'subject' => 'New', 'body' => '{all_fields}', 'format' => $format ) );
		( new EmailAction() )->handle( $context );
		$this->assertCount( 1, $this->jobs );
		return $this->jobs[0];
	}

	public function test_detects_only_png_and_jpeg_data_uris() {
		$this->assertTrue( EntryValues::isSignatureImage( self::PNG ) );
		$this->assertTrue( EntryValues::isSignatureImage( 'data:image/jpeg;base64,AAAA' ) );
		$this->assertFalse( EntryValues::isSignatureImage( 'data:image/svg+xml;base64,AAAA' ) );
		$this->assertFalse( EntryValues::isSignatureImage( 'data:image/png;base64,AA"><script>' ) );
		$this->assertFalse( EntryValues::isSignatureImage( 'Signed' ) );
	}

	public function test_plain_text_email_says_signed() {
		$job = $this->send( 'text' );
		$this->assertStringContainsString( 'Signature: Signed', $job['body'] );
		$this->assertStringNotContainsString( 'base64', $job['body'] );
	}

	public function test_html_email_shows_the_image_and_mailer_embeds_it() {
		$job = $this->send( 'html' );
		$this->assertStringContainsString( '<img src="data:image/png;base64,', $job['body'] );

		$out = Mailer::extractInlineImages( $job['body'] );
		$this->assertCount( 1, $out['images'] );
		$cid = array_keys( $out['images'] )[0];
		$this->assertStringContainsString( 'src="cid:' . $cid . '"', $out['html'] );
		$this->assertStringNotContainsString( 'data:image', $out['html'] );
		$this->assertSame( 'image/png', $out['images'][ $cid ]['mime'] );
		$this->assertStringStartsWith( "\x89PNG", $out['images'][ $cid ]['data'] );
	}

	public function test_mailer_attaches_embedded_images_when_sending() {
		$embedded = array();
		$spy      = static function ( $phpmailer ) use ( &$embedded ) {
			foreach ( $phpmailer->getAttachments() as $a ) {
				$embedded[] = array( 'cid' => $a[7], 'disposition' => $a[6] );
			}
		};
		add_action( 'phpmailer_init', $spy, 99 );
		// A site or must-use plugin may short-circuit wp_mail() (a mail catcher,
		// the e2e helper). The test needs PHPMailer to be set up, so put any
		// such filter aside for the call and restore it after.
		$short_circuit = $GLOBALS['wp_filter']['pre_wp_mail'] ?? null;
		unset( $GLOBALS['wp_filter']['pre_wp_mail'] );
		$from = static fn() => 'site@example.com';
		add_filter( 'wp_mail_from', $from );
		Mailer::send( 'owner@example.com', 'Hi', '<p>Sig</p><img src="' . self::PNG . '" alt="">', array( 'Content-Type: text/html; charset=UTF-8' ) );
		remove_action( 'phpmailer_init', $spy, 99 );
		remove_filter( 'wp_mail_from', $from );
		if ( null !== $short_circuit ) {
			$GLOBALS['wp_filter']['pre_wp_mail'] = $short_circuit;
		}

		$this->assertCount( 1, $embedded );
		$this->assertSame( 'inline', $embedded[0]['disposition'] );
		$this->assertStringStartsWith( 'sf-inline-1-', $embedded[0]['cid'] );
	}
}
