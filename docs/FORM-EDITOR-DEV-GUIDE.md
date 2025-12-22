# Form Editor Developer Guide

## Quick Start

### Launching the Editor

Navigate to: **WordPress Admin → SubtleForms → Forms → Create/Edit Form**

The Form Editor automatically loads when you create a new form or click "Build Form" on an existing form.

## Architecture Overview

```
FormBuilder Component
├── State Management
│   ├── draftSchema (form structure)
│   ├── selectedIndex (active field)
│   ├── hoveredIndex (mouse position)
│   └── showFieldPicker (insertion position)
│
├── Layout (2-panel)
│   ├── Left: Field Dock (collapsible)
│   ├── Center: Live Preview Canvas
│   └── Right: Field Inspector (conditional)
│
└── Sub-Components
    ├── FieldPreview (renders live inputs)
    ├── FieldPicker Popover (insert fields)
    └── Contextual Toolbar (field actions)
```

## Component API

### FormBuilder Props

```javascript
<FormBuilder
	formId={123} // Required: Form ID to load/save
	onClose={() => {}} // Optional: Close handler
/>
```

### FieldPreview Props

```javascript
<FieldPreview
	field={{
		// Field object from schema
		id: 'f_123',
		type: 'text',
		label: 'Email Address',
		required: true,
		placeholder: 'you@example.com',
	}}
	isHovered={false} // Boolean: hover state
	isSelected={false} // Boolean: selected state
	onClick={() => {}} // Function: click handler
/>
```

## Field Schema Structure

### Basic Field

```javascript
{
  id: 'f_1234567890',           // Unique ID
  key: 'text_1234567890',       // Unique key for data mapping
  name: 'text_1234567890',      // Field name attribute
  type: 'text',                 // Field type
  label: 'Full Name',           // Display label
  placeholder: 'John Doe',      // Input placeholder
  required: false               // Validation flag
}
```

### Choice Field (Radio/Checkbox/Dropdown)

```javascript
{
  id: 'f_1234567890',
  type: 'radio',
  label: 'Select Color',
  required: true,
  options: [
    { label: 'Red', value: 'red' },
    { label: 'Blue', value: 'blue' },
    { label: 'Green', value: 'green' }
  ]
}
```

### Composite Field (Address)

```javascript
{
  id: 'f_1234567890',
  type: 'address',
  label: 'Shipping Address',
  required: true,
  subFields: [
    { key: 'street', label: 'Street Address', type: 'text', required: true },
    { key: 'city', label: 'City', type: 'text', required: true },
    { key: 'state', label: 'State', type: 'text', required: true },
    { key: 'zip', label: 'ZIP Code', type: 'text', required: true }
  ]
}
```

## Adding New Field Types

### 1. Register in CoreFields.php

```php
// src/Fields/CoreFields.php
$registry->register(new FieldDefinition(
    type: 'rating',
    label: __('Star Rating', 'subtleforms'),
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
    ]
));
```

### 2. Add Default Config in makeField()

```javascript
// FormBuilder.jsx - makeField function
if (type === 'rating') {
	baseField.maxStars = 5;
}
```

### 3. Add Rendering in FieldPreview()

```javascript
// FormBuilder.jsx - FieldPreview component
{
	type === 'rating' && (
		<div style={{ display: 'flex', gap: '4px' }}>
			{Array.from({ length: field.maxStars || 5 }).map((_, i) => (
				<span key={i} style={{ fontSize: '24px', color: '#fbbf24' }}>
					★
				</span>
			))}
		</div>
	);
}
```

### 4. Add Inspector Controls (Optional)

```javascript
// FormBuilder.jsx - Field Inspector → General tab
{
	fields[selectedIndex].type === 'rating' && (
		<TextControl
			label={__('Max Stars', 'subtleforms')}
			type='number'
			value={fields[selectedIndex].maxStars || 5}
			onChange={(v) => updateField(selectedIndex, { maxStars: parseInt(v) })}
		/>
	);
}
```

### 5. Rebuild

```bash
npm run build
```

## Customizing Field Appearance

### Modifying Input Styles

Edit the `inputStyle` object in `FieldPreview`:

```javascript
const inputStyle = {
	width: '100%',
	padding: '10px 12px',
	fontSize: '14px',
	border: '1px solid #8c8f94',
	borderRadius: '4px',
	fontFamily: 'inherit',
	pointerEvents: 'none',

	// Add custom styles
	backgroundColor: '#fff',
	boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
};
```

### Customizing Selection Color

Edit `containerStyle` in `FieldPreview`:

```javascript
background: isSelected ? '#e6f3ff' : isHovered ? '#fafafa' : '#fff',
border: isSelected ? '2px solid #0056b3' : '1px solid #e0e0e0',
```

### Changing Toolbar Colors

Edit toolbar button styles in main render:

```javascript
style={{
  background: '#0056b3',  // Changed from #2271b1
  // ...
}}
```

## State Management Patterns

### Adding a Field

```javascript
function addField(type, position = null) {
	const f = makeField(type);
	const fields = [...(draftSchema.fields || [])];
	const insertAt = position !== null ? position : fields.length;
	fields.splice(insertAt, 0, f);
	setDraftSchema((s) => ({ ...(s || {}), fields }));
	setSelectedIndex(insertAt); // Auto-select new field
}
```

### Updating a Field

```javascript
function updateField(idx, changes) {
	const fields = [...(draftSchema.fields || [])];
	fields[idx] = { ...(fields[idx] || {}), ...changes };
	setDraftSchema((s) => ({ ...(s || {}), fields }));
}
```

### Removing a Field

```javascript
function removeField(idx) {
	const fields = [...(draftSchema.fields || [])];
	fields.splice(idx, 1);
	setDraftSchema((s) => ({ ...(s || {}), fields }));
	setSelectedIndex(null); // Clear selection
}
```

## Handling Composite Fields

### Structure

Composite fields contain `subFields` array:

```javascript
{
  type: 'composite_field_type',
  subFields: [
    { key: 'sub1', label: 'Sub Field 1', type: 'text' },
    { key: 'sub2', label: 'Sub Field 2', type: 'email' }
  ]
}
```

### Rendering

```javascript
{
	type === 'your_composite_type' && subFields && (
		<div style={{ padding: '16px', background: '#f9f9f9', borderRadius: '4px' }}>
			{subFields.map((sub, idx) => (
				<div key={idx} style={{ marginBottom: '12px' }}>
					<label>{sub.label}</label>
					<input type={sub.type} style={inputStyle} readOnly />
				</div>
			))}
		</div>
	);
}
```

### Sub-field Editing

Add to Field Inspector:

```javascript
{
	fields[selectedIndex].type === 'your_composite_type' && (
		<div>
			<label>{__('Sub-fields', 'subtleforms')}</label>
			{fields[selectedIndex].subFields?.map((sub, idx) => (
				<TextControl
					key={idx}
					label={sub.key}
					value={sub.label}
					onChange={(v) => {
						const newSubFields = [...fields[selectedIndex].subFields];
						newSubFields[idx] = { ...sub, label: v };
						updateField(selectedIndex, { subFields: newSubFields });
					}}
				/>
			))}
		</div>
	);
}
```

## REST API Integration

### Load Form Schema

```javascript
apiGet(`/forms/${formId}/schema`).then(({ ok, body }) => {
	if (ok) {
		setDraftSchema(body.schema ?? body);
	}
});
```

### Save Form Schema

```javascript
apiPost(`/forms/${formId}/schema`, {
	schema: draftSchema,
	activate: true, // Optional: activate after save
}).then(({ ok, body }) => {
	if (ok) {
		// Success
	}
});
```

### Load Field Definitions

```javascript
apiGet('/fields?grouped=true').then(({ ok, body }) => {
	if (ok) {
		setFieldGroups(body); // { basic: [...], choices: [...], ... }
	}
});
```

## Debugging Tips

### Console Logging

```javascript
console.log('Current schema:', draftSchema);
console.log('Selected field:', fields[selectedIndex]);
console.log('Field groups:', fieldGroups);
```

### React DevTools

1. Install React DevTools browser extension
2. Inspect FormBuilder component
3. View props and state in real-time

### Common Issues

**Field not rendering:**

- Check field type is handled in FieldPreview
- Verify field type exists in CoreFields.php
- Rebuild after changes: `npm run build`

**Changes not saving:**

- Check browser console for API errors
- Verify REST nonce is valid
- Check field schema matches backend validator

**Field picker not opening:**

- Verify fieldPickerAnchorRef is set
- Check Popover component import
- Ensure showFieldPicker state updates

## Performance Optimization

### Memoization

Consider memoizing FieldPreview for large forms:

```javascript
import { memo } from '@wordpress/element';

const FieldPreview = memo(({ field, isHovered, isSelected, onClick }) => {
	// ... component code
});
```

### Virtual Scrolling

For forms with 100+ fields, implement virtual scrolling:

```javascript
import { FixedSizeList } from 'react-window';

<FixedSizeList
	height={600}
	itemCount={fields.length}
	itemSize={100}
	width='100%'>
	{({ index, style }) => (
		<div style={style}>
			<FieldPreview field={fields[index]} />
		</div>
	)}
</FixedSizeList>;
```

## Testing

### Manual Testing Checklist

```
□ Add text field → verify renders as input
□ Add email field → verify type="email"
□ Add choice field → verify options appear
□ Edit field label → verify updates in preview
□ Set required → verify asterisk appears
□ Move field up/down → verify order changes
□ Duplicate field → verify copy created
□ Delete field → verify removal
□ Save form → verify persists
□ Reload page → verify fields restored
```

### Automated Testing (Future)

```javascript
describe('FormBuilder', () => {
	it('should add field when clicking dock item', () => {
		const { getByText } = render(<FormBuilder formId={1} />);
		fireEvent.click(getByText('Text'));
		expect(screen.getByRole('textbox')).toBeInTheDocument();
	});
});
```

## Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules build
npm install
npm run build
```

### Field Not Updating

```javascript
// ❌ Wrong - mutates state
fields[idx].label = 'New Label';

// ✅ Correct - creates new object
fields[idx] = { ...fields[idx], label: 'New Label' };
```

### Popover Not Positioning

```javascript
// Ensure ref is attached before showing popover
<button
	ref={showFieldPicker?.position === i ? fieldPickerAnchorRef : null}
	onClick={() => setShowFieldPicker({ position: i })}>
	Insert Field
</button>
```

## Resources

- [WordPress Components](https://developer.wordpress.org/block-editor/reference-guides/components/)
- [React Hooks](https://react.dev/reference/react)
- [SubtleForms Field Registry](./FIELD-REGISTRY.md)
- [SubtleForms Field Types](./FIELD-TYPES.md)
