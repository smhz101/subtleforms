<?php
declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

use SubtleForms\Contracts\ActionInterface;
use SubtleForms\Engine\SubmissionContext;

final class EmailAction implements ActionInterface
{
    public function id(): string { return 'email'; }

    public function label(): string { return 'Send email'; }

    public function validate(): bool { return true; }

    public function handle(SubmissionContext $context): void
    {
        $settings = $context->getMeta('current_step_settings', []);
        if (!is_array($settings)) {
            $settings = [];
        }

        $to = $settings['to'] ?? null;
        $subject = $settings['subject'] ?? 'Form submission';
        $body = $settings['body'] ?? '';
        $headers = $settings['headers'] ?? [];

        if (empty($to) || !is_string($to)) {
            // Nothing to do; record failure but don't throw to avoid breaking other steps.
            $fail = $context->getMeta('action_failures', []);
            $fail[] = ['action' => 'email', 'reason' => 'missing_recipient'];
            $context->setMeta('action_failures', $fail);
            return;
        }

        // Deterministic content: use payload JSON if body not provided
        if ($body === '') {
            $body = wp_json_encode($context->payload);
        }

        $sent = wp_mail($to, $subject, $body, $headers);
        if ($sent === false) {
            $fail = $context->getMeta('action_failures', []);
            $fail[] = ['action' => 'email', 'reason' => 'wp_mail_failed'];
            $context->setMeta('action_failures', $fail);
        }
    }
}
