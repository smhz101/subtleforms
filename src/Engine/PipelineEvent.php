<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Structured execution event for pipeline steps.
 */
final class PipelineEvent
{
    public function __construct(
        public readonly int $submissionId,
        public readonly ?int $schemaVersion,
        public readonly string $stepId,
        public readonly string $actionType,
        public readonly string $status,
        public readonly ?string $error,
        public readonly int $ts
    ) {}

    public function toArray(): array
    {
        return [
            'submission_id' => $this->submissionId,
            'schema_version' => $this->schemaVersion,
            'step_id' => $this->stepId,
            'action_type' => $this->actionType,
            'status' => $this->status,
            'error' => $this->error,
            'ts' => $this->ts,
        ];
    }
}
