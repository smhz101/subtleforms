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
 *
 * Normalized field architecture with common base attributes and field-specific config.
 */
final class FieldDefinition {

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
	 * @var array Common base attributes (all fields)
	 * - id: Unique field instance ID (generated)
	 * - key: Field key for data mapping
	 * - type: Field type identifier
	 * - label: Field label
	 * - required: Whether field is required
	 * - defaultValue: Default field value
	 * - visibility: Conditional visibility rules
	 * - validation: Base validation rules
	 */
	public $baseAttributes;

	/**
	 * @var array Field-specific attributes configuration
	 * This defines the unique attributes for each field type:
	 * - country: countryList (ISO-3166 countries)
	 * - password: minLength, strengthMeter, requireConfirmation
	 * - email: rfcValidation, allowMultiple
	 * - number: min, max, step
	 * - textarea: rows, maxLength
	 * - etc.
	 */
	public $fieldSpecificAttributes;

	/**
	 * @var array Inspector controls configuration
	 * Defines which controls to render in the field inspector:
	 * [
	 *   ['type' => 'text', 'name' => 'placeholder', 'label' => 'Placeholder'],
	 *   ['type' => 'number', 'name' => 'min', 'label' => 'Minimum Value'],
	 * ]
	 */
	public $inspectorControls;

	/**
	 * @var array Required capabilities to use this field
	 */
	public $requiredCapabilities;

	/**
	 * @var array Field meta information — routing and categorisation
	 * ['category' => 'regular|composite|layout|system']
	 */
	public $meta;

	/**
	 * @var array Inspector controls for layout/container fields.
	 * Uses the same control schema as inspectorControls.
	 * Rendered instead of inspectorControls when meta.category === 'layout'.
	 */
	public $layoutControls;

	/**
	 * @var bool Whether this field is hidden from the builder field palette.
	 * Set to true for internal/system-only fields that should not be user-addable.
	 */
	public $paletteHidden;

	/**
	 * @param string $type Unique field type identifier
	 * @param string $label Human-readable label
	 * @param string $category Field category (basic, choices, media, advanced)
	 * @param string $icon Icon slug or dashicon key
	 * @param string $kind Field kind (input, structure, system, dynamic)
	 * @param bool   $acceptsChildren Whether this field can accept children
	 * @param array  $baseAttributes Common attributes for all fields
	 * @param array  $fieldSpecificAttributes Field-type specific config
	 * @param array  $inspectorControls Inspector UI controls configuration
	 * @param array  $requiredCapabilities Required capabilities to use this field
	 * @param array  $meta Field meta (category: regular|composite|layout|system)
	 * @param array  $layoutControls Inspector controls for layout/container fields
	 * @param bool   $paletteHidden Whether to hide this field from the builder palette
	 */
	public function __construct(
		$type,
		$label,
		$category,
		$icon,
		$kind = 'input',
		$acceptsChildren = false,
		$baseAttributes = array(),
		$fieldSpecificAttributes = array(),
		$inspectorControls = array(),
		$requiredCapabilities = array(),
		$meta = array(),
		$layoutControls = array(),
		$paletteHidden = false
	) {
		$this->type            = $type;
		$this->label           = $label;
		$this->category        = $category;
		$this->icon            = $icon;
		$this->kind            = $kind;
		$this->acceptsChildren = $acceptsChildren;

		// Merge with default base attributes
		$this->baseAttributes = array_merge(
			array(
				'id'           => null, // Generated at runtime
				'key'          => null, // Generated at runtime
				'type'         => $type,
				'label'        => '',
				'required'     => false,
				'defaultValue' => null,
				'visibility'   => null,
				'validation'   => array(),
			),
			$baseAttributes
		);

		$this->fieldSpecificAttributes = $fieldSpecificAttributes;
		$this->inspectorControls       = $inspectorControls;
		$this->requiredCapabilities    = $requiredCapabilities;
		$this->meta                    = array_merge( array( 'category' => 'regular' ), $meta );
		$this->layoutControls          = $layoutControls;
		$this->paletteHidden           = $paletteHidden;
	}

	/**
	 * Convert to array representation.
	 *
	 * @return array
	 */
	public function toArray(): array {
		return array(
			'type'                    => $this->type,
			'label'                   => $this->label,
			'category'                => $this->category,
			'icon'                    => $this->icon,
			'kind'                    => $this->kind,
			'acceptsChildren'         => $this->acceptsChildren,
			'baseAttributes'          => $this->baseAttributes,
			'fieldSpecificAttributes' => $this->fieldSpecificAttributes,
			'inspectorControls'       => $this->inspectorControls,
			'requiredCapabilities'    => $this->requiredCapabilities,
			'meta'                    => $this->meta,
			'layoutControls'          => $this->layoutControls,
			'paletteHidden'           => $this->paletteHidden,
		);
	}

	/**
	 * Get default configuration for field instance creation.
	 * Merges base attributes with field-specific defaults.
	 *
	 * @return array
	 */
	public function getDefaultConfig(): array {
		return array_merge(
			$this->baseAttributes,
			$this->fieldSpecificAttributes
		);
	}

	/**
	 * Check if this field requires any premium capabilities.
	 *
	 * @return bool
	 */
	public function isPremium(): bool {
		return ! empty( $this->requiredCapabilities );
	}
}
