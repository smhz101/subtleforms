# SubtleForms SDK

Official JavaScript SDK for extending SubtleForms with custom functionality.

## Overview

The SubtleForms SDK provides a stable, versioned API for building extensions that add custom hooks, UI components, and capabilities to SubtleForms.

**Current Version:** 1.0.0  
**Stability:** Stable  
**License:** GPL v2 or later

## Features

✅ **Hook System** - React to form builder events  
✅ **UI Slots** - Inject custom React components  
✅ **Capabilities** - Gate features by license tier  
✅ **Data Hooks** - Fetch forms, templates, and license data  
✅ **Policy Layer** - Check user permissions  
✅ **TypeScript** - Full type definitions included

## Installation

### Via NPM (Recommended)

```bash
npm install @subtleforms/sdk
```

### Direct Include

```javascript
// SDK is available globally when SubtleForms is loaded
const { registerExtension } = window.SubtleFormsSDK;
```

## Quick Start

### 1. Create Extension Entry Point

```javascript
// my-extension/index.js
import { 
  registerExtension, 
  checkSDKCompatibility 
} from '@subtleforms/sdk';

// Check compatibility
const compatibility = checkSDKCompatibility('1.0.0', {
  hooks: true,
  uiSlots: true
});

if (!compatibility.compatible) {
  console.error('Incompatible SubtleForms version:', compatibility.reason);
  return;
}

// Register extension
const api = registerExtension({
  id: 'com.example.my-extension',
  name: 'My Extension',
  version: '1.0.0',
  description: 'My custom SubtleForms extension'
});

// Add functionality
api.addBuilderHook('afterSave', (payload) => {
  console.log('Form saved:', payload.formId);
});
```

### 2. Create WordPress Plugin

```php
<?php
/**
 * Plugin Name: My SubtleForms Extension
 * Requires Plugins: subtleforms
 */

add_action('admin_enqueue_scripts', function() {
    wp_enqueue_script(
        'my-extension',
        plugins_url('index.js', __FILE__),
        ['subtleforms-admin'],
        '1.0.0',
        true
    );
});
```

### 3. Activate and Test

1. Install SubtleForms 1.8.0+
2. Activate your extension plugin
3. Open a form in the builder
4. Check browser console for logs

## Core Concepts

### Extensions

Extensions are self-contained packages that extend SubtleForms functionality.

```javascript
const api = registerExtension({
  id: 'com.example.analytics',      // Unique ID
  name: 'Form Analytics',            // Display name
  version: '1.0.0',                  // SemVer
  description: 'Track form metrics'  // Brief description
});
```

### Hooks

React to and modify builder operations.

**Action Hooks** (observe events):
```javascript
api.addBuilderHook('afterSave', (payload) => {
  // Log event, send analytics, etc.
  console.log('Form saved:', payload.formId);
});
```

**Filter Hooks** (transform data):
```javascript
api.addBuilderHook('beforeSave', (payload) => {
  // Modify payload before save
  return {
    ...payload,
    schema: enhanceSchema(payload.schema)
  };
});
```

### UI Slots

Add custom React components to the interface.

```javascript
import { UI_SLOTS } from '@subtleforms/sdk';

const CustomPanel = ({ schema, formId }) => (
  <div className="my-panel">
    <h3>Custom Tools</h3>
    <p>Form has {Object.keys(schema.nodes).length} fields</p>
  </div>
);

api.addUISlot(UI_SLOTS.BUILDER_SIDEBAR_BOTTOM, CustomPanel);
```

### Capabilities

Gate features by license tier.

```javascript
import { Can, Cannot } from '@subtleforms/sdk';

// Declarative
<Can I="use" a="advanced_analytics">
  <AnalyticsPanel />
</Can>

// Programmatic
const ability = useAbility('use', 'webhooks');
if (ability.can) {
  // Show Pro feature
}
```

## API Reference

### Extension Registration

#### `registerExtension(config)`

Register a new extension.

**Parameters:**
- `config.id` (string) - Unique extension ID
- `config.name` (string) - Display name
- `config.version` (string) - Semantic version
- `config.description` (string, optional) - Brief description
- `config.initialize` (function, optional) - Init callback
- `config.cleanup` (function, optional) - Cleanup callback

**Returns:** Extension API object

**Example:**
```javascript
const api = registerExtension({
  id: 'com.example.extension',
  name: 'My Extension',
  version: '1.0.0',
  initialize: () => console.log('Loaded'),
  cleanup: () => console.log('Unloaded')
});
```

### Hook System

#### `api.addBuilderHook(hookName, callback, priority?)`

Register a builder lifecycle hook.

**Parameters:**
- `hookName` (string) - Hook constant from `BUILDER_HOOKS`
- `callback` (function) - Handler function
- `priority` (number, optional) - Execution priority (default: 10)

**Returns:** Unregister function

**Available Hooks:**
- `BEFORE_FIELD_INSERT` / `AFTER_FIELD_INSERT`
- `BEFORE_FIELD_DELETE` / `AFTER_FIELD_DELETE`
- `BEFORE_FIELD_UPDATE` / `AFTER_FIELD_UPDATE`
- `BEFORE_FIELD_MOVE` / `AFTER_FIELD_MOVE`
- `BEFORE_FIELD_DUPLICATE` / `AFTER_FIELD_DUPLICATE`
- `BEFORE_SAVE` / `AFTER_SAVE`
- `BEFORE_VALIDATE` / `AFTER_VALIDATE`
- `FIELD_SELECTED` / `FIELD_DESELECTED`

**Example:**
```javascript
import { BUILDER_HOOKS } from '@subtleforms/sdk';

api.addBuilderHook(BUILDER_HOOKS.BEFORE_SAVE, (payload) => {
  if (!payload.schema.name) {
    alert('Name required');
    return false; // Prevent save
  }
  return payload;
});
```

### UI Slots

#### `api.addUISlot(slotName, component, options?)`

Register a UI component in a slot.

**Parameters:**
- `slotName` (string) - Slot constant from `UI_SLOTS`
- `component` (React.Component) - Component to render
- `options.priority` (number, optional) - Render priority
- `options.shouldRender` (function, optional) - Conditional rendering

**Available Slots:**
- `BUILDER_SIDEBAR_TOP` / `BUILDER_SIDEBAR_BOTTOM`
- `BUILDER_TOOLBAR_LEFT` / `BUILDER_TOOLBAR_RIGHT`
- `BUILDER_FIELD_SETTINGS_TOP` / `BUILDER_FIELD_SETTINGS_BOTTOM`
- `FORM_LIST_TABLE_ACTIONS` / `FORM_LIST_HEADER_ACTIONS`
- `SETTINGS_TABS_CONTENT`

**Example:**
```javascript
import { UI_SLOTS } from '@subtleforms/sdk';

api.addUISlot(
  UI_SLOTS.BUILDER_SIDEBAR_BOTTOM,
  MyPanel,
  {
    priority: 5,
    shouldRender: (context) => context.formId != null
  }
);
```

### Capabilities

#### `api.addCapability(key, config)`

Register a custom capability.

**Parameters:**
- `key` (string) - Capability identifier
- `config.description` (string) - Human-readable description
- `config.check` (function) - Capability check function
- `config.upgradeMessage` (string) - Upgrade prompt text

**Example:**
```javascript
api.addCapability('custom_export', {
  description: 'Custom Export Formats',
  check: ({ license }) => license?.plan === 'pro',
  upgradeMessage: 'Upgrade to Pro for custom exports'
});
```

### Data Hooks

#### `useForm(formId)`

Fetch single form data.

```javascript
import { useForm } from '@subtleforms/sdk';

const { data: form, loading, error } = useForm(formId);
```

#### `useForms()`

Fetch all forms.

```javascript
import { useForms } from '@subtleforms/sdk';

const { data: forms, loading, error } = useForms();
```

#### `useTemplates()`

Fetch form templates.

```javascript
import { useTemplates } from '@subtleforms/sdk';

const { data: templates, loading, error } = useTemplates();
```

#### `useLicense()`

Fetch license information.

```javascript
import { useLicense } from '@subtleforms/sdk';

const { data: license, loading, error } = useLicense();
// license: { plan, status, expiresAt, ... }
```

### Policy Layer

#### `useAbility(action, subject)`

Check if action is allowed.

```javascript
import { useAbility } from '@subtleforms/sdk';

const ability = useAbility('use', 'webhooks');
// { can, loading, ready, reason, upgradeMessage, requiredPlan }
```

#### `<Can>` / `<Cannot>`

Declarative capability checks.

```javascript
import { Can, Cannot } from '@subtleforms/sdk';

<Can I="use" a="webhooks">
  <WebhookSettings />
</Can>

<Cannot I="use" a="webhooks">
  <UpgradePrompt />
</Cannot>
```

### Utility Functions

#### `checkSDKCompatibility(requiredVersion, requiredFeatures?)`

Check SDK compatibility.

```javascript
const result = checkSDKCompatibility('1.0.0', {
  hooks: true,
  uiSlots: true
});

if (!result.compatible) {
  console.error(result.reason);
}
```

#### `getSDKInfo()`

Get SDK metadata.

```javascript
const info = getSDKInfo();
// { version, features, wordpress, php }
```

## TypeScript

Full TypeScript definitions included:

```typescript
import { 
  ExtensionConfig, 
  ExtensionAPI,
  registerExtension 
} from '@subtleforms/sdk';

const config: ExtensionConfig = {
  id: 'com.example.extension',
  name: 'My Extension',
  version: '1.0.0'
};

const api: ExtensionAPI = registerExtension(config);
```

## Examples

See [/examples/](/examples/) for complete working extensions:

- **basic-extension** - Hook usage fundamentals
- **ui-panel-extension** - Custom UI components
- **capability-extension** - Pro feature gating

## Documentation

- [Getting Started](/docs/getting-started.md)
- [Extension Guide](/docs/extension-guide.md)
- [Builder Hooks Reference](/docs/builder-hooks.md)
- [UI Extensions Guide](/docs/ui-extensions.md)
- [Capabilities Documentation](/docs/capabilities.md)
- [Migration Guide](/docs/migration-guide.md)
- [Support Guide](/docs/support.md)

## Version Compatibility

| SDK Version | SubtleForms | WordPress | PHP   |
|-------------|-------------|-----------|-------|
| 1.0.x       | ≥1.8.0      | ≥6.0      | ≥7.4  |

## Feature Availability

Current SDK features (v1.0.0):

- ✅ Hook System
- ✅ Builder Hooks
- ✅ UI Slots
- ✅ Capabilities
- ✅ Data Hooks
- ❌ Submission Hooks (planned 1.1)
- ❌ Custom Field Types (planned 1.2)
- ❌ REST Endpoints (planned 1.3)

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/subtleforms/subtleforms.git
cd subtleforms

# Install dependencies
npm install

# Build SDK
npm run build:sdk

# Output: sdk/dist/
```

### Testing

```bash
# Run tests
npm test

# With coverage
npm test -- --coverage
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](/CONTRIBUTING.md) for guidelines.

### Reporting Issues

- **Bugs:** [GitHub Issues](https://github.com/subtleforms/issues)
- **Security:** security@subtleforms.com
- **General:** [Discussion Forum](https://forum.subtleforms.com)

## Support

- **Documentation:** https://docs.subtleforms.com
- **Examples:** [/examples/](/examples/)
- **Community:** https://forum.subtleforms.com
- **Pro Support:** support@subtleforms.com

## License

GPL v2 or later. See [LICENSE](/LICENSE) for details.

## Changelog

See [CHANGELOG.md](/CHANGELOG.md) for version history.

---

Built with ❤️ by the SubtleForms team
