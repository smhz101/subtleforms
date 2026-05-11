<?php
/**
 * SubtleForms Core Field Definitions
 *
 * @package SubtleForms\Fields
 * @since   0.1.0
 */

namespace SubtleForms\Fields;

/**
 * Register all core field definitions with normalized architecture.
 *
 * All fields share common base attributes:
 * - id, key, type, label, required, defaultValue, visibility, validation
 *
 * Field-specific attributes are isolated in fieldSpecificAttributes.
 * Inspector controls are defined per field type.
 */
final class CoreFields {

	/**
	 * Register core fields into the registry.
	 *
	 * @param FieldRegistry $registry
	 * @return void
	 */
	public static function register( FieldRegistry $registry ): void {
		// ===== Basic Fields =====

		// Text Field
		$registry->register(
			new FieldDefinition(
				type: 'text',
				label: __( 'Text', 'subtleforms' ),
				category: 'basic',
				icon: 'dashicons-text',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder' => '',
					'maxLength'   => null,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'maxLength',
						'label' => __( 'Max Length', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Email Field - with RFC validation toggle
		$registry->register(
			new FieldDefinition(
				type: 'email',
				label: __( 'Email', 'subtleforms' ),
				category: 'basic',
				icon: 'dashicons-email',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder'   => '',
					'rfcValidation' => true,
					'allowMultiple' => false,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'rfcValidation',
						'label' => __( 'RFC Validation', 'subtleforms' ),
						'help'  => __( 'Use strict RFC 5322 email validation', 'subtleforms' ),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'allowMultiple',
						'label' => __( 'Allow Multiple', 'subtleforms' ),
						'help'  => __( 'Allow comma-separated email addresses', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Textarea Field - with rows and maxLength
		$registry->register(
			new FieldDefinition(
				type: 'textarea',
				label: __( 'Textarea', 'subtleforms' ),
				category: 'basic',
				icon: 'dashicons-text-page',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder' => '',
					'rows'        => 4,
					'maxLength'   => null,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'rows',
						'label' => __( 'Rows', 'subtleforms' ),
						'min'   => 2,
						'max'   => 20,
					),
					array(
						'type'  => 'number',
						'name'  => 'maxLength',
						'label' => __( 'Max Length', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Number Field - with min/max/step
		$registry->register(
			new FieldDefinition(
				type: 'number',
				label: __( 'Number', 'subtleforms' ),
				category: 'basic',
				icon: 'dashicons-calculator',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder' => '',
					'min'         => null,
					'max'         => null,
					'step'        => 1,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'min',
						'label' => __( 'Minimum Value', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'max',
						'label' => __( 'Maximum Value', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'step',
						'label' => __( 'Step', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Phone Field
		$registry->register(
			new FieldDefinition(
				type: 'phone',
				label: __( 'Phone', 'subtleforms' ),
				category: 'basic',
				icon: 'dashicons-phone',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder' => '',
					'format'      => 'international',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'    => 'select',
						'name'    => 'format',
						'label'   => __( 'Format', 'subtleforms' ),
						'options' => array(
							array(
								'value' => 'international',
								'label' => __( 'International', 'subtleforms' ),
							),
							array(
								'value' => 'us',
								'label' => __( 'US', 'subtleforms' ),
							),
							array(
								'value' => 'custom',
								'label' => __( 'Custom', 'subtleforms' ),
							),
						),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// URL Field
		$registry->register(
			new FieldDefinition(
				type: 'url',
				label: __( 'URL', 'subtleforms' ),
				category: 'basic',
				icon: 'dashicons-admin-links',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder' => '',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Password Field - with strength meter and confirmation
		$registry->register(
			new FieldDefinition(
				type: 'password',
				label: __( 'Password', 'subtleforms' ),
				category: 'basic',
				icon: 'dashicons-lock',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder'         => '',
					'minLength'           => 8,
					'strengthMeter'       => true,
					'requireConfirmation' => false,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'minLength',
						'label' => __( 'Minimum Length', 'subtleforms' ),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'strengthMeter',
						'label' => __( 'Show Strength Meter', 'subtleforms' ),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'requireConfirmation',
						'label' => __( 'Require Confirmation', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// ===== Choice Fields =====

		$registry->register(
			new FieldDefinition(
				type: 'checkbox',
				label: __( 'Checkbox', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-yes',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'options' => array(),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'radio',
				label: __( 'Radio', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-marker',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'options' => array(),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'multiple_choice',
				label: __( 'Multiple Choice', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-list-view',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'options'       => array(),
					'allowMultiple' => false,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'allowMultiple',
						'label' => __( 'Allow Multiple', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'dropdown',
				label: __( 'Dropdown', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-arrow-down-alt2',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder' => 'Select an option',
					'options'     => array(),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// 'select' is the canonical type used by templates (alias of dropdown).
		// Registers inspector controls so the panel shows label/placeholder settings.
		$registry->register(
			new FieldDefinition(
				type: 'select',
				label: __( 'Select', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-arrow-down-alt2',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder' => 'Select an option',
					'options'     => array(),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// 'tel' is the HTML5 input type name for phone fields, used by templates.
		// Registers inspector controls identical to 'phone'.
		$registry->register(
			new FieldDefinition(
				type: 'tel',
				label: __( 'Phone', 'subtleforms' ),
				category: 'basic',
				icon: 'dashicons-phone',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder' => '',
					'format'      => 'international',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'    => 'select',
						'name'    => 'format',
						'label'   => __( 'Format', 'subtleforms' ),
						'options' => array(
							array(
								'value' => 'international',
								'label' => __( 'International', 'subtleforms' ),
							),
							array(
								'value' => 'us',
								'label' => __( 'US', 'subtleforms' ),
							),
							array(
								'value' => 'custom',
								'label' => __( 'Custom', 'subtleforms' ),
							),
						),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Country Field - with full ISO-3166 country list
		$registry->register(
			new FieldDefinition(
				type: 'country',
				label: __( 'Country', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-admin-site',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder'        => 'Select a country',
					'countryList'        => CountryList::getOptions(), // Full ISO-3166 list
					'default_country'    => '',
					'preferred_countries' => array(), // ISO codes for countries to show at top
					'searchable'         => true,
					'output_format'      => 'code', // 'code' or 'name'
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'  => 'select',
						'name'  => 'output_format',
						'label' => __( 'Output Format', 'subtleforms' ),
						'options' => array(
							array( 'value' => 'code', 'label' => __( 'ISO Code (US, GB)', 'subtleforms' ) ),
							array( 'value' => 'name', 'label' => __( 'Country Name', 'subtleforms' ) ),
						),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'searchable',
						'label' => __( 'Enable Search', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'chained_select',
				label: __( 'Chained Select', 'subtleforms' ),
				category: 'choices',
				icon: 'dashicons-networking',
				kind: 'dynamic',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'source' => 'csv', // or 'manual'
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'    => 'select',
						'name'    => 'source',
						'label'   => __( 'Source', 'subtleforms' ),
						'options' => array(
							array(
								'value' => 'manual',
								'label' => __( 'Manual', 'subtleforms' ),
							),
							array(
								'value' => 'csv',
								'label' => __( 'CSV', 'subtleforms' ),
							),
						),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// ===== Date & Time Fields =====

		$registry->register(
			new FieldDefinition(
				type: 'date',
				label: __( 'Date', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-calendar-alt',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'format'  => 'Y-m-d',
					'minDate' => null,
					'maxDate' => null,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'format',
						'label' => __( 'Date Format', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'minDate',
						'label' => __( 'Min Date', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'maxDate',
						'label' => __( 'Max Date', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'time',
				label: __( 'Time', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-clock',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'format' => 'H:i',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'format',
						'label' => __( 'Time Format', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'datetime',
				label: __( 'Date & Time', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-calendar',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'format' => 'Y-m-d H:i',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'format',
						'label' => __( 'DateTime Format', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// ===== Media Fields =====

		$registry->register(
			new FieldDefinition(
				type: 'image_upload',
				label: __( 'Image Upload', 'subtleforms' ),
				category: 'media',
				icon: 'dashicons-format-image',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'maxSize'      => 5242880, // 5MB
					'allowedTypes' => array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp' ),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'maxSize',
						'label' => __( 'Max Size (bytes)', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'file_upload',
				label: __( 'File Upload', 'subtleforms' ),
				category: 'media',
				icon: 'dashicons-media-document',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'maxSize'      => 10485760, // 10MB
					'allowedTypes' => array( 'application/pdf', 'application/msword', 'text/plain' ),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'maxSize',
						'label' => __( 'Max Size (bytes)', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// ===== Advanced Fields =====

		$registry->register(
			new FieldDefinition(
				type: 'rating',
				label: __( 'Rating', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-star-filled',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'max' => 5,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'max',
						'label' => __( 'Max Rating', 'subtleforms' ),
						'min'   => 1,
						'max'   => 10,
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'range_slider',
				label: __( 'Range Slider', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-leftright',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'min'  => 0,
					'max'  => 100,
					'step' => 1,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'min',
						'label' => __( 'Minimum', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'max',
						'label' => __( 'Maximum', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'step',
						'label' => __( 'Step', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'color_picker',
				label: __( 'Color Picker', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-color-picker',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'default' => '#000000',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'default',
						'label' => __( 'Default Color', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'rich_text',
				label: __( 'Rich Text Input', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-editor-bold',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'net_promoter_score',
				label: __( 'Net Promoter Score', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-chart-bar',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'checkbox_grid',
				label: __( 'Checkbox Grid', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-grid-view',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'rows'    => array(),
					'columns' => array(),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'dynamic_field',
				label: __( 'Dynamic Field', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-database',
				kind: 'dynamic',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'source' => '',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'source',
						'label' => __( 'Data Source', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'post_selection',
				label: __( 'Post Selection', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-admin-post',
				kind: 'dynamic',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'post_type' => 'post',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'post_type',
						'label' => __( 'Post Type', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'html',
				label: __( 'HTML', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-editor-code',
				kind: 'structure',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'content' => '',
				),
				inspectorControls: array(
					array(
						'type'  => 'textarea',
						'name'  => 'content',
						'label' => __( 'HTML Content', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'hidden',
				label: __( 'Hidden', 'subtleforms' ),
				category: 'advanced',
				icon: 'dashicons-hidden',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'value' => '',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'value',
						'label' => __( 'Value', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'system' ),
				paletteHidden: true,
			)
		);

		// ===== Composite Fields =====

		// Legacy field removed: replaced by address_group

		// ===== Structural Fields =====

		$registry->register(
			new FieldDefinition(
				type: 'section_break',
				label: __( 'Section Break', 'subtleforms' ),
				category: 'layout',
				icon: 'dashicons-minus',
				kind: 'structure',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'title'       => '',
					'description' => '',
				),
				inspectorControls: array(),
				meta: array( 'category' => 'layout' ),
				layoutControls: array(
					array(
						'type'  => 'text',
						'name'  => 'title',
						'label' => __( 'Title', 'subtleforms' ),
					),
					array(
						'type'  => 'textarea',
						'name'  => 'description',
						'label' => __( 'Description', 'subtleforms' ),
					),
				),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'form_step',
				label: __( 'Form Step', 'subtleforms' ),
				category: 'layout',
				icon: 'dashicons-arrow-right-alt2',
				kind: 'structure',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'title' => '',
				),
				inspectorControls: array(),
				meta: array( 'category' => 'layout' ),
				layoutControls: array(
					array(
						'type'  => 'text',
						'name'  => 'title',
						'label' => __( 'Title', 'subtleforms' ),
					),
				),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'repeat_field',
				label: __( 'Repeat Field', 'subtleforms' ),
				category: 'layout',
				icon: 'dashicons-controls-repeat',
				kind: 'structure',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'max' => 5,
				),
				inspectorControls: array(),
				meta: array( 'category' => 'layout' ),
				layoutControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'max',
						'label' => __( 'Max Items', 'subtleforms' ),
					),
				),
			)
		);

		// ===== Layout Containers =====

		// Helper function to create column containers
		$createColumnContainer = function ( $columns ) use ( $registry ) {
			$registry->register(
				new FieldDefinition(
					type: "{$columns}_column_container",
					label: _n( 'Column', 'Columns', $columns, 'subtleforms' ),
					category: 'layout',
					icon: 'columns',
					kind: 'structure',
					acceptsChildren: true,
					baseAttributes: array(),
					fieldSpecificAttributes: array(
						'columns' => $columns,
						'spacing' => 16,
					),
					inspectorControls: array(),
					meta: array( 'category' => 'layout' ),
					layoutControls: array(
						array(
							'type'  => 'number',
							'name'  => 'spacing',
							'label' => __( 'Spacing (px)', 'subtleforms' ),
						),
					),
				)
			);
		};

		// Register all column containers (1-6)
		foreach ( array(
			'one'   => 1,
			'two'   => 2,
			'three' => 3,
			'four'  => 4,
			'five'  => 5,
			'six'   => 6,
		) as $name => $num ) {
			$createColumnContainer( $name );
		}

		$registry->register(
			new FieldDefinition(
				type: 'repeat_container',
				label: __( 'Repeat Container', 'subtleforms' ),
				category: 'layout',
				icon: 'controls-repeat',
				kind: 'structure',
				acceptsChildren: true,
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'min'         => 1,
					'max'         => 5,
					'buttonLabel' => __( 'Add New', 'subtleforms' ),
					'spacing'     => 16,
				),
				inspectorControls: array(),
				meta: array( 'category' => 'layout' ),
				layoutControls: array(
					array(
						'type'  => 'number',
						'name'  => 'min',
						'label' => __( 'Min Repeats', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'max',
						'label' => __( 'Max Repeats', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'buttonLabel',
						'label' => __( 'Button Label', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'spacing',
						'label' => __( 'Spacing (px)', 'subtleforms' ),
					),
				),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'group_container',
				label: __( 'Group', 'subtleforms' ),
				category: 'layout',
				icon: 'category',
				kind: 'structure',
				acceptsChildren: true,
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'label'   => __( 'Group', 'subtleforms' ),
					'spacing' => 16,
				),
				inspectorControls: array(),
				meta: array( 'category' => 'layout' ),
				layoutControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'spacing',
						'label' => __( 'Spacing (px)', 'subtleforms' ),
					),
				),
			)
		);

		// ===== Step/Page Container =====

		$registry->register(
			new FieldDefinition(
				type: 'step',
				label: __( 'Step', 'subtleforms' ),
				category: 'structure',
				icon: 'dashicons-media-document',
				kind: 'structure',
				acceptsChildren: true,
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'title'       => __( 'Step', 'subtleforms' ),
					'description' => '',
				),
				inspectorControls: array(),
				meta: array( 'category' => 'layout' ),
				layoutControls: array(
					array(
						'type'  => 'text',
						'name'  => 'title',
						'label' => __( 'Title', 'subtleforms' ),
					),
					array(
						'type'  => 'textarea',
						'name'  => 'description',
						'label' => __( 'Description', 'subtleforms' ),
					),
				),
			)
		);

		// ===== Special Fields =====

		// Name Group Field
		$registry->register(
			new FieldDefinition(
				type: 'name_group',
				label: __( 'Name', 'subtleforms' ),
				category: 'special',
				icon: 'dashicons-admin-users',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'fields' => array(
						'first_name'  => array( 'enabled' => true,  'label' => 'First Name',  'placeholder' => '' ),
						'last_name'   => array( 'enabled' => true,  'label' => 'Last Name',   'placeholder' => '' ),
						'middle_name' => array( 'enabled' => false, 'label' => 'Middle Name', 'placeholder' => '' ),
						'suffix'      => array( 'enabled' => false, 'label' => 'Suffix',      'placeholder' => '' ),
					),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'      => 'subfield',
						'name'      => 'fields',
						'subfields' => array(
							array( 'key' => 'first_name',  'label' => __( 'First Name',  'subtleforms' ), 'toggleable' => false ),
							array( 'key' => 'last_name',   'label' => __( 'Last Name',   'subtleforms' ), 'toggleable' => false ),
							array( 'key' => 'middle_name', 'label' => __( 'Middle Name', 'subtleforms' ), 'toggleable' => true ),
							array( 'key' => 'suffix',      'label' => __( 'Suffix',      'subtleforms' ), 'toggleable' => true ),
						),
					),
				),
				meta: array( 'category' => 'composite' ),
			)
		);

		// Address Group Field
		$registry->register(
			new FieldDefinition(
				type: 'address_group',
				label: __( 'Address', 'subtleforms' ),
				category: 'special',
				icon: 'dashicons-location',
				kind: 'input',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'fields' => array(
						'street'  => array( 'enabled' => true,  'label' => 'Street Address',        'placeholder' => '' ),
						'street2' => array( 'enabled' => false, 'label' => 'Street Address Line 2', 'placeholder' => 'Apt, Suite, etc.' ),
						'city'    => array( 'enabled' => true,  'label' => 'City',                  'placeholder' => '' ),
						'state'   => array( 'enabled' => true,  'label' => 'State / Province',      'placeholder' => '' ),
						'postal'  => array( 'enabled' => true,  'label' => 'Postal Code',           'placeholder' => '' ),
						'country' => array( 'enabled' => true,  'label' => 'Country',               'placeholder' => '' ),
					),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'      => 'subfield',
						'name'      => 'fields',
						'subfields' => array(
							array( 'key' => 'street',  'label' => __( 'Street Address',        'subtleforms' ), 'toggleable' => false ),
							array( 'key' => 'street2', 'label' => __( 'Street Address Line 2', 'subtleforms' ), 'toggleable' => true  ),
							array( 'key' => 'city',    'label' => __( 'City',                  'subtleforms' ), 'toggleable' => false ),
							array( 'key' => 'state',   'label' => __( 'State / Province',      'subtleforms' ), 'toggleable' => true  ),
							array( 'key' => 'postal',  'label' => __( 'Postal Code',           'subtleforms' ), 'toggleable' => true  ),
							array( 'key' => 'country', 'label' => __( 'Country',               'subtleforms' ), 'toggleable' => true  ),
						),
					),
				),
				meta: array( 'category' => 'composite' ),
			)
		);

		// ===== System Fields =====

		$registry->register(
			new FieldDefinition(
				type: 'recaptcha',
				label: __( 'reCaptcha', 'subtleforms' ),
				category: 'system',
				icon: 'dashicons-shield',
				kind: 'system',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'site_key' => '',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'site_key',
						'label' => __( 'Site Key', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'system' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'hcaptcha',
				label: __( 'hCaptcha', 'subtleforms' ),
				category: 'system',
				icon: 'dashicons-shield-alt',
				kind: 'system',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'site_key' => '',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'site_key',
						'label' => __( 'Site Key', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'system' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'turnstile',
				label: __( 'Turnstile', 'subtleforms' ),
				category: 'system',
				icon: 'dashicons-lock',
				kind: 'system',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'site_key' => '',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'site_key',
						'label' => __( 'Site Key', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'system' ),
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'action_hook',
				label: __( 'Action Hook', 'subtleforms' ),
				category: 'system',
				icon: 'dashicons-admin-plugins',
				kind: 'system',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'hook_name' => '',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'hook_name',
						'label' => __( 'Hook Name', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'system' ),
				paletteHidden: true,
			)
		);

		$registry->register(
			new FieldDefinition(
				type: 'save_resume',
				label: __( 'Save & Resume', 'subtleforms' ),
				category: 'system',
				icon: 'dashicons-saved',
				kind: 'system',
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'enabled' => true,
				),
				inspectorControls: array(
					array(
						'type'  => 'checkbox',
						'name'  => 'enabled',
						'label' => __( 'Enabled', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'system' ),
			)
		);

		// ===== Payment Fields =====

		// Amount Field - User-defined payment amount
		$registry->register(
			new FieldDefinition(
				type: 'payment_amount',
				label: __( 'Payment Amount', 'subtleforms' ),
				category: 'payment',
				icon: 'dashicons-money-alt',
				kind: 'input',
				requiredCapabilities: array( 'actions.payment' ),
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder'        => '',
					'min'                => 0,
					'max'                => null,
					'step'               => 0.01,
					'currency'           => 'USD',
					'showCurrencySymbol' => true,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'min',
						'label' => __( 'Minimum Amount', 'subtleforms' ),
						'step'  => 0.01,
					),
					array(
						'type'  => 'number',
						'name'  => 'max',
						'label' => __( 'Maximum Amount', 'subtleforms' ),
						'step'  => 0.01,
					),
					array(
						'type'    => 'number',
						'name'    => 'step',
						'label'   => __( 'Step', 'subtleforms' ),
						'step'    => 0.01,
						'default' => 0.01,
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'showCurrencySymbol',
						'label' => __( 'Show Currency Symbol', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Payment Summary - Displays total, items, taxes, etc.
		$registry->register(
			new FieldDefinition(
				type: 'payment_summary',
				label: __( 'Payment Summary', 'subtleforms' ),
				category: 'payment',
				icon: 'dashicons-calculator',
				kind: 'dynamic',
				requiredCapabilities: array( 'actions.payment' ),
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'showSubtotal' => true,
					'showTax'      => false,
					'taxRate'      => 0,
					'showTotal'    => true,
					'currency'     => 'USD',
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'showSubtotal',
						'label' => __( 'Show Subtotal', 'subtleforms' ),
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'showTax',
						'label' => __( 'Show Tax', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'taxRate',
						'label' => __( 'Tax Rate (%)', 'subtleforms' ),
						'step'  => 0.1,
						'min'   => 0,
						'max'   => 100,
					),
					array(
						'type'  => 'checkbox',
						'name'  => 'showTotal',
						'label' => __( 'Show Total', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Coupon Code Field
		$registry->register(
			new FieldDefinition(
				type: 'payment_coupon',
				label: __( 'Coupon Code', 'subtleforms' ),
				category: 'payment',
				icon: 'dashicons-tag',
				kind: 'input',
				requiredCapabilities: array( 'actions.payment' ),
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'placeholder' => __( 'Enter coupon code', 'subtleforms' ),
					'buttonText'  => __( 'Apply', 'subtleforms' ),
					'maxLength'   => 50,
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'placeholder',
						'label' => __( 'Placeholder', 'subtleforms' ),
					),
					array(
						'type'  => 'text',
						'name'  => 'buttonText',
						'label' => __( 'Button Text', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'regular' ),
			)
		);

		// Hidden Price Field - For conditional pricing logic
		$registry->register(
			new FieldDefinition(
				type: 'payment_hidden_price',
				label: __( 'Hidden Price', 'subtleforms' ),
				category: 'payment',
				icon: 'dashicons-hidden',
				kind: 'system',
				requiredCapabilities: array( 'actions.payment' ),
				baseAttributes: array(),
				fieldSpecificAttributes: array(
					'amount'      => 0,
					'description' => '',
					'conditions'  => array(),
				),
				inspectorControls: array(
					array(
						'type'  => 'text',
						'name'  => 'label',
						'label' => __( 'Label', 'subtleforms' ),
						'help'  => __( 'Internal label for reference', 'subtleforms' ),
					),
					array(
						'type'  => 'number',
						'name'  => 'amount',
						'label' => __( 'Amount', 'subtleforms' ),
						'step'  => 0.01,
					),
					array(
						'type'  => 'text',
						'name'  => 'description',
						'label' => __( 'Description', 'subtleforms' ),
						'help'  => __( 'Optional description for debugging', 'subtleforms' ),
					),
				),
				meta: array( 'category' => 'system' ),
			)
		);

		// Allow extensions to register additional fields
		do_action( 'subtleforms/fields/register', $registry );
	}
}
