# Step/Page Support in SubtleForms

## Overview

SubtleForms now supports multi-step forms as a compositional primitive. Steps are structural containers that organize fields into logical pages, enabling complex form experiences without hard-coded form types.

## Architecture

### Field Definition

- **Type**: `step`
- **Category**: `structure` (alongside group_container, repeat_container)
- **Accepts Children**: `true` (can contain any field)
- **Location**: `src/Fields/CoreFields.php` (lines 764-781)

### Schema Structure

```json
{
	"fields": [
		{
			"type": "step",
			"key": "step_1",
			"config": {
				"title": "Personal Information",
				"description": "Tell us about yourself"
			},
			"children": [
				{
					"type": "text",
					"key": "first_name",
					"config": { "label": "First Name" }
				}
			]
		},
		{
			"type": "step",
			"key": "step_2",
			"config": {
				"title": "Contact Details",
				"description": ""
			},
			"children": []
		}
	]
}
```

## UI Components

### StepNavigator (`resources/admin/components/builder/StepNavigator.jsx`)

Horizontal navigation bar that displays:

- **Step tabs**: Click to switch between steps
- **Delete button**: Remove steps (disabled if only 1 step remains)
- **Add Step button**: Create new steps

**Props**:

- `steps`: Array of step nodes from tree
- `selectedStepId`: Currently active step
- `onSelectStep(stepId)`: Switch to a step
- `onAddStep()`: Create a new step
- `onDeleteStep(stepId)`: Remove a step

### FormEditor Integration

- **Step extraction**: Filters root children by `type === 'step'`
- **Auto-selection**: Selects first step on mount if none selected
- **Field routing**: New fields from FieldDock are added to the selected step

### FormBuilder Display

- Only renders the currently selected step
- Falls back to showing all root children (backward compatible)
- Step containers have distinct styling (blue background)

### ContainerRenderer Enhancements

- Step containers display `config.title` and `config.description`
- Steps cannot be dragged or deleted via chrome (managed by StepNavigator)
- Visual distinction: blue-tinted background for steps

## Styling

All step-specific styles in `assets/css/admin-builder.css`:

```css
.subtleforms-step-navigator {
	/* Navigation bar */
}
.subtleforms-step-tab {
	/* Individual step tabs */
}
.subtleforms-step-tab.is-selected {
	/* Active step */
}
.subtleforms-step-tab-delete {
	/* Delete button */
}
.subtleforms-add-step-button {
	/* Add step button */
}
```

## Field Inspector

When a step is selected, the inspector shows:

- **Step Title**: Editable text field (shown in navigation)
- **Description**: Optional descriptive text

## Initial State

New blank forms automatically receive one step:

```js
{
  type: 'step',
  key: `step_${Date.now()}`,
  config: {
    title: 'Step 1',
    description: '',
  },
  children: [],
}
```

## Backend Support

### FieldRegistry

The step field is registered in `CoreFields.php` with:

- `acceptsChildren: true` (enables tree structure)
- `settingsSchema` validation for title/description

### SchemaValidator

No special handling needed - steps are validated like any container field with children.

### SchemaCompiler

**TODO**: Steps are currently compiled as regular containers. Future enhancement needed to:

1. Group fields by step in compiled output
2. Preserve step order
3. Add step metadata to compiled schema

## Limitations (Current)

1. **Admin Only**: No frontend step navigation yet
2. **No Reordering**: Steps can't be dragged between positions
3. **No Conditional Logic**: Steps are always sequential
4. **No Validation Grouping**: Step-level validation not implemented
5. **Submission Tracking**: Current step/completed steps not stored

## Future Enhancements

### Frontend Navigation

- Progress indicator showing step X of Y
- Previous/Next buttons with client-side validation
- URL hash-based step routing (#step-2)
- Save & continue later functionality

### Submission Context

Add to submissions table:

- `current_step` (varchar): Key of the current step
- `completed_steps` (json): Array of completed step keys

### Conditional Steps

- Show/hide steps based on field values
- Dynamic step ordering
- Step branching logic

### Validation Groups

- Validate fields within a step before proceeding
- Step-level error messages
- Required step completion tracking

### Step Templates

- Common step patterns (contact info, payment, review)
- Drag-and-drop step reordering
- Step duplication

## Testing Checklist

- [x] Step field registered in CoreFields.php
- [x] StepNavigator renders with add/delete/select
- [x] FormEditor filters and displays selected step
- [x] FormBuilder renders step children correctly
- [x] FieldDock adds fields to selected step
- [x] FieldInspector shows step title/description
- [x] ContainerRenderer displays step with proper styling
- [x] Create blank form initializes with Step 1
- [x] Build succeeds without errors
- [ ] Step deletion preserves remaining step selection
- [ ] Step switching preserves field selection
- [ ] Auto-save maintains step context
- [ ] Step schema validates correctly
- [ ] Step compilation outputs correct structure

## Known Issues

None at this time.

## Related Files

**Frontend**:

- `resources/admin/components/builder/StepNavigator.jsx`
- `resources/admin/components/builder/FormEditor.jsx` (lines 1-90, 191-260)
- `resources/admin/components/builder/FormBuilder.jsx` (lines 70-95)
- `resources/admin/components/builder/ContainerRenderer.jsx` (lines 5-20, 48-100)
- `resources/admin/components/builder/FieldInspector.jsx` (lines 52-68)
- `resources/admin/components/builder/utils/iconMap.js` (line 21, 42)
- `resources/admin/components/CreateFormModal.jsx` (lines 49-80)
- `assets/css/admin-builder.css` (lines 390-478)

**Backend**:

- `src/Fields/CoreFields.php` (lines 764-781)
- `src/Fields/FieldDefinition.php` (acceptsChildren property)
- `src/Fields/FieldRegistry.php` (registration system)

**Schema**:

- `resources/admin/components/builder/utils/schemaTree.js` (normalizeSchema, denormalizeTree)
