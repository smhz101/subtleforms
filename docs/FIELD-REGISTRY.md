# Field Definition & Registry System

## Overview

The Field Definition & Registry system provides a formal, extensible architecture for managing field types in SubtleForms. It replaces hardcoded field definitions with a dynamic registry that supports:

- **17 Core Field Types** across 5 categories
- **Capability-gated Premium Fields**
- **Extension Hook** for custom fields
- **REST API Integration** for dynamic UI
- **Settings Schemas** for validation

## Architecture

### Components

1. **FieldDefinition** (`src/Fields/FieldDefinition.php`)

   - Immutable value object representing a field type
   - Properties: `type`, `label`, `category`, `icon`, `defaultConfig`, `settingsSchema`, `requiredCapabilities`

2. **FieldRegistry** (`src/Fields/FieldRegistry.php`)

   - Central registry managing all field definitions
   - Methods: `register()`, `get()`, `all()`, `byCategory()`, `has()`, `toArray()`

3. **CoreFields** (`src/Fields/CoreFields.php`)
   - Static class registering all 17 core field types
   - Fires `subtleforms/fields/register` action for extensions

## Core Field Types

### Basic Fields (6)

- `text` - Single-line text input
- `email` - Email validation input
- `textarea` - Multi-line text input
- `number` - Numeric input
- `phone` - Phone number input
- `url` - URL validation input

### Choice Fields (5)

- `checkbox` - Single checkbox
- `radio` - Radio button group
- `multiple_choice` - Multiple choice checkboxes
- `dropdown` - Dropdown select
- `country` - Country selector

### Date/Time Fields (3)

- `date` - Date picker
- `time` - Time picker
- `datetime` - Combined date & time picker

### Media Fields (2)

- `image_upload` - Image file upload
- `file_upload` - Generic file upload

### Advanced Fields (1)

- `html` - Static HTML content
- `hidden` - Hidden field for data passing

## REST API

### Endpoint: `GET /wp-json/subtleforms/v1/fields`

**Parameters:**

- `grouped` (optional): `true` or `1` to group by category

**Response (grouped=true):**

```json
{
  "basic": [
    {
      "type": "text",
      "label": "Text",
      "category": "basic",
      "icon": "dashicons-text",
      "defaultConfig": {
        "label": "",
        "placeholder": "",
        "required": false,
        "maxLength": null
      },
      "settingsSchema": {
        "label": { "type": "string", "required": true },
        "placeholder": { "type": "string" },
        "required": { "type": "boolean" },
        "maxLength": { "type": "integer" }
      },
      "requiredCapabilities": [],
      "isPremium": false
    }
  ],
  "choices": [...],
  "advanced": [...]
}
```

## Frontend Integration

The Form Builder now dynamically loads field definitions from the API:

```javascript
// FormBuilder.jsx
useEffect(() => {
	apiGet('/fields?grouped=true').then(({ ok, body }) => {
		const groups = {};
		Object.entries(body).forEach(([category, categoryFields]) => {
			groups[category] = categoryFields.map((field) => ({
				type: field.type,
				label: field.label,
				icon: field.icon || '📝',
			}));
		});
		setFieldGroups(groups);
	});
}, []);
```

## Extension Hook

Extensions can register custom fields:

```php
add_action('subtleforms/fields/register', function($registry) {
    $registry->register(new \SubtleForms\Fields\FieldDefinition(
        type: 'signature',
        label: __('Signature', 'my-extension'),
        category: 'advanced',
        icon: 'dashicons-edit',
        defaultConfig: [
            'label' => '',
            'required' => false,
            'strokeColor' => '#000000',
        ],
        settingsSchema: [
            'label' => ['type' => 'string', 'required' => true],
            'required' => ['type' => 'boolean'],
            'strokeColor' => ['type' => 'string'],
        ],
        requiredCapabilities: ['extensions.signature']
    ));
});
```

## Benefits

1. **Extensibility**: Extensions can add custom field types via WordPress action hook
2. **Premium Support**: Fields can require specific capabilities (e.g., `requiredCapabilities: ['premium']`)
3. **Type Safety**: Settings schemas validate field configuration
4. **Dynamic UI**: Frontend automatically renders all registered fields
5. **Consistency**: Single source of truth for field definitions
6. **Documentation**: Each field includes metadata (label, icon, category)

## Container Integration

Field Registry is registered as a singleton in the Container:

```php
// Container.php
$this->singleton(FieldRegistry::class, function() {
    $registry = new FieldRegistry();
    CoreFields::register($registry);

    // Allow extensions to register custom fields
    if (function_exists('do_action')) {
        do_action('subtleforms/fields/register', $registry);
    }

    return $registry;
});
```

Injected into RestController:

```php
$this->singleton(RestController::class, fn($c) => new RestController(
    $c->get(Pipeline::class),
    $c->get(FormsRepository::class),
    $c->get(SubmissionsRepository::class),
    $c->get(FeatureGate::class),
    $c->get(FieldRegistry::class),
    $c->get(SchemaCompiler::class)
));
```

## Testing

1. Navigate to wp-admin → SubtleForms → Forms → Create/Edit Form
2. Open Form Builder
3. Verify all 17 field types appear in Field Dock grouped by category
4. Add various field types to test drag-and-drop functionality
5. Test field configuration in Inspector panel
6. Save schema and verify field definitions persist

## Future Enhancements

- [ ] Field validation rules registry
- [ ] Conditional logic based on field types
- [ ] Custom field renderers for frontend display
- [ ] Field preview in builder
- [ ] Field search/filter in dock
- [ ] Drag-and-drop field reordering from dock
