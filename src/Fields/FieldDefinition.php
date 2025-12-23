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
     * @var string Unique field type identifier
     */
    public $type;
    
    /**
     * @var string Human-readable label
     */
    public $label;
    
    /**
     * @var string Field category (basic, choices, media, advanced)
     */
    public $category;
    
    /**
     * @var string Icon slug or dashicon key
     */
    public $icon;
    
    /**
     * @var string Field kind (input, structure, system, dynamic)
     */
    public $kind;
    
    /**
     * @var bool Whether this field can accept children
     */
    public $acceptsChildren;
    
    /**
     * @var array Default field configuration
     */
    public $defaultConfig;
    
    /**
     * @var array Settings schema definition
     */
    public $settingsSchema;
    
    /**
     * @var array Required capabilities to use this field
     */
    public $requiredCapabilities;

    /**
     * @param string $type Unique field type identifier
     * @param string $label Human-readable label
     * @param string $category Field category (basic, choices, media, advanced)
     * @param string $icon Icon slug or dashicon key
     * @param string $kind Field kind (input, structure, system, dynamic)
     * @param bool $acceptsChildren Whether this field can accept children
     * @param array $defaultConfig Default field configuration
     * @param array $settingsSchema Settings schema definition
     * @param array $requiredCapabilities Required capabilities to use this field
     */
    public function __construct(
        $type,
        $label,
        $category,
        $icon,
        $kind = 'input',
        $acceptsChildren = false,
        $defaultConfig = [],
        $settingsSchema = [],
        $requiredCapabilities = []
    ) {
        $this->type = $type;
        $this->label = $label;
        $this->category = $category;
        $this->icon = $icon;
        $this->kind = $kind;
        $this->acceptsChildren = $acceptsChildren;
        $this->defaultConfig = $defaultConfig;
        $this->settingsSchema = $settingsSchema;
        $this->requiredCapabilities = $requiredCapabilities;
    }

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
