<?php
/**
 * Writes email marketing results to the entry's activity log.
 *
 * @package SubtleForms\Integrations\EmailMarketing
 * @since   2.8.0
 */

declare(strict_types=1);

namespace SubtleForms\Integrations\EmailMarketing;

use SubtleForms\Repositories\LogsRepository;
use SubtleForms\Support\Logger;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Rows use the same context shape as the pipeline steps (step_id,
 * action_type, status, data), so they show on the entry screen next to the
 * email and webhook steps.
 */
final class ActivityLog {

	/**
	 * Record an outcome.
	 *
	 * @param int    $submissionId Entry ID.
	 * @param string $service      Service slug (mailchimp, brevo, kit).
	 * @param string $stepId       The service slug, or `<slug>:<feed id>`.
	 * @param string $status       succeeded, skipped or failed.
	 * @param string $message      The line shown on the entry ("Mailchimp: subscribed").
	 * @param array  $data         Details (no secrets).
	 */
	public static function record( int $submissionId, string $service, string $stepId, string $status, string $message, array $data = array() ): void {
		if ( $submissionId <= 0 ) {
			return;
		}
		$failed = 'failed' === $status;
		$data   = array_merge( array( 'summary' => $message ), $data );
		try {
			( new LogsRepository() )->create(
				array(
					'submission_id' => $submissionId,
					'level'         => $failed ? 'error' : ( 'skipped' === $status ? 'warning' : 'info' ),
					'message'       => $message,
					'context'       => array(
						'submission_id' => $submissionId,
						'step_id'       => $stepId,
						'action_type'   => $service,
						'status'        => $status,
						'data'          => $data,
						'error'         => $failed ? (string) ( $data['error'] ?? '' ) : null,
						'ts'            => time(),
					),
				)
			);
		} catch ( \Throwable $e ) {
			Logger::error( 'Could not write the %s line for entry %d: %s', $service, $submissionId, $e->getMessage() );
		}
	}
}
