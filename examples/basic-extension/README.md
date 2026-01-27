# Basic Extension Example

Minimal SubtleForms extension demonstrating hook usage.

## What This Extension Does

- Logs form save events to browser console
- Adds a timestamp to form metadata
- Validates form names before saving

## Files

- `basic-extension.php` - WordPress plugin file
- `index.js` - Extension entry point
- `README.md` - This file

## Installation

1. Copy this folder to `wp-content/plugins/`
2. Activate "SubtleForms Basic Extension" in WordPress admin
3. SubtleForms must be installed and active

## Usage

Once activated, the extension automatically:

1. **Logs Save Events**: Open browser console when saving forms
2. **Adds Timestamps**: Metadata includes `lastModified` timestamp
3. **Validates Names**: Prevents saving forms with empty names

## Code Walkthrough

### Extension Registration

```javascript
import { registerExtension, checkSDKCompatibility } from '@subtleforms/sdk';

// Check compatibility
const compatibility = checkSDKCompatibility('1.0.0', {
  hooks: true
});

if (!compatibility.compatible) {
  console.error('Incompatible SubtleForms version');
  return;
}

// Register extension
const api = registerExtension({
  id: 'com.example.basic',
  name: 'Basic Extension',
  version: '1.0.0'
});
```

### Adding Hooks

```javascript
// Log save events (action hook)
api.addBuilderHook('afterSave', (payload) => {
  console.log('Form saved:', payload.formId);
});

// Add timestamp (filter hook)
api.addBuilderHook('beforeSave', (payload) => {
  return {
    ...payload,
    schema: {
      ...payload.schema,
      metadata: {
        ...payload.schema.metadata,
        lastModified: Date.now()
      }
    }
  };
});

// Validate name (filter hook with prevention)
api.addBuilderHook('beforeSave', (payload) => {
  if (!payload.schema.name || payload.schema.name.trim() === '') {
    alert('Form name cannot be empty');
    return false; // Prevent save
  }
  return payload;
});
```

## Testing

1. Create a new form in SubtleForms
2. Open browser console (F12)
3. Save the form
4. You should see: "Form saved: {formId}"

## Customization

Modify `index.js` to add your own hooks:

```javascript
// Track field insertions
api.addBuilderHook('afterFieldInsert', (payload) => {
  console.log('Field added:', payload.type);
});

// Validate before field deletion
api.addBuilderHook('beforeFieldDelete', (payload) => {
  const node = payload.schema.nodes[payload.nodeId];
  if (node.config?.protected) {
    alert('This field is protected');
    return false;
  }
});
```

## Next Steps

- Review [Builder Hooks Reference](/docs/builder-hooks.md)
- Explore [UI Panel Extension](/examples/ui-panel-extension)
- Read [Extension Guide](/docs/extension-guide.md)
