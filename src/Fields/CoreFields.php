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
final class CoreFields
{
    /**
     * Register core fields into the registry.
     *
     * @param FieldRegistry $registry
     * @return void
     */
    public static function register(FieldRegistry $registry): void
    {
        // ===== Basic Fields =====
        
        // Text Field
        $registry->register(new FieldDefinition(
            type: 'text',
            label: __('Text', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-text',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'placeholder' => '',
                'maxLength' => null,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'text', 'name' => 'placeholder', 'label' => __('Placeholder', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'number', 'name' => 'maxLength', 'label' => __('Max Length', 'subtleforms')],
            ]
        ));

        // Email Field - with RFC validation toggle
        $registry->register(new FieldDefinition(
            type: 'email',
            label: __('Email', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-email',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'placeholder' => '',
                'rfcValidation' => true,
                'allowMultiple' => false,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'text', 'name' => 'placeholder', 'label' => __('Placeholder', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'rfcValidation', 'label' => __('RFC Validation', 'subtleforms'), 'help' => __('Use strict RFC 5322 email validation', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'allowMultiple', 'label' => __('Allow Multiple', 'subtleforms'), 'help' => __('Allow comma-separated email addresses', 'subtleforms')],
            ]
        ));

        // Textarea Field - with rows and maxLength
        $registry->register(new FieldDefinition(
            type: 'textarea',
            label: __('Textarea', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-text-page',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'placeholder' => '',
                'rows' => 4,
                'maxLength' => null,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'text', 'name' => 'placeholder', 'label' => __('Placeholder', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'number', 'name' => 'rows', 'label' => __('Rows', 'subtleforms'), 'min' => 2, 'max' => 20],
                ['type' => 'number', 'name' => 'maxLength', 'label' => __('Max Length', 'subtleforms')],
            ]
        ));

        // Number Field - with min/max/step
        $registry->register(new FieldDefinition(
            type: 'number',
            label: __('Number', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-calculator',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'placeholder' => '',
                'min' => null,
                'max' => null,
                'step' => 1,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'text', 'name' => 'placeholder', 'label' => __('Placeholder', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'number', 'name' => 'min', 'label' => __('Minimum Value', 'subtleforms')],
                ['type' => 'number', 'name' => 'max', 'label' => __('Maximum Value', 'subtleforms')],
                ['type' => 'number', 'name' => 'step', 'label' => __('Step', 'subtleforms')],
            ]
        ));

        // Phone Field
        $registry->register(new FieldDefinition(
            type: 'phone',
            label: __('Phone', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-phone',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'placeholder' => '',
                'format' => 'international',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'text', 'name' => 'placeholder', 'label' => __('Placeholder', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'select', 'name' => 'format', 'label' => __('Format', 'subtleforms'), 'options' => [
                    ['value' => 'international', 'label' => __('International', 'subtleforms')],
                    ['value' => 'us', 'label' => __('US', 'subtleforms')],
                    ['value' => 'custom', 'label' => __('Custom', 'subtleforms')],
                ]],
            ]
        ));

        // URL Field
        $registry->register(new FieldDefinition(
            type: 'url',
            label: __('URL', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-admin-links',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'placeholder' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'text', 'name' => 'placeholder', 'label' => __('Placeholder', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
            ]
        ));

        // Password Field - with strength meter and confirmation
        $registry->register(new FieldDefinition(
            type: 'password',
            label: __('Password', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-lock',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'placeholder' => '',
                'minLength' => 8,
                'strengthMeter' => true,
                'requireConfirmation' => false,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'text', 'name' => 'placeholder', 'label' => __('Placeholder', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'number', 'name' => 'minLength', 'label' => __('Minimum Length', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'strengthMeter', 'label' => __('Show Strength Meter', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'requireConfirmation', 'label' => __('Require Confirmation', 'subtleforms')],
            ]
        ));

        // ===== Choice Fields =====
        
        $registry->register(new FieldDefinition(
            type: 'checkbox',
            label: __('Checkbox', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-yes',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'options' => [],
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'options', 'name' => 'options', 'label' => __('Options', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'radio',
            label: __('Radio', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-marker',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'options' => [],
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'options', 'name' => 'options', 'label' => __('Options', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'multiple_choice',
            label: __('Multiple Choice', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-list-view',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'options' => [],
                'allowMultiple' => false,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'options', 'name' => 'options', 'label' => __('Options', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'allowMultiple', 'label' => __('Allow Multiple', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'dropdown',
            label: __('Dropdown', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-arrow-down-alt2',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'placeholder' => 'Select an option',
                'options' => [],
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'text', 'name' => 'placeholder', 'label' => __('Placeholder', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'options', 'name' => 'options', 'label' => __('Options', 'subtleforms')],
            ]
        ));

        // Country Field - with full ISO-3166 country list
        $registry->register(new FieldDefinition(
            type: 'country',
            label: __('Country', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-admin-site',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'placeholder' => 'Select a country',
                'countryList' => CountryList::getOptions(), // Full ISO-3166 list
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'text', 'name' => 'placeholder', 'label' => __('Placeholder', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'chained_select',
            label: __('Chained Select', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-networking',
            kind: 'dynamic',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'source' => 'csv', // or 'manual'
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'select', 'name' => 'source', 'label' => __('Source', 'subtleforms'), 'options' => [
                    ['value' => 'manual', 'label' => __('Manual', 'subtleforms')],
                    ['value' => 'csv', 'label' => __('CSV', 'subtleforms')],
                ]],
            ]
        ));

        // ===== Date & Time Fields =====
        
        $registry->register(new FieldDefinition(
            type: 'date',
            label: __('Date', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-calendar-alt',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'format' => 'Y-m-d',
                'minDate' => null,
                'maxDate' => null,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'text', 'name' => 'format', 'label' => __('Date Format', 'subtleforms')],
                ['type' => 'text', 'name' => 'minDate', 'label' => __('Min Date', 'subtleforms')],
                ['type' => 'text', 'name' => 'maxDate', 'label' => __('Max Date', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'time',
            label: __('Time', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-clock',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'format' => 'H:i',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'text', 'name' => 'format', 'label' => __('Time Format', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'datetime',
            label: __('Date & Time', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-calendar',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'format' => 'Y-m-d H:i',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'text', 'name' => 'format', 'label' => __('DateTime Format', 'subtleforms')],
            ]
        ));

        // ===== Media Fields =====
        
        $registry->register(new FieldDefinition(
            type: 'image_upload',
            label: __('Image Upload', 'subtleforms'),
            category: 'media',
            icon: 'dashicons-format-image',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'maxSize' => 5242880, // 5MB
                'allowedTypes' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'number', 'name' => 'maxSize', 'label' => __('Max Size (bytes)', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'file_upload',
            label: __('File Upload', 'subtleforms'),
            category: 'media',
            icon: 'dashicons-media-document',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'maxSize' => 10485760, // 10MB
                'allowedTypes' => ['application/pdf', 'application/msword', 'text/plain'],
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'number', 'name' => 'maxSize', 'label' => __('Max Size (bytes)', 'subtleforms')],
            ]
        ));

        // ===== Advanced Fields =====
        
        $registry->register(new FieldDefinition(
            type: 'rating',
            label: __('Rating', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-star-filled',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'max' => 5,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'number', 'name' => 'max', 'label' => __('Max Rating', 'subtleforms'), 'min' => 1, 'max' => 10],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'range_slider',
            label: __('Range Slider', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-leftright',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'min' => 0,
                'max' => 100,
                'step' => 1,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'number', 'name' => 'min', 'label' => __('Minimum', 'subtleforms')],
                ['type' => 'number', 'name' => 'max', 'label' => __('Maximum', 'subtleforms')],
                ['type' => 'number', 'name' => 'step', 'label' => __('Step', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'color_picker',
            label: __('Color Picker', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-color-picker',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'default' => '#000000',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'text', 'name' => 'default', 'label' => __('Default Color', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'rich_text',
            label: __('Rich Text Input', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-editor-bold',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'net_promoter_score',
            label: __('Net Promoter Score', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-chart-bar',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'checkbox_grid',
            label: __('Checkbox Grid', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-grid-view',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'rows' => [],
                'columns' => [],
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'dynamic_field',
            label: __('Dynamic Field', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-database',
            kind: 'dynamic',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'source' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'text', 'name' => 'source', 'label' => __('Data Source', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'post_selection',
            label: __('Post Selection', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-admin-post',
            kind: 'dynamic',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'post_type' => 'post',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
                ['type' => 'text', 'name' => 'post_type', 'label' => __('Post Type', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'html',
            label: __('HTML', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-editor-code',
            kind: 'structure',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'content' => '',
            ],
            inspectorControls: [
                ['type' => 'textarea', 'name' => 'content', 'label' => __('HTML Content', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'hidden',
            label: __('Hidden', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-hidden',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'value' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'value', 'label' => __('Value', 'subtleforms')],
            ]
        ));

        // ===== Composite Fields =====
        
        $registry->register(new FieldDefinition(
            type: 'address',
            label: __('Address', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-location',
            kind: 'input',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'subFields' => [
                    ['key' => 'street', 'label' => 'Street Address', 'type' => 'text', 'required' => true],
                    ['key' => 'city', 'label' => 'City', 'type' => 'text', 'required' => true],
                    ['key' => 'state', 'label' => 'State', 'type' => 'text', 'required' => true],
                    ['key' => 'zip', 'label' => 'ZIP Code', 'type' => 'text', 'required' => true],
                ],
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'checkbox', 'name' => 'required', 'label' => __('Required', 'subtleforms')],
            ]
        ));

        // ===== Structural Fields =====
        
        $registry->register(new FieldDefinition(
            type: 'section_break',
            label: __('Section Break', 'subtleforms'),
            category: 'layout',
            icon: 'dashicons-minus',
            kind: 'structure',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'title' => '',
                'description' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'title', 'label' => __('Title', 'subtleforms')],
                ['type' => 'textarea', 'name' => 'description', 'label' => __('Description', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'form_step',
            label: __('Form Step', 'subtleforms'),
            category: 'layout',
            icon: 'dashicons-arrow-right-alt2',
            kind: 'structure',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'title' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'title', 'label' => __('Title', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'repeat_field',
            label: __('Repeat Field', 'subtleforms'),
            category: 'layout',
            icon: 'dashicons-controls-repeat',
            kind: 'structure',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'max' => 5,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'number', 'name' => 'max', 'label' => __('Max Items', 'subtleforms')],
            ]
        ));

        // ===== Layout Containers =====
        
        // Helper function to create column containers
        $createColumnContainer = function($columns) use ($registry) {
            $registry->register(new FieldDefinition(
                type: "{$columns}_column_container",
                label: __("$columns Column" . ($columns > 1 ? 's' : ''), 'subtleforms'),
                category: 'layout',
                icon: 'columns',
                kind: 'structure',
                acceptsChildren: true,
                baseAttributes: [],
                fieldSpecificAttributes: [
                    'columns' => $columns,
                    'spacing' => 16,
                ],
                inspectorControls: [
                    ['type' => 'number', 'name' => 'spacing', 'label' => __('Spacing (px)', 'subtleforms')],
                ]
            ));
        };
        
        // Register all column containers (1-6)
        foreach (['one' => 1, 'two' => 2, 'three' => 3, 'four' => 4, 'five' => 5, 'six' => 6] as $name => $num) {
            $createColumnContainer($name);
        }

        $registry->register(new FieldDefinition(
            type: 'repeat_container',
            label: __('Repeat Container', 'subtleforms'),
            category: 'layout',
            icon: 'controls-repeat',
            kind: 'structure',
            acceptsChildren: true,
            baseAttributes: [],
            fieldSpecificAttributes: [
                'min' => 1,
                'max' => 5,
                'buttonLabel' => __('Add New', 'subtleforms'),
                'spacing' => 16,
            ],
            inspectorControls: [
                ['type' => 'number', 'name' => 'min', 'label' => __('Min Repeats', 'subtleforms')],
                ['type' => 'number', 'name' => 'max', 'label' => __('Max Repeats', 'subtleforms')],
                ['type' => 'text', 'name' => 'buttonLabel', 'label' => __('Button Label', 'subtleforms')],
                ['type' => 'number', 'name' => 'spacing', 'label' => __('Spacing (px)', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'group_container',
            label: __('Group', 'subtleforms'),
            category: 'layout',
            icon: 'category',
            kind: 'structure',
            acceptsChildren: true,
            baseAttributes: [],
            fieldSpecificAttributes: [
                'label' => __('Group', 'subtleforms'),
                'spacing' => 16,
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'label', 'label' => __('Label', 'subtleforms')],
                ['type' => 'number', 'name' => 'spacing', 'label' => __('Spacing (px)', 'subtleforms')],
            ]
        ));

        // ===== Step/Page Container =====
        
        $registry->register(new FieldDefinition(
            type: 'step',
            label: __('Step', 'subtleforms'),
            category: 'structure',
            icon: 'dashicons-media-document',
            kind: 'structure',
            acceptsChildren: true,
            baseAttributes: [],
            fieldSpecificAttributes: [
                'title' => __('Step', 'subtleforms'),
                'description' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'title', 'label' => __('Title', 'subtleforms')],
                ['type' => 'textarea', 'name' => 'description', 'label' => __('Description', 'subtleforms')],
            ]
        ));

        // ===== System Fields =====
        
        $registry->register(new FieldDefinition(
            type: 'recaptcha',
            label: __('reCaptcha', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-shield',
            kind: 'system',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'site_key' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'site_key', 'label' => __('Site Key', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'hcaptcha',
            label: __('hCaptcha', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-shield-alt',
            kind: 'system',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'site_key' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'site_key', 'label' => __('Site Key', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'turnstile',
            label: __('Turnstile', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-lock',
            kind: 'system',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'site_key' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'site_key', 'label' => __('Site Key', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'action_hook',
            label: __('Action Hook', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-admin-plugins',
            kind: 'system',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'hook_name' => '',
            ],
            inspectorControls: [
                ['type' => 'text', 'name' => 'hook_name', 'label' => __('Hook Name', 'subtleforms')],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'save_resume',
            label: __('Save & Resume', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-saved',
            kind: 'system',
            baseAttributes: [],
            fieldSpecificAttributes: [
                'enabled' => true,
            ],
            inspectorControls: [
                ['type' => 'checkbox', 'name' => 'enabled', 'label' => __('Enabled', 'subtleforms')],
            ]
        ));

        // Allow extensions to register additional fields
        do_action('subtleforms/fields/register', $registry);
    }
}
