# Builder Hooks Reference

Complete reference for SubtleForms builder lifecycle hooks.

## Overview

Builder hooks allow extensions to observe and modify form builder operations. All hooks receive immutable data - extensions must return modified copies, not mutate originals.

## Hook Categories

- **Field Lifecycle:** Insert, delete, update, move, duplicate
- **Form Lifecycle:** Save, validate
- **Selection:** Field selection events

## Field Insert Hooks

### `builder.beforeFieldInsert`

Fires before a field is inserted into the form.

**Payload:**
```javascript
{
  type: string,        // Field type ('text', 'email', etc.)
  parentId: string,    // Parent node ID
  position: number,    // Insert position
  config: object       // Field configuration
}
```

**Return:** Modified payload or `undefined`

**Example:**
```javascript
api.addBuilderHook('beforeFieldInsert', (payload) => {
  // Add default configuration
  return {
    ...payload,
    config: {
      ...payload.config,
      customDefault: true,
    },
  };
});
```

### `builder.afterFieldInsert`

Fires after a field has been inserted.

**Payload:**
```javascript
{
  nodeId: string,      // New node ID
  type: string,        // Field type
  parentId: string,    // Parent node ID
  schema: object       // Updated schema
}
```

**Return:** None (action hook)

**Example:**
```javascript
api.addBuilderHook('afterFieldInsert', (payload) => {
  console.log(`Field ${payload.type} added with ID ${payload.nodeId}`);
  trackAnalytics('field_inserted', { type: payload.type });
});
```

## Field Delete Hooks

### `builder.beforeFieldDelete`

Fires before a field is deleted.

**Payload:**
```javascript
{
  nodeId: string,      // Node to delete
  schema: object       // Current schema
}
```

**Return:** `false` to prevent deletion, or `undefined`

**Example:**
```javascript
api.addBuilderHook('beforeFieldDelete', (payload) => {
  const node = payload.schema.nodes[payload.nodeId];
  
  // Prevent deletion of required fields
  if (node.config?.required) {
    alert('Cannot delete required field');
    return false;
  }
});
```

### `builder.afterFieldDelete`

Fires after a field has been deleted.

**Payload:**
```javascript
{
  nodeId: string,      // Deleted node ID
  schema: object       // Updated schema
}
```

**Return:** None (action hook)

## Field Update Hooks

### `builder.beforeFieldUpdate`

Fires before field configuration is updated.

**Payload:**
```javascript
{
  nodeId: string,         // Node being updated
  changes: object,        // Configuration changes
  currentConfig: object   // Current configuration
}
```

**Return:** Modified changes object or `undefined`

**Example:**
```javascript
api.addBuilderHook('beforeFieldUpdate', (payload) => {
  // Enforce validation rules
  if (payload.changes.maxLength && payload.changes.maxLength > 1000) {
    return {
      ...payload.changes,
      maxLength: 1000,
    };
  }
});
```

### `builder.afterFieldUpdate`

Fires after field configuration has been updated.

**Payload:**
```javascript
{
  nodeId: string,      // Updated node ID
  config: object,      // New configuration
  schema: object       // Updated schema
}
```

**Return:** None (action hook)

## Field Move Hooks

### `builder.beforeFieldMove`

Fires before a field is moved to a new position.

**Payload:**
```javascript
{
  nodeId: string,      // Node being moved
  destination: {       // New location
    parentId: string,
    columnIndex: number | null,
    position: number
  },
  schema: object       // Current schema
}
```

**Return:** Modified payload or `undefined`

### `builder.afterFieldMove`

Fires after a field has been moved.

**Payload:**
```javascript
{
  nodeId: string,      // Moved node ID
  destination: object, // New location
  schema: object       // Updated schema
}
```

**Return:** None (action hook)

## Field Duplicate Hooks

### `builder.beforeFieldDuplicate`

Fires before a field is duplicated.

**Payload:**
```javascript
{
  nodeId: string,      // Node to duplicate
  schema: object       // Current schema
}
```

**Return:** Modified payload or `undefined`

### `builder.afterFieldDuplicate`

Fires after a field has been duplicated.

**Payload:**
```javascript
{
  originalId: string,  // Original node ID
  newId: string,       // New node ID
  schema: object       // Updated schema
}
```

**Return:** None (action hook)

## Form Save Hooks

### `builder.beforeSave`

Fires before form is saved to server.

**Payload:**
```javascript
{
  schema: object,      // Form schema
  formId: number,      // Form ID
  status: string       // 'draft' | 'published'
}
```

**Return:** Modified schema or `undefined`

**Example:**
```javascript
api.addBuilderHook('beforeSave', (payload) => {
  // Add metadata before save
  return {
    ...payload.schema,
    metadata: {
      ...payload.schema.metadata,
      lastModified: Date.now(),
      modifiedBy: getCurrentUser(),
    },
  };
});
```

### `builder.afterSave`

Fires after form has been saved successfully.

**Payload:**
```javascript
{
  formId: number,      // Form ID
  schema: object,      // Saved schema
  status: string,      // 'draft' | 'published'
  response: object     // Server response
}
```

**Return:** None (action hook)

**Example:**
```javascript
api.addBuilderHook('afterSave', (payload) => {
  if (payload.status === 'published') {
    sendNotification(`Form ${payload.formId} published`);
  }
});
```

## Validation Hooks

### `builder.beforeValidate`

Fires before schema validation.

**Payload:**
```javascript
{
  schema: object       // Schema to validate
}
```

**Return:** Modified schema or `undefined`

**Example:**
```javascript
api.addBuilderHook('beforeValidate', (payload) => {
  // Add validation metadata
  return {
    ...payload.schema,
    _validationContext: {
      timestamp: Date.now(),
      source: 'extension',
    },
  };
});
```

### `builder.afterValidate`

Fires after schema validation completes.

**Payload:**
```javascript
{
  schema: object,      // Validated schema
  errors: array        // Validation errors (if any)
}
```

**Return:** None (action hook)

**Example:**
```javascript
api.addBuilderHook('afterValidate', (payload) => {
  if (payload.errors.length > 0) {
    logValidationErrors(payload.errors);
  }
});
```

## Selection Hooks

### `builder.fieldSelected`

Fires when a field is selected in the builder.

**Payload:**
```javascript
{
  nodeId: string,      // Selected node ID
  schema: object       // Current schema
}
```

**Return:** None (action hook)

### `builder.fieldDeselected`

Fires when a field is deselected.

**Payload:**
```javascript
{
  nodeId: string,      // Deselected node ID
  schema: object       // Current schema
}
```

**Return:** None (action hook)

## Hook Constants

Use constants from the SDK to avoid typos:

```javascript
import { BUILDER_HOOKS } from '@subtleforms/sdk';

api.addBuilderHook(BUILDER_HOOKS.BEFORE_SAVE, handler);
api.addBuilderHook(BUILDER_HOOKS.AFTER_FIELD_INSERT, handler);
```

**Available Constants:**
- `BEFORE_FIELD_INSERT`
- `AFTER_FIELD_INSERT`
- `BEFORE_FIELD_DELETE`
- `AFTER_FIELD_DELETE`
- `BEFORE_FIELD_UPDATE`
- `AFTER_FIELD_UPDATE`
- `BEFORE_FIELD_MOVE`
- `AFTER_FIELD_MOVE`
- `BEFORE_FIELD_DUPLICATE`
- `AFTER_FIELD_DUPLICATE`
- `BEFORE_SAVE`
- `AFTER_SAVE`
- `BEFORE_VALIDATE`
- `AFTER_VALIDATE`
- `FIELD_SELECTED`
- `FIELD_DESELECTED`

## Best Practices

### Do's

✅ Return modified copies from filters  
✅ Use constants for hook names  
✅ Handle errors gracefully  
✅ Keep hooks fast (< 100ms)  
✅ Validate modified data

### Don'ts

❌ Mutate payload objects directly  
❌ Block async operations  
❌ Access DOM in hooks  
❌ Store mutable state  
❌ Throw errors (return false instead)

## Priority

Hooks execute in priority order (lower first):

```javascript
// Runs first
api.addBuilderHook('beforeSave', handler1, 5);

// Runs second
api.addBuilderHook('beforeSave', handler2, 10);

// Runs third (default priority)
api.addBuilderHook('beforeSave', handler3);
```

## Error Handling

Hook errors are caught and logged but don't crash core:

```javascript
api.addBuilderHook('beforeSave', (payload) => {
  try {
    return processSchema(payload.schema);
  } catch (error) {
    console.error('Processing failed:', error);
    return payload.schema; // Return original on error
  }
});
```

## Examples

See `/examples/` for complete working examples.
