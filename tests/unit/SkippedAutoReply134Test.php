<?php
// phpcs:disable -- Unit test file; not shipped in production plugin.
/**
 * An email that is not sent because its audience is switched off in
 * Settings, Email is logged as Skipped with the reason, never Succeeded (#134).
 *
 * @package SubtleForms\Tests\Unit
 */

namespace SubtleForms\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SubtleForms\Engine\Actions\EmailAction;
use SubtleForms\Engine\Pipeline;
use SubtleForms\Engine\PipelineStep;
use SubtleForms\Engine\SubmissionContext;

final class SkippedAutoReply134Test extends TestCase {

	protected function tearDown(): void {
		unset( $GLOBALS['sf_test_options'] );
		parent::tearDown();
	}

	/** Run one email step through the pipeline and return the logged events. */
	private function run_step( array $global, string $to, ?array &$meta = null ): array {
		$GLOBALS['sf_test_options'] = array( 'subtleforms_settings' => $global );
		$logs = new class() {
			public $rows = array();
			public function create( array $row ) {
				$this->rows[] = $row['context'];
				return 1;
			}
		};
		$step = new PipelineStep( 'email-1', new EmailAction(), array(), false, array( 'to' => $to, 'subject' => 'Hi' ) );
		$ctx  = new SubmissionContext( 7, array( 'email' => 'visitor@example.com' ), array( 'submission_id' => 99 ) );
		$ctx->setMeta( 'form_schema', array( 'fields' => array( array( 'key' => 'email', 'type' => 'email' ) ) ) );
		( new Pipeline( null, $logs ) )->run( array( $step ), $ctx );
		$meta = $ctx->meta;
		return $logs->rows;
	}

	private function statuses( array $rows ): array {
		return array_column( $rows, 'status' );
	}

	public function test_submitter_email_off_logs_skipped_with_the_reason(): void {
		$rows = $this->run_step( array( 'user_confirmation_enabled' => false ), '{email}' );

		$this->assertSame( array( 'started', 'skipped' ), $this->statuses( $rows ) );
		$this->assertNotContains( 'succeeded', $this->statuses( $rows ) );
		$this->assertSame( 'Submitter emails are turned off in Settings, Email.', $rows[1]['error'] );
	}

	public function test_admin_email_off_logs_skipped_with_the_reason(): void {
		$rows = $this->run_step( array( 'admin_notification_enabled' => false ), 'owner@example.com' );

		$this->assertSame( array( 'started', 'skipped' ), $this->statuses( $rows ) );
		$this->assertSame( 'Admin notifications are turned off in Settings, Email.', $rows[1]['error'] );
	}

	public function test_the_skip_is_consumed_so_it_is_not_logged_twice(): void {
		$meta = null;
		$this->run_step( array(), '{email}', $meta );
		$this->assertSame( array(), $meta['action_skips'] );
	}

	public function test_a_failure_wins_over_a_skip(): void {
		$GLOBALS['sf_test_options'] = array();
		$action = new class() implements \SubtleForms\Contracts\ActionInterface {
			public function id(): string { return 'email'; }
			public function label(): string { return 'x'; }
			public function validate(): bool { return true; }
			public function handle( SubmissionContext $context ): void {
				$context->setMeta( 'action_skips', array( array( 'action' => 'email', 'reason' => 'r', 'message' => 'm' ) ) );
				$context->setMeta( 'action_failures', array( array( 'action' => 'email', 'reason' => 'boom' ) ) );
			}
		};
		$logs = new class() {
			public $rows = array();
			public function create( array $row ) { $this->rows[] = $row['context']; return 1; }
		};
		$ctx = new SubmissionContext( 7, array(), array( 'submission_id' => 99 ) );
		( new Pipeline( null, $logs ) )->run( array( new PipelineStep( 's', $action ) ), $ctx );

		$this->assertSame( array( 'started', 'failed' ), array_column( $logs->rows, 'status' ) );
	}
}
