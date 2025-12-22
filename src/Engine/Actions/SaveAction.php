<?php
declare(strict_types=1);

namespace SubtleForms\Engine\Actions;

use SubtleForms\Contracts\ActionInterface;
use SubtleForms\Engine\SubmissionContext;
use SubtleForms\Engine\FieldValidator;
use SubtleForms\Repositories\SubmissionsRepository;

final class SaveAction implements ActionInterface
{
    public function __construct(
        private SubmissionsRepository $subsRepo,
        private ?FieldValidator $validator = null
    ) {
        $this->validator = $validator ?? new FieldValidator();
    }

    public function id(): string { return 'save'; }

    public function label(): string { return 'Save submission'; }

    public function validate(): bool { return true; }

    public function handle(SubmissionContext $context): void
    {
        $submissionId = $context->getMeta('submission_id');
        if (empty($submissionId) || !is_int($submissionId)) {
            throw new \RuntimeException('SaveAction requires a submission_id in context meta.');
        }

        // Validate with conditional logic
        $schema = $context->getMeta('form_schema');
        if (is_array($schema)) {
            $conditionalState = $context->getMeta('conditional_state', [
                'hidden_fields' => [],
                'required_fields' => [],
                'disabled_fields' => [],
                'hidden_steps' => [],
            ]);

            $validation = $this->validator->validate($schema, $context->payload, $conditionalState);
            
            if (!$validation['valid']) {
                $context->setMeta('validation_errors', $validation['errors']);
                throw new \RuntimeException('Validation failed: ' . implode(', ', array_values($validation['errors'])));
            }
        }

        // Persist payload/meta snapshot. Keep deterministic: write exactly what's in context.
        $payload = $context->payload;
        $meta = $context->meta;

        $updated = $this->subsRepo->update($submissionId, [
            'payload' => $payload,
            'meta' => $meta,
            'status' => 'saved',
        ]);

        if ($updated === false) {
            throw new \RuntimeException('Failed to persist submission payload in SaveAction.');
        }
    }
}
