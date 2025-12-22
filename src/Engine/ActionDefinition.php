<?php
declare(strict_types=1);

namespace SubtleForms\Engine;

/**
 * Describes an Action type: metadata, capability requirements and settings schema.
 */
final class ActionDefinition
{
    /**
     * @param string $type unique action type identifier
     * @param string $label human readable label
     * @param string|null $description optional description
     * @param string[] $requiredCapabilities capabilities required to execute this action type
     * @param array $settingsSchema permissive settings schema for UI/validation
     */
    public function __construct(
        private string $type,
        private string $label,
        private ?string $description = null,
        private array $requiredCapabilities = [],
        private array $settingsSchema = []
    ) {}

    public function type(): string { return $this->type; }
    public function label(): string { return $this->label; }
    public function description(): ?string { return $this->description; }

    /**
     * @return string[] capability strings
     */
    public function requiredCapabilities(): array { return $this->requiredCapabilities; }

    /**
     * Permissive settings schema usable by UI or validators.
     * @return array
     */
    public function settingsSchema(): array { return $this->settingsSchema; }

    /**
     * Export to array.
     * @return array
     */
    public function toArray(): array
    {
        return [
            'type' => $this->type,
            'label' => $this->label,
            'description' => $this->description,
            'required_capabilities' => $this->requiredCapabilities,
            'settings_schema' => $this->settingsSchema,
        ];
    }
}
