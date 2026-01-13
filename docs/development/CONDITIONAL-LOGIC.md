# Conditional Logic System

## Overview

SubtleForms now includes a powerful conditional logic engine that enables dynamic form behaviors based on user input. Fields and steps can be shown, hidden, required, or disabled based on conditions evaluated against submission data.

## Architecture

### Core Components

#### ConditionalLogic (`src/Engine/ConditionalLogic.php`)

Evaluates conditional rules against submission payload.

**Supported Operators:**

- `equals` - Exact match (type-safe)
- `not_equals` - Not equal to
- `contains` - String/array contains
- `not_contains` - Does not contain
- `empty` - Is null/empty string/empty array
- `not_empty` - Has value
- `greater_than` - Numeric comparison
- `less_than` - Numeric comparison
- `in` - Value in array
- `not_in` - Value not in array

**Effects:**

- `show` - Display field/step (default visible)
- `hide` - Hide field/step
- `require` - Make field required
- `disable` - Disable field input

**Output:**

```php
[
    'hidden_fields' => ['email', 'phone'],
    'required_fields' => ['company_name'],
    'disabled_fields' => ['country'],
    'hidden_steps' => ['step_payment']
]
```

#### FieldValidator (`src/Engine/FieldValidator.php`)

Validates submission with conditional state.

**Features:**

- Skips validation for hidden fields
- Enforces conditionally required fields
- Type validation (email, url, number, phone)
- Recursive field traversal (containers, steps)

**Validation Result:**

```php
[
    'valid' => false,
    'errors' => [
        'email' => 'Invalid email address.',
        'company_name' => 'Field "company_name" is required.'
    ]
]
```

#### SchemaCompiler Enhancement

Now evaluates conditions and attaches metadata to `SubmissionContext`:

```php
public function evaluateConditions(array $schema, SubmissionContext $ctx): void
{
    $conditionalState = $this->conditionalLogic->evaluate($schema, $ctx->payload);

    $ctx->setMeta('conditional_state', $conditionalState);
    $ctx->setMeta('hidden_fields', $conditionalState['hidden_fields']);
    $ctx->setMeta('required_fields', $conditionalState['required_fields']);
    $ctx->setMeta('disabled_fields', $conditionalState['disabled_fields']);
    $ctx->setMeta('hidden_steps', $conditionalState['hidden_steps']);
}
```

#### Pipeline Integration

Pipeline now:

1. Evaluates conditions before running actions
2. Passes schema to `run()` method
3. Attaches conditional state to context

```php
public function run(array $steps, SubmissionContext $ctx, ?array $schema = null): PipelineResult
{
    if ($schema && $this->compiler) {
        $this->compiler->evaluateConditions($schema, $ctx);
    }
    // ... execute steps
}
```

#### SaveAction Enhancement

Validates with conditional logic before persisting:

```php
$validation = $this->validator->validate($schema, $context->payload, $conditionalState);

if (!$validation['valid']) {
    $context->setMeta('validation_errors', $validation['errors']);
    throw new \RuntimeException('Validation failed: ' . implode(', ', array_values($validation['errors'])));
}
```

### Schema Structure

#### Field-Level Conditions

Conditions are stored in `field.config.conditions`:

```json
{
	"type": "text",
	"key": "company_name",
	"config": {
		"label": "Company Name",
		"conditions": [
			{
				"sourceField": "employment_status",
				"operator": "equals",
				"value": "employed",
				"effect": "require"
			}
		]
	}
}
```

#### Global Logic Rules

Schema-level rules in `schema.logic`:

```json
{
	"logic": [
		{
			"if": {
				"field": "age",
				"operator": "greater_than",
				"value": "18"
			},
			"then": {
				"action": "show",
				"target": "consent_checkbox"
			}
		}
	]
}
```

### Admin UI

#### ConditionEditor Component

**Location:** `resources/admin/components/builder/ConditionEditor.jsx`

**Features:**

- Add/remove condition rules
- Field selector (populated from form fields)
- Operator dropdown
- Value input (hidden for empty/not_empty operators)
- Effect selector (show/hide/require/disable)

**UI Structure:**

```jsx
<ConditionEditor
	conditions={field.conditions || []}
	availableFields={allFields}
	onChange={(conditions) => onUpdate({ conditions })}
/>
```

#### FieldInspector Integration

New "Conditions" tab in field inspector:

```jsx
tabs={[
  { name: 'general', title: 'General' },
  { name: 'validation', title: 'Validation' },
  { name: 'conditions', title: 'Conditions' }, // NEW
  { name: 'advanced', title: 'Advanced' },
]}
```

**Available Fields:**
FormEditor extracts all non-container fields and passes to FieldInspector:

```js
const allFields = useMemo(() => {
	const fields = [];
	const traverse = (nodes) => {
		Object.values(nodes).forEach((node) => {
			if (node.type && node.type !== 'step' && !node.type.includes('container')) {
				const field = nodeToField(tree, node.id);
				if (field) {
					fields.push({
						key: field.key,
						label: field.label || field.key,
						type: field.type,
					});
				}
			}
		});
	};
	traverse(tree.nodes);
	return fields;
}, [tree]);
```

### Validation

#### SchemaValidator Updates

Now validates field-level conditions:

```php
if (isset($field['config']['conditions']) && is_array($field['config']['conditions'])) {
    foreach ($field['config']['conditions'] as $ci => $cond) {
        // Must have sourceField (string)
        // Must have operator (string)
        // Must have effect (string)
        // Value is optional (not required for empty/not_empty)
    }
}
```

### Execution Flow

1. **Submission Received** → REST API endpoint
2. **Schema Loaded** → Active version retrieved
3. **Context Created** → SubmissionContext with payload
4. **Conditions Evaluated** → ConditionalLogic.evaluate()
5. **Metadata Attached** → hidden_fields, required_fields, etc.
6. **Pipeline Executed** → Steps run with conditional state
7. **Validation Performed** → FieldValidator respects conditions
8. **Actions Execute** → SaveAction persists validated data

### Use Cases

#### Conditional Visibility

```json
{
	"sourceField": "country",
	"operator": "equals",
	"value": "USA",
	"effect": "show"
}
```

→ Shows field only when country = USA

#### Dynamic Requirements

```json
{
	"sourceField": "has_company",
	"operator": "equals",
	"value": "yes",
	"effect": "require"
}
```

→ Makes field required when has_company = yes

#### Step Gating

```json
{
	"type": "step",
	"key": "payment_step",
	"config": {
		"conditions": [
			{
				"sourceField": "plan",
				"operator": "not_equals",
				"value": "free",
				"effect": "show"
			}
		]
	}
}
```

→ Shows payment step only for paid plans

#### Empty Checks

```json
{
	"sourceField": "other_reason",
	"operator": "not_empty",
	"value": null,
	"effect": "show"
}
```

→ Shows field when other_reason has value

#### Array Membership

```json
{
	"sourceField": "interests",
	"operator": "contains",
	"value": "technology",
	"effect": "show"
}
```

→ Shows field when technology is selected in interests checkbox

### Testing Examples

#### Test Case 1: Hidden Field Skips Validation

```php
$schema = [
    'fields' => [
        ['type' => 'text', 'key' => 'email', 'config' => [
            'required' => true,
            'conditions' => [
                ['sourceField' => 'has_email', 'operator' => 'equals', 'value' => 'yes', 'effect' => 'show']
            ]
        ]]
    ]
];
$payload = ['has_email' => 'no']; // email hidden

$conditionalLogic = new ConditionalLogic();
$state = $conditionalLogic->evaluate($schema, $payload);
// $state['hidden_fields'] = ['email']

$validator = new FieldValidator();
$result = $validator->validate($schema, $payload, $state);
// $result['valid'] = true (email not validated because hidden)
```

#### Test Case 2: Conditional Requirement

```php
$schema = [
    'fields' => [
        ['type' => 'text', 'key' => 'company', 'config' => [
            'conditions' => [
                ['sourceField' => 'employed', 'operator' => 'equals', 'value' => 'yes', 'effect' => 'require']
            ]
        ]]
    ]
];
$payload = ['employed' => 'yes']; // company required

$state = $conditionalLogic->evaluate($schema, $payload);
// $state['required_fields'] = ['company']

$result = $validator->validate($schema, $payload, $state);
// $result['valid'] = false
// $result['errors'] = ['company' => 'Field "company" is required.']
```

#### Test Case 3: Numeric Comparison

```php
$condition = [
    'sourceField' => 'age',
    'operator' => 'greater_than',
    'value' => '18',
    'effect' => 'show'
];

$payload = ['age' => '25'];
$state = $conditionalLogic->evaluate(['fields' => []], $payload);
// Evaluates true, field shown
```

### Limitations & Future Work

#### Current Limitations

- No AND/OR logic groups
- No cross-field comparisons (field A > field B)
- No date-based conditions
- No calculated values
- No frontend real-time evaluation (server-side only)

#### Planned Enhancements

1. **Logic Groups**: Support nested AND/OR conditions
2. **Frontend Evaluation**: Real-time show/hide in form renderer
3. **Advanced Operators**: date_before, date_after, matches_pattern
4. **Calculated Fields**: Formula-based values
5. **Multi-target Effects**: Single condition affects multiple fields
6. **Condition Templates**: Reusable condition sets
7. **Visual Flow Builder**: Drag-and-drop condition designer

### API Reference

#### ConditionalLogic::evaluate()

```php
/**
 * @param array $schema Full form schema
 * @param array $payload Submission data (field key => value)
 * @return array{
 *   hidden_fields: string[],
 *   required_fields: string[],
 *   disabled_fields: string[],
 *   hidden_steps: string[]
 * }
 */
public function evaluate(array $schema, array $payload): array
```

#### FieldValidator::validate()

```php
/**
 * @param array $schema Form schema
 * @param array $payload Submission data
 * @param array $conditionalState Output from ConditionalLogic::evaluate()
 * @return array{valid: bool, errors: array<string,string>}
 */
public function validate(array $schema, array $payload, array $conditionalState): array
```

#### SubmissionContext Metadata

```php
// Set by SchemaCompiler::evaluateConditions()
$ctx->getMeta('conditional_state');    // Full conditional state
$ctx->getMeta('hidden_fields');        // Array of hidden field keys
$ctx->getMeta('required_fields');      // Array of required field keys
$ctx->getMeta('disabled_fields');      // Array of disabled field keys
$ctx->getMeta('hidden_steps');         // Array of hidden step keys
$ctx->getMeta('validation_errors');    // Validation errors (if any)
```

### Files Modified/Created

**Backend (PHP):**

- ✅ `src/Engine/ConditionalLogic.php` (NEW)
- ✅ `src/Engine/FieldValidator.php` (NEW)
- ✅ `src/Engine/SchemaCompiler.php` (enhanced with evaluateConditions)
- ✅ `src/Engine/Pipeline.php` (accepts schema parameter)
- ✅ `src/Engine/Actions/SaveAction.php` (validates with conditions)
- ✅ `src/Support/SchemaValidator.php` (validates condition syntax)
- ✅ `src/Api/RestController.php` (passes schema to pipeline)
- ✅ `src/Container.php` (registers ConditionalLogic)

**Frontend (React):**

- ✅ `resources/admin/components/builder/ConditionEditor.jsx` (NEW)
- ✅ `resources/admin/components/builder/FieldInspector.jsx` (added conditions tab)
- ✅ `resources/admin/components/builder/FormEditor.jsx` (extracts allFields)

### Build Output

```
asset admin.js 106 KiB [emitted] [minimized]
webpack 5.104.1 compiled successfully
```

## Summary

SubtleForms now has enterprise-grade conditional logic as a core capability:

✅ **Schema-level** - Conditions are part of the form contract  
✅ **Compiler-integrated** - Evaluates before pipeline execution  
✅ **Validation-aware** - Hidden fields skip validation  
✅ **Step-compatible** - Supports multi-step conditional flows  
✅ **Admin UI** - Basic condition editor in field inspector  
✅ **Type-safe** - Strong validation and error handling  
✅ **Extensible** - Easy to add new operators and effects

Foundation is ready for surveys, quizzes, smart forms, and dynamic user experiences.
