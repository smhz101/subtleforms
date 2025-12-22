# Core Field Type Reference

Complete reference of all 17 core field types available in SubtleForms.

## Basic Fields

### Text

**Type:** `text`  
**Category:** basic  
**Icon:** dashicons-text

Single-line text input field.

**Default Config:**

```php
[
    'label' => '',
    'placeholder' => '',
    'required' => false,
    'maxLength' => null,
]
```

**Settings Schema:**

- `label` (string, required)
- `placeholder` (string)
- `required` (boolean)
- `maxLength` (integer)

---

### Email

**Type:** `email`  
**Category:** basic  
**Icon:** dashicons-email

Email address input with validation.

**Default Config:**

```php
[
    'label' => '',
    'placeholder' => '',
    'required' => false,
]
```

**Settings Schema:**

- `label` (string, required)
- `placeholder` (string)
- `required` (boolean)

---

### Textarea

**Type:** `textarea`  
**Category:** basic  
**Icon:** dashicons-text-page

Multi-line text input field.

**Default Config:**

```php
[
    'label' => '',
    'placeholder' => '',
    'required' => false,
    'rows' => 4,
]
```

**Settings Schema:**

- `label` (string, required)
- `placeholder` (string)
- `required` (boolean)
- `rows` (integer)

---

### Number

**Type:** `number`  
**Category:** basic  
**Icon:** dashicons-calculator

Numeric input field.

**Default Config:**

```php
[
    'label' => '',
    'placeholder' => '',
    'required' => false,
    'min' => null,
    'max' => null,
    'step' => 1,
]
```

**Settings Schema:**

- `label` (string, required)
- `placeholder` (string)
- `required` (boolean)
- `min` (number)
- `max` (number)
- `step` (number)

---

### Phone

**Type:** `phone`  
**Category:** basic  
**Icon:** dashicons-phone

Phone number input field.

**Default Config:**

```php
[
    'label' => '',
    'placeholder' => '',
    'required' => false,
]
```

**Settings Schema:**

- `label` (string, required)
- `placeholder` (string)
- `required` (boolean)

---

### URL

**Type:** `url`  
**Category:** basic  
**Icon:** dashicons-admin-links

URL input with validation.

**Default Config:**

```php
[
    'label' => '',
    'placeholder' => '',
    'required' => false,
]
```

**Settings Schema:**

- `label` (string, required)
- `placeholder` (string)
- `required` (boolean)

---

## Choice Fields

### Checkbox

**Type:** `checkbox`  
**Category:** choices  
**Icon:** dashicons-yes-alt

Single checkbox for yes/no or on/off values.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)

---

### Radio

**Type:** `radio`  
**Category:** choices  
**Icon:** dashicons-marker

Radio button group - single selection from multiple options.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
    'options' => [],
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)
- `options` (array, required)

---

### Multiple Choice

**Type:** `multiple_choice`  
**Category:** choices  
**Icon:** dashicons-list-view

Checkbox group - multiple selections from options.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
    'options' => [],
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)
- `options` (array, required)

---

### Dropdown

**Type:** `dropdown`  
**Category:** choices  
**Icon:** dashicons-arrow-down-alt2

Dropdown select - single selection from options.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
    'options' => [],
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)
- `options` (array, required)

---

### Country

**Type:** `country`  
**Category:** choices  
**Icon:** dashicons-admin-site

Country selector with standardized country list.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)

---

## Date/Time Fields

### Date

**Type:** `date`  
**Category:** advanced  
**Icon:** dashicons-calendar-alt

Date picker field.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
    'format' => 'Y-m-d',
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)
- `format` (string)

---

### Time

**Type:** `time`  
**Category:** advanced  
**Icon:** dashicons-clock

Time picker field.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
    'format' => 'H:i',
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)
- `format` (string)

---

### DateTime

**Type:** `datetime`  
**Category:** advanced  
**Icon:** dashicons-calendar

Combined date and time picker.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
    'format' => 'Y-m-d H:i',
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)
- `format` (string)

---

## Media Fields

### Image Upload

**Type:** `image_upload`  
**Category:** media  
**Icon:** dashicons-format-image

Image file upload with preview.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
    'maxSize' => 5242880, // 5MB
    'allowedTypes' => ['image/jpeg', 'image/png', 'image/gif'],
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)
- `maxSize` (integer)
- `allowedTypes` (array)

---

### File Upload

**Type:** `file_upload`  
**Category:** media  
**Icon:** dashicons-upload

Generic file upload field.

**Default Config:**

```php
[
    'label' => '',
    'required' => false,
    'maxSize' => 10485760, // 10MB
    'allowedTypes' => [],
]
```

**Settings Schema:**

- `label` (string, required)
- `required` (boolean)
- `maxSize` (integer)
- `allowedTypes` (array)

---

## Advanced Fields

### HTML

**Type:** `html`  
**Category:** advanced  
**Icon:** dashicons-editor-code

Static HTML content block (non-input).

**Default Config:**

```php
[
    'content' => '',
]
```

**Settings Schema:**

- `content` (string, required)

---

### Hidden

**Type:** `hidden`  
**Category:** advanced  
**Icon:** dashicons-hidden

Hidden field for passing data.

**Default Config:**

```php
[
    'value' => '',
]
```

**Settings Schema:**

- `value` (string)

---

## Usage Example

```php
// Get a field definition
$fieldRegistry = $container->get(FieldRegistry::class);
$textField = $fieldRegistry->get('text');

// Access field properties
echo $textField->label; // "Text"
echo $textField->category; // "basic"
echo $textField->icon; // "dashicons-text"

// Get default config for new field
$defaultConfig = $textField->defaultConfig;

// Validate field settings
$settingsSchema = $textField->settingsSchema;
```

## Adding Custom Fields

```php
add_action('subtleforms/fields/register', function($registry) {
    $registry->register(new \SubtleForms\Fields\FieldDefinition(
        type: 'rating',
        label: __('Star Rating', 'my-plugin'),
        category: 'advanced',
        icon: 'dashicons-star-filled',
        defaultConfig: [
            'label' => '',
            'required' => false,
            'maxStars' => 5,
        ],
        settingsSchema: [
            'label' => ['type' => 'string', 'required' => true],
            'required' => ['type' => 'boolean'],
            'maxStars' => ['type' => 'integer', 'min' => 1, 'max' => 10],
        ],
        requiredCapabilities: ['premium']
    ));
});
```
