# Getting Started with SubtleForms Extensions

Build powerful extensions for SubtleForms using our stable, versioned SDK.

## Prerequisites

- **SubtleForms:** 1.8.0+
- **WordPress:** 6.0+
- **PHP:** 7.4+
- **Node.js:** 16+ (for development)

## Installation

### Option 1: NPM (Recommended)

```bash
npm install @subtleforms/sdk
```

### Option 2: Direct Include

Download the SDK from the SubtleForms plugin directory:

```javascript
// In your extension's main file
import * as SubtleFormsSDK from '../subtleforms/sdk/index.js';
```

## Quick Start

### 1. Register Your Extension

Every extension must register before using any APIs:

```javascript
import { registerExtension } from '@subtleforms/sdk';

const api = registerExtension({
  id: 'com.yourcompany.yourextension',
  name: 'Your Extension Name',
  version: '1.0.0',
  description: 'What your extension does',
  requires: ['hooks', 'builderHooks'],
  initialize: () => {
    console.log('Extension loaded!');
  },
});
```

**Important:** Use reverse domain notation for IDs to prevent conflicts.

### 2. Add Functionality

Use the returned API object to add hooks, UI slots, or capabilities:

```javascript
// Track when forms are saved
api.addBuilderHook('afterSave', (payload) => {
  console.log('Form saved:', payload.formId, payload.status);
});

// Add a custom toolbar button
api.addUISlot('builder.toolbar.actions', MyButton, {
  priority: 10,
});

// Register a Pro feature
api.addCapability('myext.feature', {
  description: 'Advanced feature',
  check: (license) => license.plan === 'pro',
});
```

### 3. Check Compatibility

Ensure your extension works with the current SubtleForms version:

```javascript
import { checkSDKCompatibility } from '@subtleforms/sdk';

const compat = checkSDKCompatibility('1.0.0', ['hooks', 'uiSlots']);
if (!compat.compatible) {
  throw new Error(`Incompatible SDK: ${compat.reason}`);
}
```

## Core Concepts

### Extensions

Extensions are self-contained modules that:
- Register once on load
- Use only public APIs
- Clean up on unload
- Cannot access internal core code

### Hooks

Hooks follow WordPress conventions:

- **Actions:** Execute side effects, no return value
- **Filters:** Transform data, must return value

```javascript
// Action: observe events
api.addHook('builder.afterSave', (payload) => {
  sendAnalytics(payload);
});

// Filter: transform data
api.addHook('builder.beforeSave', (schema, context) => {
  return {
    ...schema,
    metadata: { ...schema.metadata, timestamp: Date.now() },
  };
});
```

### UI Slots

Inject React components at predefined locations:

```javascript
const MyComponent = ({ context }) => {
  return <button>Custom Action</button>;
};

api.addUISlot('builder.toolbar.actions', MyComponent, {
  priority: 5,
  shouldRender: (context) => context.formType === 'payment',
});
```

### Capabilities

Register custom Pro features that integrate with SubtleForms' policy layer:

```javascript
api.addCapability('analytics.advanced', {
  description: 'Advanced analytics reports',
  check: (license) => license.plan === 'business',
  upgradeMessage: 'Upgrade to Business for advanced analytics',
});

// Use in components
import { useAbility } from '@subtleforms/sdk';

const { can } = useAbility('analytics.advanced');
if (can) {
  // Show pro feature
}
```

## File Structure

Recommended extension structure:

```
my-extension/
├── my-extension.php       # WordPress plugin file
├── package.json           # NPM dependencies
├── src/
│   ├── index.js          # Extension entry point
│   ├── hooks.js          # Hook handlers
│   ├── components/       # UI components
│   │   └── MyButton.jsx
│   └── utils/            # Utilities
└── build/                # Compiled assets
```

## Loading Your Extension

### WordPress Plugin

```php
<?php
/**
 * Plugin Name: My SubtleForms Extension
 * Description: Extends SubtleForms with custom features
 * Version: 1.0.0
 * Requires Plugins: subtleforms
 */

add_action('admin_enqueue_scripts', function($hook) {
  if (strpos($hook, 'subtleforms') === false) {
    return;
  }
  
  wp_enqueue_script(
    'my-extension',
    plugins_url('build/index.js', __FILE__),
    ['subtleforms-admin'],
    '1.0.0',
    true
  );
});
```

### JavaScript Entry Point

```javascript
import { registerExtension, BUILDER_HOOKS } from '@subtleforms/sdk';

// Wait for SubtleForms to load
document.addEventListener('DOMContentLoaded', () => {
  const api = registerExtension({
    id: 'com.example.myext',
    name: 'My Extension',
    version: '1.0.0',
  });
  
  // Add your functionality
  api.addBuilderHook(BUILDER_HOOKS.AFTER_SAVE, (payload) => {
    console.log('Saved!', payload);
  });
});
```

## Best Practices

### Do's

✅ Check SDK compatibility on load  
✅ Use namespaced IDs  
✅ Handle errors gracefully  
✅ Return modified data from filters  
✅ Unregister on cleanup  
✅ Test with different license states

### Don'ts

❌ Import from internal paths (`../resources/admin/components/...`)  
❌ Access `window.subtleformsInternal`  
❌ Mutate objects received in hooks  
❌ Block the UI thread  
❌ Rely on DOM structure  
❌ Store sensitive data in browser

## Examples

See complete working examples in `/examples/`:

- **basic-extension** - Minimal hook usage
- **ui-panel-extension** - Custom UI components
- **capability-extension** - Pro feature gating

## Next Steps

- [Extension Guide](./extension-guide.md) - Deep dive into extension system
- [Builder Hooks](./builder-hooks.md) - Complete hook reference
- [UI Extensions](./ui-extensions.md) - UI slot documentation
- [Capabilities](./capabilities.md) - Pro feature integration

## Getting Help

- **Documentation:** `/docs/` directory
- **Examples:** `/examples/` directory
- **SDK Info:** `getSDKInfo()` in console
- **Compatibility:** `checkSDKCompatibility(version, features)`

## Compatibility

This guide is for **SDK v1.0.0**.

Breaking changes require major version bumps and migration guides.
