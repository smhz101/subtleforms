<?php
declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

use SubtleForms\Contracts\ActionInterface;
use SubtleForms\Engine\SubmissionContext;

final class WebhookAction implements ActionInterface
{
    public function id(): string { return 'webhook'; }

    public function label(): string { return 'Call webhook'; }

    public function validate(): bool { return true; }

    public function handle(SubmissionContext $context): void
    {
        $settings = $context->getMeta('current_step_settings', []);
        if (!is_array($settings)) {
            $settings = [];
        }

        $url = $settings['url'] ?? null;
        $headers = $settings['headers'] ?? ['content-type' => 'application/json'];
        $body = $settings['body'] ?? wp_json_encode($context->payload);

        if (empty($url) || !is_string($url)) {
            $fail = $context->getMeta('action_failures', []);
            $fail[] = ['action' => 'webhook', 'reason' => 'missing_url'];
            $context->setMeta('action_failures', $fail);
            return;
        }

        $response = wp_remote_post($url, [
            'headers' => $headers,
            'body' => $body,
            'timeout' => 5,
        ]);

        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) >= 400) {
            $fail = $context->getMeta('action_failures', []);
            $fail[] = ['action' => 'webhook', 'reason' => 'request_failed', 'response' => is_wp_error($response) ? $response->get_error_message() : wp_remote_retrieve_response_message($response)];
            $context->setMeta('action_failures', $fail);
        }
    }
}
