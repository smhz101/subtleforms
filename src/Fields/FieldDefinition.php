<?php
/**
 * SubtleForms Field Definition
 *
 * @package SubtleForms\Fields
 * @since   0.1.0
 */

namespace SubtleForms\Fields;

/**
 * Immutable field definition value object.
 */
final class FieldDefinition
{
    /**
     * @param string $type Unique field type identifier
     * @param string $label Human-readable label
     * @param string $category Field category (basic, choices, media, advanced)
     * @param string $icon Icon slug or dashicon key
     * @param string $kind Field kind (input, structure, system, dynamic)
     * @param array $defaultConfig Default field configuration
     * @param array $settingsSchema Settings schema definition
     * @param array $requiredCapabilities Required capabilities to use this field
     */
    public function __construct(
        public readonly string $type,
        public readonly string $label,
        public readonly string $category,
        public readonly string $icon,
        public readonly string $kind = 'input',
        public readonly bool $acceptsChildren = false,
        public readonly array $defaultConfig = [],
        public readonly array $settingsSchema = [],
        public readonly array $requiredCapabilities = []
    ) {}

    /**
     * Convert to array representation.
     *
     * @return array
     */
    public function toArray(): array
    {
        return [
            'type' => $this->type,
            'label' => $this->label,
            'category' => $this->category,
            'icon' => $this->icon,
            'kind' => $this->kind,
            'acceptsChildren' => $this->acceptsChildren,
            'defaultConfig' => $this->defaultConfig,
            'settingsSchema' => $this->settingsSchema,
            'requiredCapabilities' => $this->requiredCapabilities,
        ];
    }

    /**
     * Check if this field requires any premium capabilities.
     *
     * @return bool
     */
    public function isPremium(): bool
    {
        return !empty($this->requiredCapabilities);
    }
}
