<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

use SubtleForms\Contracts\ActionInterface;

/**
 * Default step implementation.
 */
final class PipelineStep implements PipelineStepInterface
{
    /**
     * @param string[] $requires
     */
    public function __construct(
        private string $id,
        private ActionInterface $action,
        private array $requires = [],
        private bool $skippable = false,
        private array $settings = []
    ) {}

    public function id(): string { return $this->id; }

    public function action(): ActionInterface { return $this->action; }

    public function requires(): array { return $this->requires; }

    public function skippable(): bool { return $this->skippable; }

    public function settings(): array { return $this->settings; }
}
