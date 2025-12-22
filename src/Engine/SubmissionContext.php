<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Runtime context for a single submission execution.
 * Keep it immutable-ish: store input + derived state + execution metadata.
 */
final class SubmissionContext
{
    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $meta
     */
    public function __construct(
        public readonly int $formId,
        public readonly array $payload,
        public array $meta = []
    ) {}

    public function setMeta(string $key, mixed $value): void
    {
        $this->meta[$key] = $value;
    }

    public function getMeta(string $key, mixed $default = null): mixed
    {
        return $this->meta[$key] ?? $default;
    }
}
