<?php


declare(strict_types=1);

namespace SubtleForms\Extensions;

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Webhooks Extension (DEPRECATED — kept for backward compatibility only)
 *
 * This extension has been superseded by the per-form Action System
 * (schema.actions[].type === 'webhook').  It no longer sends HTTP requests.
 *
 * Legacy installations whose form metadata contains
 * metadata.integrations.webhooks.url are handled by a compatibility shim in
 * PublicSubmitApi which injects a virtual webhook action into the pipeline
 * when no schema-level webhook action is already present.
 *
 * @deprecated since 1.9.0 — use Form Actions → Webhook instead.
 * @see \SubtleForms\Engine\Actions\WebhookAction
 * @see \SubtleForms\Api\PublicSubmitApi::injectLegacyWebhookAction()
 */
class WebhooksExtension extends AbstractExtension {

	public function slug(): string {
		return 'webhooks';
	}

	public function label(): string {
		return 'Webhooks';
	}

	public function register(): void {
		if ( ! $this->isEnabled() ) {
			return;
		}

		add_action( 'subtleforms_submission_saved', array( $this, 'dispatch' ), 10, 2 );
	}

	/**
	 * @deprecated HTTP dispatch has been removed; handled by WebhookAction pipeline.
	 */
	public function dispatch( int $form_id, array $submission ): void {
		// Intentionally neutralized. All webhook dispatch is now handled by
		// WebhookAction via the async pipeline.  This stub is kept so any
		// external code that called this method does not throw a fatal error.
		return;
	}
}


