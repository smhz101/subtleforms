<?php
/**
 * SubtleForms
 *
 * @package   SubtleForms
 * @version   0.1.0
 */

namespace SubtleForms\Engine;

use SubtleForms\Contracts\ActionInterface;

/**
 * A pipeline step wraps an Action + metadata like required capabilities.
 */
interface PipelineStepInterface
{
    public function id(): string;

    public function action(): ActionInterface;

    /**
     * @return string[] capabilities required to execute this step
     */
    public function requires(): array;

    /**
     * If true, this step may be skipped when gated (only if you want "soft gating").
     * Usually false for critical steps.
     */
    public function skippable(): bool;

    /**
     * @return array settings for this step instance (from schema)
     */
    public function settings(): array;
}
