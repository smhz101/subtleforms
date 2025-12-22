<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Pipeline execution result.
 */
final class PipelineResult
{
    /**
     * @param array<int,array<string,mixed>> $events
     */
    public function __construct(
        public readonly bool $ok,
        public readonly array $events = [],
        public readonly ?string $error = null
    ) {}

    /**
     * Serialize result to array for API responses.
     * @return array<string,mixed>
     */
    public function toArray(): array
    {
        return [
            'ok' => $this->ok,
            'events' => $this->events,
            'error' => $this->error,
        ];
    }
}
