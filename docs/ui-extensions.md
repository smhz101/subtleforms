# UI Extensions Guide

Extend the SubtleForms UI by injecting custom React components into predefined slots.

## Overview

UI Slots allow extensions to add custom panels, controls, and components throughout the SubtleForms interface without modifying core code.

## Quick Start

```javascript
import { registerUISlot } from '@subtleforms/sdk';

registerUISlot('builder.sidebar.bottom', () => (
  <div className="my-extension-panel">
    <h3>Custom Panel</h3>
    <p>Extension content here</p>
  </div>
));
```

## Available Slots

### Builder Interface

**`builder.sidebar.top`**
- Location: Top of builder sidebar
- Use case: Quick actions, status displays
- Context: `schema`, `selectedNode`, `formId`

**`builder.sidebar.bottom`**
- Location: Bottom of builder sidebar
- Use case: Additional panels, help text
- Context: `schema`, `selectedNode`, `formId`

**`builder.toolbar.left`**
- Location: Left side of builder toolbar
- Use case: Custom tool buttons
- Context: `schema`, `formId`

**`builder.toolbar.right`**
- Location: Right side of builder toolbar
- Use case: Save actions, status indicators
- Context: `schema`, `formId`, `hasChanges`

**`builder.fieldSettings.top`**
- Location: Top of field settings panel
- Use case: Field-specific warnings
- Context: `schema`, `selectedNode`, `nodeId`

**`builder.fieldSettings.bottom`**
- Location: Bottom of field settings panel
- Use case: Additional field options
- Context: `schema`, `selectedNode`, `nodeId`

### Form List Interface

**`formList.table.actions`**
- Location: Form list row actions
- Use case: Custom actions per form
- Context: `form` (form object)

**`formList.header.actions`**
- Location: Form list header
- Use case: Bulk actions, filters
- Context: `forms` (array of forms)

### Settings Interface

**`settings.tabs.content`**
- Location: Settings tab content area
- Use case: Custom settings panels
- Context: `settings` (current settings)

## Slot Options

```javascript
registerUISlot(slotName, component, {
  priority: 10,           // Lower runs first (default: 10)
  shouldRender: (context) => true  // Conditional rendering
});
```

### Priority

Control rendering order when multiple extensions use the same slot:

```javascript
// Renders first
registerUISlot('builder.sidebar.bottom', Panel1, { priority: 5 });

// Renders second
registerUISlot('builder.sidebar.bottom', Panel2, { priority: 10 });
```

### Conditional Rendering

```javascript
registerUISlot('builder.fieldSettings.bottom', EnhancedOptions, {
  shouldRender: (context) => {
    // Only show for email fields
    return context.selectedNode?.type === 'email';
  }
});
```

## Component Development

### Using Context

Access slot context via props:

```javascript
const CustomPanel = ({ schema, selectedNode, formId }) => {
  // Access builder state
  const fieldCount = Object.keys(schema.nodes).length;
  const fieldType = selectedNode?.type;

  return (
    <div>
      <p>Form has {fieldCount} fields</p>
      {fieldType && <p>Selected: {fieldType}</p>}
    </div>
  );
};

registerUISlot('builder.sidebar.bottom', CustomPanel);
```

### Using Data Hooks

Fetch data inside components:

```javascript
import { useForms, useForm } from '@subtleforms/sdk';

const FormStats = ({ formId }) => {
  const { data: form, loading } = useForm(formId);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h4>{form.name}</h4>
      <p>Submissions: {form.submission_count}</p>
    </div>
  );
};
```

### Using Policy Layer

Check capabilities before rendering:

```javascript
import { Can } from '@subtleforms/sdk';

const ProFeaturePanel = () => (
  <Can I="use" a="advanced_analytics">
    <div className="analytics-panel">
      <h3>Analytics</h3>
      {/* Pro feature UI */}
    </div>
  </Can>
);
```

## Styling

### CSS Classes

Use SubtleForms CSS classes for consistency:

```javascript
const StyledPanel = () => (
  <div className="sf-panel">
    <h3 className="sf-panel-title">Title</h3>
    <div className="sf-panel-body">
      <button className="sf-button sf-button-primary">
        Action
      </button>
    </div>
  </div>
);
```

### Custom Styles

Load custom CSS via WordPress:

```php
function my_extension_styles() {
  wp_enqueue_style(
    'my-extension',
    plugins_url('assets/style.css', __FILE__),
    ['subtleforms-admin'],
    '1.0.0'
  );
}
add_action('admin_enqueue_scripts', 'my_extension_styles');
```

## Component Patterns

### Collapsible Panel

```javascript
import { useState } from 'react';

const CollapsiblePanel = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="sf-panel">
      <div 
        className="sf-panel-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3>{title}</h3>
        <span>{isOpen ? '−' : '+'}</span>
      </div>
      {isOpen && (
        <div className="sf-panel-body">{children}</div>
      )}
    </div>
  );
};

registerUISlot('builder.sidebar.bottom', () => (
  <CollapsiblePanel title="Custom Tools">
    <p>Panel content</p>
  </CollapsiblePanel>
));
```

### Action Button

```javascript
const QuickAction = ({ schema, formId }) => {
  const handleClick = async () => {
    try {
      await performAction(formId, schema);
      alert('Action completed!');
    } catch (error) {
      alert('Action failed: ' + error.message);
    }
  };

  return (
    <button 
      className="sf-button sf-button-secondary"
      onClick={handleClick}
    >
      Run Action
    </button>
  );
};
```

### Status Indicator

```javascript
const SyncStatus = ({ formId }) => {
  const { data: syncInfo } = useSyncStatus(formId);

  const statusClass = syncInfo?.synced 
    ? 'sf-status-success' 
    : 'sf-status-warning';

  return (
    <div className={`sf-status ${statusClass}`}>
      {syncInfo?.synced ? '✓ Synced' : '⟳ Syncing...'}
    </div>
  );
};
```

## Best Practices

### Do's

✅ Use semantic HTML  
✅ Follow SubtleForms design patterns  
✅ Handle loading states  
✅ Check capabilities  
✅ Clean up side effects  
✅ Test responsive behavior  
✅ Provide keyboard navigation  
✅ Use proper ARIA labels

### Don'ts

❌ Modify core DOM elements  
❌ Use inline styles extensively  
❌ Block UI with sync operations  
❌ Override core styles aggressively  
❌ Store sensitive data in client state  
❌ Ignore loading/error states

## Performance

### Lazy Loading

```javascript
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

registerUISlot('builder.sidebar.bottom', () => (
  <Suspense fallback={<div>Loading...</div>}>
    <HeavyComponent />
  </Suspense>
));
```

### Memoization

```javascript
import { memo } from 'react';

const ExpensivePanel = memo(({ schema }) => {
  const computedValue = expensiveCalculation(schema);
  return <div>{computedValue}</div>;
});
```

## Slot Constants

Use constants from SDK to avoid typos:

```javascript
import { UI_SLOTS } from '@subtleforms/sdk';

registerUISlot(UI_SLOTS.BUILDER_SIDEBAR_BOTTOM, MyComponent);
registerUISlot(UI_SLOTS.BUILDER_TOOLBAR_RIGHT, MyButton);
```

**Available Constants:**
- `BUILDER_SIDEBAR_TOP`
- `BUILDER_SIDEBAR_BOTTOM`
- `BUILDER_TOOLBAR_LEFT`
- `BUILDER_TOOLBAR_RIGHT`
- `BUILDER_FIELD_SETTINGS_TOP`
- `BUILDER_FIELD_SETTINGS_BOTTOM`
- `FORM_LIST_TABLE_ACTIONS`
- `FORM_LIST_HEADER_ACTIONS`
- `SETTINGS_TABS_CONTENT`

## Removing Slots

```javascript
// Store reference when registering
const unregister = registerUISlot(slotName, component);

// Remove later
unregister();
```

## Debugging

Enable dev mode to inspect registered slots:

```javascript
// In browser console
window.SubtleFormsSDK.getRegisteredSlots();
```

## Examples

### Complete Form Analytics Panel

```javascript
import { 
  registerUISlot, 
  useForm, 
  Can 
} from '@subtleforms/sdk';

const AnalyticsPanel = ({ formId }) => {
  const { data: form, loading } = useForm(formId);

  if (loading) {
    return <div className="sf-loading">Loading...</div>;
  }

  return (
    <Can I="view" a="analytics">
      <div className="sf-panel analytics-panel">
        <h3 className="sf-panel-title">Form Analytics</h3>
        <div className="sf-panel-body">
          <div className="stat">
            <label>Total Submissions</label>
            <strong>{form.submission_count}</strong>
          </div>
          <div className="stat">
            <label>Conversion Rate</label>
            <strong>{form.conversion_rate}%</strong>
          </div>
          <button className="sf-button sf-button-link">
            View Details →
          </button>
        </div>
      </div>
    </Can>
  );
};

registerUISlot('builder.sidebar.bottom', AnalyticsPanel, {
  priority: 5,
  shouldRender: (context) => context.formId != null
});
```

See `/examples/ui-panel-extension` for a complete working example.
