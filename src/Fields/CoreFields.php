<?php
/**
 * SubtleForms Core Field Definitions
 *
 * @package SubtleForms\Fields
 * @since   0.1.0
 */

namespace SubtleForms\Fields;

/**
 * Register all core field definitions.
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
        // Basic Fields
        $registry->register(new FieldDefinition(
            type: 'text',
            label: __('Text', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-text',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'placeholder' => '',
                'required' => false,
                'maxLength' => null,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'placeholder' => ['type' => 'string'],
                'required' => ['type' => 'boolean'],
                'maxLength' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'email',
            label: __('Email', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-email',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'placeholder' => '',
                'required' => false,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'placeholder' => ['type' => 'string'],
                'required' => ['type' => 'boolean'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'textarea',
            label: __('Textarea', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-text-page',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'placeholder' => '',
                'required' => false,
                'rows' => 4,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'placeholder' => ['type' => 'string'],
                'required' => ['type' => 'boolean'],
                'rows' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'number',
            label: __('Number', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-calculator',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'placeholder' => '',
                'required' => false,
                'min' => null,
                'max' => null,
                'step' => 1,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'placeholder' => ['type' => 'string'],
                'required' => ['type' => 'boolean'],
                'min' => ['type' => 'number'],
                'max' => ['type' => 'number'],
                'step' => ['type' => 'number'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'phone',
            label: __('Phone', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-phone',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'placeholder' => '',
                'required' => false,
                'format' => 'international',
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'placeholder' => ['type' => 'string'],
                'required' => ['type' => 'boolean'],
                'format' => ['type' => 'string', 'enum' => ['international', 'us', 'custom']],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'url',
            label: __('URL', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-admin-links',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'placeholder' => '',
                'required' => false,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'placeholder' => ['type' => 'string'],
                'required' => ['type' => 'boolean'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'password',
            label: __('Password', 'subtleforms'),
            category: 'basic',
            icon: 'dashicons-lock',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'placeholder' => '',
                'required' => false,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'placeholder' => ['type' => 'string'],
                'required' => ['type' => 'boolean'],
            ]
        ));

        // Choice Fields
        $registry->register(new FieldDefinition(
            type: 'checkbox',
            label: __('Checkbox', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-yes',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'options' => [],
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'options' => ['type' => 'array', 'items' => ['type' => 'object']],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'radio',
            label: __('Radio', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-marker',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'options' => [],
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'options' => ['type' => 'array', 'items' => ['type' => 'object']],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'multiple_choice',
            label: __('Multiple Choice', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-list-view',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'options' => [],
                'allowMultiple' => false,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'options' => ['type' => 'array', 'items' => ['type' => 'object']],
                'allowMultiple' => ['type' => 'boolean'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'dropdown',
            label: __('Dropdown', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-arrow-down-alt2',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'placeholder' => 'Select an option',
                'required' => false,
                'options' => [],
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'placeholder' => ['type' => 'string'],
                'required' => ['type' => 'boolean'],
                'options' => ['type' => 'array', 'items' => ['type' => 'object']],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'country',
            label: __('Country', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-admin-site',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'placeholder' => 'Select a country',
                'required' => false,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'placeholder' => ['type' => 'string'],
                'required' => ['type' => 'boolean'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'chained_select',
            label: __('Chained Select', 'subtleforms'),
            category: 'choices',
            icon: 'dashicons-networking',
            kind: 'dynamic',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'source' => 'csv', // or 'manual'
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'source' => ['type' => 'string'],
            ]
        ));

        // Date & Time Fields
        $registry->register(new FieldDefinition(
            type: 'date',
            label: __('Date', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-calendar-alt',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'format' => 'Y-m-d',
                'minDate' => null,
                'maxDate' => null,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'format' => ['type' => 'string'],
                'minDate' => ['type' => 'string'],
                'maxDate' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'time',
            label: __('Time', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-clock',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'format' => 'H:i',
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'format' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'datetime',
            label: __('Date & Time', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-calendar',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'format' => 'Y-m-d H:i',
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'format' => ['type' => 'string'],
            ]
        ));

        // Media Fields
        $registry->register(new FieldDefinition(
            type: 'image_upload',
            label: __('Image Upload', 'subtleforms'),
            category: 'media',
            icon: 'dashicons-format-image',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'maxSize' => 5242880, // 5MB
                'allowedTypes' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'maxSize' => ['type' => 'integer'],
                'allowedTypes' => ['type' => 'array', 'items' => ['type' => 'string']],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'file_upload',
            label: __('File Upload', 'subtleforms'),
            category: 'media',
            icon: 'dashicons-media-document',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'maxSize' => 10485760, // 10MB
                'allowedTypes' => ['application/pdf', 'application/msword', 'text/plain'],
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'maxSize' => ['type' => 'integer'],
                'allowedTypes' => ['type' => 'array', 'items' => ['type' => 'string']],
            ]
        ));

        // Advanced Fields
        $registry->register(new FieldDefinition(
            type: 'rating',
            label: __('Rating', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-star-filled',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'max' => 5,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'max' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'range_slider',
            label: __('Range Slider', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-leftright',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'min' => 0,
                'max' => 100,
                'step' => 1,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'min' => ['type' => 'number'],
                'max' => ['type' => 'number'],
                'step' => ['type' => 'number'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'color_picker',
            label: __('Color Picker', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-color-picker',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'default' => '#000000',
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'default' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'rich_text',
            label: __('Rich Text Input', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-editor-bold',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'net_promoter_score',
            label: __('Net Promoter Score', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-chart-bar',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'checkbox_grid',
            label: __('Checkbox Grid', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-grid-view',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'rows' => [],
                'columns' => [],
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'rows' => ['type' => 'array'],
                'columns' => ['type' => 'array'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'dynamic_field',
            label: __('Dynamic Field', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-database',
            kind: 'dynamic',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'source' => '',
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'source' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'post_selection',
            label: __('Post Selection', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-admin-post',
            kind: 'dynamic',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'post_type' => 'post',
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'post_type' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'html',
            label: __('HTML', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-editor-code',
            kind: 'structure',
            defaultConfig: [
                'content' => '',
            ],
            settingsSchema: [
                'content' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'hidden',
            label: __('Hidden', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-hidden',
            kind: 'input',
            defaultConfig: [
                'value' => '',
            ],
            settingsSchema: [
                'value' => ['type' => 'string'],
            ]
        ));

        // Composite Fields
        $registry->register(new FieldDefinition(
            type: 'address',
            label: __('Address', 'subtleforms'),
            category: 'advanced',
            icon: 'dashicons-location',
            kind: 'input',
            defaultConfig: [
                'label' => '',
                'required' => false,
                'subFields' => [
                    ['key' => 'street', 'label' => 'Street Address', 'type' => 'text', 'required' => true],
                    ['key' => 'city', 'label' => 'City', 'type' => 'text', 'required' => true],
                    ['key' => 'state', 'label' => 'State', 'type' => 'text', 'required' => true],
                    ['key' => 'zip', 'label' => 'ZIP Code', 'type' => 'text', 'required' => true],
                ],
            ],
            settingsSchema: [
                'label' => ['type' => 'string', 'required' => true],
                'required' => ['type' => 'boolean'],
                'subFields' => ['type' => 'array'],
            ]
        ));

        // Structural Fields
        $registry->register(new FieldDefinition(
            type: 'section_break',
            label: __('Section Break', 'subtleforms'),
            category: 'layout',
            icon: 'dashicons-minus',
            kind: 'structure',
            defaultConfig: [
                'title' => '',
                'description' => '',
            ],
            settingsSchema: [
                'title' => ['type' => 'string'],
                'description' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'form_step',
            label: __('Form Step', 'subtleforms'),
            category: 'layout',
            icon: 'dashicons-arrow-right-alt2',
            kind: 'structure',
            defaultConfig: [
                'title' => '',
            ],
            settingsSchema: [
                'title' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'repeat_field',
            label: __('Repeat Field', 'subtleforms'),
            category: 'layout',
            icon: 'dashicons-controls-repeat',
            kind: 'structure',
            defaultConfig: [
                'label' => '',
                'max' => 5,
            ],
            settingsSchema: [
                'label' => ['type' => 'string'],
                'max' => ['type' => 'integer'],
            ]
        ));

        // Layout Containers
        $registry->register(new FieldDefinition(
            type: 'one_column_container',
            label: __('1 Column', 'subtleforms'),
            category: 'layout',
            icon: 'columns',
            kind: 'structure',
            acceptsChildren: true,
            defaultConfig: [
                'columns' => 1,
                'spacing' => 16,
            ],
            settingsSchema: [
                'columns' => ['type' => 'integer', 'readOnly' => true],
                'spacing' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'two_column_container',
            label: __('2 Columns', 'subtleforms'),
            category: 'layout',
            icon: 'columns',
            kind: 'structure',
            acceptsChildren: true,
            defaultConfig: [
                'columns' => 2,
                'spacing' => 16,
            ],
            settingsSchema: [
                'columns' => ['type' => 'integer', 'readOnly' => true],
                'spacing' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'three_column_container',
            label: __('3 Columns', 'subtleforms'),
            category: 'layout',
            icon: 'columns',
            kind: 'structure',
            acceptsChildren: true,
            defaultConfig: [
                'columns' => 3,
                'spacing' => 16,
            ],
            settingsSchema: [
                'columns' => ['type' => 'integer', 'readOnly' => true],
                'spacing' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'four_column_container',
            label: __('4 Columns', 'subtleforms'),
            category: 'layout',
            icon: 'columns',
            kind: 'structure',
            acceptsChildren: true,
            defaultConfig: [
                'columns' => 4,
                'spacing' => 16,
            ],
            settingsSchema: [
                'columns' => ['type' => 'integer', 'readOnly' => true],
                'spacing' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'five_column_container',
            label: __('5 Columns', 'subtleforms'),
            category: 'layout',
            icon: 'columns',
            kind: 'structure',
            acceptsChildren: true,
            defaultConfig: [
                'columns' => 5,
                'spacing' => 16,
            ],
            settingsSchema: [
                'columns' => ['type' => 'integer', 'readOnly' => true],
                'spacing' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'six_column_container',
            label: __('6 Columns', 'subtleforms'),
            category: 'layout',
            icon: 'columns',
            kind: 'structure',
            acceptsChildren: true,
            defaultConfig: [
                'columns' => 6,
                'spacing' => 16,
            ],
            settingsSchema: [
                'columns' => ['type' => 'integer', 'readOnly' => true],
                'spacing' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'repeat_container',
            label: __('Repeat Container', 'subtleforms'),
            category: 'layout',
            icon: 'controls-repeat',
            kind: 'structure',
            acceptsChildren: true,
            defaultConfig: [
                'min' => 1,
                'max' => 5,
                'buttonLabel' => __('Add New', 'subtleforms'),
                'spacing' => 16,
            ],
            settingsSchema: [
                'min' => ['type' => 'integer'],
                'max' => ['type' => 'integer'],
                'buttonLabel' => ['type' => 'string'],
                'spacing' => ['type' => 'integer'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'group_container',
            label: __('Group', 'subtleforms'),
            category: 'layout',
            icon: 'category',
            kind: 'structure',
            acceptsChildren: true,
            defaultConfig: [
                'label' => __('Group', 'subtleforms'),
                'spacing' => 16,
            ],
            settingsSchema: [
                'label' => ['type' => 'string'],
                'spacing' => ['type' => 'integer'],
            ]
        ));

        // Step/Page Container
        $registry->register(new FieldDefinition(
            type: 'step',
            label: __('Step', 'subtleforms'),
            category: 'structure',
            icon: 'dashicons-media-document',
            kind: 'structure',
            acceptsChildren: true,
            defaultConfig: [
                'title' => __('Step', 'subtleforms'),
                'description' => '',
            ],
            settingsSchema: [
                'title' => ['type' => 'string', 'required' => true],
                'description' => ['type' => 'string'],
            ]
        ));

        // System Fields
        $registry->register(new FieldDefinition(
            type: 'recaptcha',
            label: __('reCaptcha', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-shield',
            kind: 'system',
            defaultConfig: [
                'site_key' => '',
            ],
            settingsSchema: [
                'site_key' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'hcaptcha',
            label: __('hCaptcha', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-shield-alt',
            kind: 'system',
            defaultConfig: [
                'site_key' => '',
            ],
            settingsSchema: [
                'site_key' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'turnstile',
            label: __('Turnstile', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-lock',
            kind: 'system',
            defaultConfig: [
                'site_key' => '',
            ],
            settingsSchema: [
                'site_key' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'action_hook',
            label: __('Action Hook', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-admin-plugins',
            kind: 'system',
            defaultConfig: [
                'hook_name' => '',
            ],
            settingsSchema: [
                'hook_name' => ['type' => 'string'],
            ]
        ));

        $registry->register(new FieldDefinition(
            type: 'save_resume',
            label: __('Save & Resume', 'subtleforms'),
            category: 'system',
            icon: 'dashicons-saved',
            kind: 'system',
            defaultConfig: [
                'enabled' => true,
            ],
            settingsSchema: [
                'enabled' => ['type' => 'boolean'],
            ]
        ));

        // Allow extensions to register additional fields
        do_action('subtleforms/fields/register', $registry);
    }
}
