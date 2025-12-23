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
     * @var string
     */
    private $id;
    
    /**
     * @var ActionInterface
     */
    private $action;
    
    /**
     * @var string[]
     */
    private $requires;
    
    /**
     * @var bool
     */
    private $skippable;
    
    /**
     * @var array
     */
    private $settings;

    /**
     * @param string $id
     * @param ActionInterface $action
     * @param string[] $requires
     * @param bool $skippable
     * @param array $settings
     */
    public function __construct(
        $id,
        $action,
        $requires = [],
        $skippable = false,
        $settings = []
    ) {
        $this->id = $id;
        $this->action = $action;
        $this->requires = $requires;
        $this->skippable = $skippable;
        $this->settings = $settings;
    }

    public function id(): string { return $this->id; }

    public function action(): ActionInterface { return $this->action; }

    public function requires(): array { return $this->requires; }

    public function skippable(): bool { return $this->skippable; }

    public function settings(): array { return $this->settings; }
}
