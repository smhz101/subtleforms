<?php
/**
 * Regressions for the 2.4.0 form fixes.
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use PHPUnit\Framework\TestCase;
use ReflectionMethod;
use SubtleForms\Api\PublicSubmitApi;
use SubtleForms\Api\SubmissionsApi;
use SubtleForms\Async\AsyncDispatcher;
use SubtleForms\Blocks\SubtleFormsBlock;
use SubtleForms\Engine\Actions\EmailAction;
use SubtleForms\Engine\Actions\WebhookAction;
use SubtleForms\Repositories\FormsRepository;
use SubtleForms\Repositories\LogsRepository;
use SubtleForms\Repositories\SubmissionsRepository;
use SubtleForms\Support\Settings;
use SubtleForms\Tools\ReportSeries;
use SubtleForms\Tools\TransferService;

/**
 * @coversNothing
 */
final class Release2404Test extends TestCase {

	public function test_email_toggles_and_sender_follow_the_saved_settings(): void {
		$this->assertFalse( EmailAction::audienceAllowed( 'submitter', array( 'user_confirmation_enabled' => false ) ) );
		$this->assertTrue( EmailAction::audienceAllowed( 'submitter', array( 'user_confirmation_enabled' => true ) ) );
		$this->assertFalse( EmailAction::audienceAllowed( 'admin', array( 'admin_notification_enabled' => false ) ) );
		$this->assertTrue( EmailAction::audienceAllowed( 'admin', array() ) );

		$audience = new ReflectionMethod( EmailAction::class, 'audience' );
		$audience->setAccessible( true );
		$email = new EmailAction();
		$this->assertSame( 'submitter', $audience->invoke( $email, '{field:email}' ) );
		$this->assertSame( 'admin', $audience->invoke( $email, '{admin_email}' ) );

		$plain = EmailAction::withSender( array(), array( 'sender_email' => 'forms@example.com', 'sender_name' => 'Desk' ) );
		$this->assertSame( array( 'From: Desk <forms@example.com>' ), $plain );
		$kept = EmailAction::withSender( array( 'From: Other <other@example.com>' ), array( 'sender_email' => 'forms@example.com' ) );
		$this->assertSame( array( 'From: Other <other@example.com>' ), $kept );
	}

	public function test_webhook_custom_payload_fills_field_tags(): void {
		$filled = WebhookAction::fillCustomPayload(
			array( 'name' => '{{name}}', 'form' => '{form_title}' ),
			array( 'name' => 'Ada' ),
			array( 'form_title' => 'Join' )
		);
		$this->assertSame( array( 'name' => 'Ada', 'form' => 'Join' ), $filled );
	}

	public function test_each_email_dispatch_gets_its_own_id(): void {
		$this->assertNotSame( AsyncDispatcher::dispatchId(), AsyncDispatcher::dispatchId() );
	}

	public function test_unflag_restores_the_pipeline_status(): void {
		$flagged = SubmissionsRepository::reviewStatus( 'payment_pending', 'flagged', array() );
		$this->assertSame( 'flagged', $flagged['status'] );
		$this->assertSame( 'payment_pending', $flagged['meta']['pipeline_status'] );

		$restored = SubmissionsRepository::reviewStatus( 'flagged', 'none', $flagged['meta'] );
		$this->assertSame( 'payment_pending', $restored['status'] );
		$this->assertArrayNotHasKey( 'pipeline_status', $restored['meta'] );
	}

	public function test_count_cache_key_changes_when_the_generation_changes(): void {
		$first  = SubmissionsRepository::countsCacheKey( array( 4, 2 ), null, 1 );
		$second = SubmissionsRepository::countsCacheKey( array( 2, 4 ), null, 2 );
		$this->assertNotSame( $first, $second );
		$this->assertSame( $first, SubmissionsRepository::countsCacheKey( array( 4, 2 ), null, 1 ) );
	}

	public function test_unread_count_can_be_limited_to_one_form(): void {
		$this->assertSame( array( 'is_read' => 0 ), SubmissionsApi::unreadCountArgs( 0 ) );
		$this->assertSame( array( 'is_read' => 0, 'form_id' => 9 ), SubmissionsApi::unreadCountArgs( 9 ) );
	}

	public function test_resend_is_not_sent_when_every_email_failed_to_queue(): void {
		$failed = SubmissionsApi::resendResult(
			true,
			1,
			array( array( 'action' => 'email', 'reason' => 'async_dispatch_failed' ) )
		);
		$this->assertFalse( $failed['sent'] );
		$this->assertSame( 0, $failed['count'] );

		$mixed = SubmissionsApi::resendResult(
			true,
			2,
			array( array( 'action' => 'email', 'reason' => 'async_dispatch_failed' ) )
		);
		$this->assertTrue( $mixed['sent'] );
		$this->assertSame( 1, $mixed['count'] );
	}

	public function test_delete_behavior_decides_trash_or_permanent_delete(): void {
		$this->assertSame( 'trash', Settings::deletionMode( 'soft', false ) );
		$this->assertSame( 'delete', Settings::deletionMode( 'hard', false ) );
		$this->assertSame( 'delete', Settings::deletionMode( 'soft', true ) );
	}

	public function test_a_queued_webhook_is_labelled_queued(): void {
		$this->assertSame(
			'Queued',
			LogsRepository::webhookMessage(
				array(
					'action_type' => 'webhook',
					'data'        => array( 'dispatched' => true ),
				),
				'Webhook sent'
			)
		);
		$this->assertSame(
			'HTTP 200',
			LogsRepository::webhookMessage(
				array(
					'action_type' => 'webhook',
					'data'        => array( 'dispatched' => true, 'http_status' => 200 ),
				),
				'HTTP 200'
			)
		);
	}

	public function test_submission_import_warns_about_another_form_and_matches_the_same_entry(): void {
		$wrong = TransferService::formMismatch(
			array( 'form' => array( 'id' => 4, 'title' => 'Other' ) ),
			9,
			'This form'
		);
		$this->assertNotSame( '', $wrong );
		$this->assertSame(
			'',
			TransferService::formMismatch(
				array( 'form' => array( 'id' => 9, 'title' => 'This form' ) ),
				9,
				'This form'
			)
		);

		$row = array(
			'created_at' => '2026-10-18 12:00:00',
			'status'     => 'completed',
			'payload'    => array( 'b' => '2', 'a' => '1' ),
		);
		$same            = $row;
		$same['payload'] = array( 'a' => '1', 'b' => '2' );
		$this->assertSame( TransferService::submissionIdentity( $row ), TransferService::submissionIdentity( $same ) );
	}

	public function test_flagging_keeps_the_pipeline_status_in_the_same_write(): void {
		$columns = SubmissionsRepository::statusColumns(
			array( 'status' => 'flagged' ),
			array(
				'status' => 'payment_pending',
				'meta'   => array(),
			)
		);
		$this->assertSame( 'flagged', $columns['status'] );
		$this->assertSame( 'payment_pending', $columns['meta']['pipeline_status'] );
	}

	public function test_a_daylight_saving_change_keeps_the_local_day(): void {
		$zone = new \DateTimeZone( 'America/New_York' );
		$counts = ReportSeries::countByLocalDay(
			array( '2026-11-01 04:30:00' ),
			$zone
		);
		$this->assertSame( array( '2026-11-01' => 1 ), $counts );
	}

	public function test_report_window_uses_the_site_timezone(): void {
		$zone = new \DateTimeZone( '+05:00' );
		$now  = strtotime( '2026-10-18 20:00:00 UTC' );
		$this->assertSame( '2026-10-12 19:00:00', ReportSeries::start( 7, $now, $zone ) );
		$this->assertSame( 18000, ReportSeries::offsetSeconds( $zone, $now ) );
		$this->assertSame( '2026-10-12 00:00:00', ReportSeries::start( 7, strtotime( '2026-10-18 15:00:00 UTC' ) ) );
	}

	public function test_preview_submit_is_admin_only_and_skips_notifications(): void {
		$this->assertSame( 'live', PublicSubmitApi::previewDecision( array(), false ) );
		$this->assertSame( 'forbidden', PublicSubmitApi::previewDecision( array( 'preview' => true ), false ) );
		$this->assertSame( 'preview', PublicSubmitApi::previewDecision( array( 'preview' => true ), true ) );
		$this->assertSame( array( 'save' ), PublicSubmitApi::stepsToRun( array( 'save', 'email', 'webhook' ), true ) );
	}

	public function test_classic_post_reads_the_form_id_and_answers(): void {
		$parsed = PublicSubmitApi::classicSubmission(
			array(
				'subtleforms_classic' => '1',
				'subtleforms_form_id' => '12',
				'data'                => array( 'name' => 'Ada' ),
			)
		);
		$this->assertSame( 12, $parsed['form_id'] );
		$this->assertSame( array( 'name' => 'Ada' ), $parsed['data'] );
	}

	public function test_stored_appearance_ignores_key_order(): void {
		$first  = array(
			'variants' => array( 'width' => 'theme' ),
			'tokens'   => array( 'colorPrimary' => '#112233' ),
			'preset'   => 'theme',
		);
		$second = array(
			'preset'   => 'theme',
			'tokens'   => array( 'colorPrimary' => '#112233' ),
			'variants' => array( 'width' => 'theme' ),
		);
		$a = FormsRepository::prepareStoredSchema(
			array(
				'metadata' => array(
					'type'       => 'regular',
					'appearance' => $first,
				),
				'fields'   => array(),
			)
		);
		$b = FormsRepository::prepareStoredSchema(
			array(
				'metadata' => array(
					'type'       => 'regular',
					'appearance' => $second,
				),
				'fields'   => array(),
			)
		);
		$this->assertSame( wp_json_encode( $a ), wp_json_encode( $b ) );
	}

	public function test_block_uses_the_shortcode_width_class(): void {
		$this->assertContains( 'subtleforms-form-container', SubtleFormsBlock::wrapperClasses() );
		$this->assertContains( 'subtleforms-block', SubtleFormsBlock::wrapperClasses() );
		$css = (string) file_get_contents( dirname( __DIR__, 2 ) . '/resources/frontend/frontend.css' );
		$this->assertStringContainsString( '.wp-block-subtleforms-form', $css );
		$this->assertStringContainsString( 'max-width: none', $css );
	}

	public function test_theme_appearance_prefers_the_theme_button(): void {
		$css   = (string) file_get_contents( dirname( __DIR__, 2 ) . '/resources/frontend/styles/appearance.css' );
		$start = strpos( $css, '.subtleforms.subtleforms--inherit-theme' );
		$block = substr( $css, (int) $start, 1600 );
		$this->assertStringContainsString( '--wp--elements--button--color--background', $block );
		$this->assertStringContainsString( '--subtleforms-radius-button', $block );
		$this->assertStringNotContainsString( '--wp--preset--color--contrast', $block );
		$this->assertStringContainsString( 'width: 100%', $block );
	}
}
