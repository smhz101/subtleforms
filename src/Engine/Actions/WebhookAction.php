<?php
declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

use SubtleForms\Contracts\ActionInterface;
use SubtleForms\Engine\SubmissionContext;

final class WebhookAction implements ActionInterface {

	public function id(): string {
		return 'webhook'; }

	public function label(): string {
		return 'Call webhook'; }

	public function validate(): bool {
		return true; }

	public function handle( SubmissionContext $context ): void {
		$settings = $context->getMeta( 'current_step_settings', array() );
		if ( ! is_array( $settings ) ) {
			$settings = array();
		}

		$url     = $settings['url'] ?? null;
		$headers = $settings['headers'] ?? array( 'content-type' => 'application/json' );
		$body    = $settings['body'] ?? wp_json_encode( $context->payload );

		if ( empty( $url ) || ! is_string( $url ) ) {
			$fail   = $context->getMeta( 'action_failures', array() );
			$fail[] = array(
				'action' => 'webhook',
				'reason' => 'missing_url',
			);
			$context->setMeta( 'action_failures', $fail );
			return;
		}

		// Dispatch webhook asynchronously - returns immediately
		$submission_id = $context->getMeta( 'submission_id' );
		$dispatched = \SubtleForms\Async\AsyncDispatcher::dispatchWebhook( array(
			'url'           => $url,
			'headers'       => $headers,
			'body'          => $body,
			'timeout'       => 10,
			'submission_id' => $submission_id,
		) );

		if ( ! $dispatched ) {
			// Failed to schedule (rare - only if cron system broken)
			$fail   = $context->getMeta( 'action_failures', array() );
			$fail[] = array(
				'action'   => 'webhook',
				'reason'   => 'async_dispatch_failed',
				'url'      => $url,
			);
			$context->setMeta( 'action_failures', $fail );
		}
	}
}
