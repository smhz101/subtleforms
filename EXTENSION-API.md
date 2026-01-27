# SubtleForms Extension API

**Version:** 1.0.0  
**Stability:** Stable

This document describes the public, stable API for extending SubtleForms.

---

## Overview

SubtleForms provides a formal extension system for third-party addons and integrations. Extensions interact through stable, versioned APIs and cannot access internal implementation details.

### Design Principles

1. **Explicit Contracts**: Only documented APIs are supported
2. **Safety First**: Extensions cannot crash core
3. **Backward Compatibility**: Breaking changes require major version bump
4. **WordPress Patterns**: Follows WordPress hooks/filters convention

---

## Getting Started

### Registering an Extension

All extensions must register before using any APIs:

```javascript
import { registerExtension } from '@subtleforms/extensions';

const api = registerExtension({
  id: 'com.yourcompany.yourext',  // Unique ID (reverse domain)
  name: 'Your Extension',
  version: '1.0.0',                // Semantic version
  description: 'What it does',
  requires: ['builder', 'hooks'],  // Required core features
  initialize: () => {
    console.log('Extension loaded');
  },
  cleanup: () => {
    console.log('Extension unloaded');
  },
});
```

The registration returns an API object with methods:
- `addHook(name, callback, priority)`
- `addBuilderHook(name, callback, priority)`
- `addUISlot(name, component, options)`
- `addCapability(key, config)`
- `unregister()`

---

## Hook System

### Actions vs Filters

**Actions**: Execute side effects, no return value
**Filters**: Transform data, must return modified value

### Registering Hooks

```javascript
// Action hook
api.addHook('builder.afterSave', (payload) => {
  console.log('Form saved:', payload.formId);
});

// Filter hook
api.addHook('builder.beforeSave', (schema, context) => {
  // Modify and return schema
  return {
    ...schema,
    metadata: {
      ...schema.metadata,
      customField: 'value',
    },
  };
});
```

### Priority

Lower priority runs first (default: 10).

```javascript
api.addHook('builder.beforeSave', callback, 5); // Runs early
```

---

## Builder Hooks

Builder-specific lifecycle hooks for form construction.

### Available Hooks

#### Field Lifecycle

**`builder.beforeFieldInsert`** - Before inserting field  
Payload: `{ type, parentId, position, config }`  
Return: Modified payload or undefined

**`builder.afterFieldInsert`** - After inserting field  
Payload: `{ nodeId, type, parentId, schema }`

**`builder.beforeFieldDelete`** - Before deleting field  
Payload: `{ nodeId, schema }`  
Return: `false` to prevent deletion

**`builder.afterFieldDelete`** - After deleting field  
Payload: `{ nodeId, schema }`

**`builder.beforeFieldUpdate`** - Before updating config  
Payload: `{ nodeId, changes, currentConfig }`  
Return: Modified changes or undefined

**`builder.afterFieldUpdate`** - After updating config  
Payload: `{ nodeId, config, schema }`

**`builder.beforeFieldMove`** - Before moving field  
Payload: `{ nodeId, destination, schema }`

**`builder.afterFieldMove`** - After moving field  
Payload: `{ nodeId, destination, schema }`

**`builder.beforeFieldDuplicate`** - Before duplicating field  
Payload: `{ nodeId, schema }`

**`builder.afterFieldDuplicate`** - After duplicating field  
Payload: `{ originalId, newId, schema }`

#### Form Lifecycle

**`builder.beforeSave`** - Before saving form  
Payload: `{ schema, formId, status }`  
Return: Modified schema or undefined

**`builder.afterSave`** - After saving form  
Payload: `{ formId, schema, status, response }`

**`builder.beforeValidate`** - Before validating schema  
Payload: `{ schema }`  
Return: Modified schema or undefined

**`builder.afterValidate`** - After validating schema  
Payload: `{ schema, errors }`

#### Selection

**`builder.fieldSelected`** - When field selected  
Payload: `{ nodeId, schema }`

**`builder.fieldDeselected`** - When field deselected  
Payload: `{ nodeId, schema }`

### Example: Track Builder Activity

```javascript
api.addBuilderHook('afterFieldInsert', (payload) => {
  console.log(`Field ${payload.type} added`);
});

api.addBuilderHook('afterSave', (payload) => {
  console.log(`Form ${payload.formId} saved as ${payload.status}`);
});
```

---

## UI Slots

Inject custom React components at predefined locations.

### Available Slots

- `builder.toolbar.actions` - Builder header toolbar (right)
- `builder.sidebar.top` - Top of builder sidebar
- `builder.sidebar.bottom` - Bottom of builder sidebar
- `builder.inspector.field` - Field inspector panels
- `forms.list.actions` - Forms list bulk actions
- `forms.list.columns` - Custom table columns
- `templates.categories` - Template selector categories
- `settings.tabs` - Settings page tabs

### Registering Components

```javascript
const MyToolbarButton = ({ context }) => {
  return (
    <button onClick={() => console.log(context)}>
      My Action
    </button>
  );
};

api.addUISlot('builder.toolbar.actions', MyToolbarButton, {
  priority: 5,
  shouldRender: (context) => context.formType === 'payment',
});
```

### Context Prop

All slot components receive a `context` prop with:
- `formId` - Current form ID (if applicable)
- `formType` - Form type (regular, multistep, etc.)
- `schema` - Current schema (builder only)
- `selectedId` - Selected node ID (builder only)

---

## Custom Capabilities

Register custom Pro features with policy layer integration.

### Registering Capabilities

```javascript
api.addCapability('myext.feature', {
  description: 'My Advanced Feature',
  check: (license) => {
    return license.plan === 'business';
  },
  upgradeMessage: 'Upgrade to Business for this feature',
});
```

### Using Capabilities

Extensions use the same `useAbility` hook as core:

```javascript
import { useAbility } from '@subtleforms/policies';

const { can, loading, ready, reason } = useAbility('myext.feature');

if (!ready) return <Loading />;
if (!can) return <UpgradePrompt reason={reason} />;
return <MyFeature />;
```

---

## Safety Guarantees

### Extension Isolation

- Extensions cannot access internal components
- Core state is never exposed directly
- Extensions cannot modify DOM outside slots

### Error Handling

- Exceptions in hooks are caught and logged
- Failed extensions don't crash core
- Dev mode shows detailed errors

### Data Protection

- Schema modifications are validated
- Dangerous properties are sanitized
- Deep-frozen objects prevent mutation

### Rate Limiting

Extensions are rate-limited to prevent spam:
- Max 100 calls per hook per second
- Exceeded limits are logged

---

## Versioning & Compatibility

### API Versioning

Extensions can check API compatibility:

```javascript
import { isAPIVersionSupported, EXTENSION_API_VERSION } from '@subtleforms/extensions';

if (!isAPIVersionSupported('1.0.0')) {
  throw new Error('Requires SubtleForms Extension API 1.0.0+');
}

console.log('Current API:', EXTENSION_API_VERSION);
```

### Breaking Changes

Major version bumps (1.x → 2.x) may include breaking changes:
- Deprecated hooks removed
- API signatures changed
- Migration guides provided

Minor/patch versions (1.0.x → 1.1.x) are backward-compatible:
- New hooks added
- Bug fixes
- Performance improvements

---

## Best Practices

### Do's

✅ Register extension on load  
✅ Use namespaced IDs (`com.company.extension`)  
✅ Handle errors gracefully  
✅ Return modified data from filters  
✅ Test with different license states  
✅ Document required capabilities

### Don'ts

❌ Access `window.subtleformsInternal`  
❌ Mutate schema objects directly  
❌ Import internal components  
❌ Rely on DOM structure  
❌ Block UI with slow operations  
❌ Store sensitive data in extension state

---

## Debugging

### Development Mode

Enable dev mode for detailed logs:

```javascript
window.subtleformsAdmin.dev = true;
```

### Inspect Extensions

```javascript
// List registered extensions
window.subtleformsExtensions.registered();

// List active hooks
import { getRegisteredHooks } from '@subtleforms/extensions';
console.log(getRegisteredHooks());
```

---

## Examples

See `/extensions/examples.js` for complete working examples:

1. **Analytics Extension** - Track builder events
2. **Custom Validator** - Add validation logic
3. **Toolbar Button** - Inject UI component
4. **Custom Capability** - Register Pro feature
5. **Schema Transform** - Modify schema before validation

---

## Support

- **Documentation**: This file and inline JSDoc comments
- **API Reference**: `/extensions/index.js` exports
- **Examples**: `/extensions/examples.js`
- **Issues**: Check for API version compatibility first

---

## Changelog

### 1.0.0 (Phase 5)

- Initial stable release
- Hook system
- UI slots
- Builder hooks
- Custom capabilities
- Safety guards
