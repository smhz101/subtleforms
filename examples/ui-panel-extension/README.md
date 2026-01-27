# UI Panel Extension Example

SubtleForms extension demonstrating custom UI components and capability checks.

## What This Extension Does

- Adds a "Form Stats" panel to the builder sidebar
- Shows form field count and last modified date
- Demonstrates capability-gated Pro features
- Includes loading states and error handling

## Files

- `ui-panel-extension.php` - WordPress plugin file
- `index.js` - Extension entry point
- `FormStatsPanel.jsx` - React component
- `style.css` - Component styles
- `README.md` - This file

## Installation

1. Copy this folder to `wp-content/plugins/`
2. Activate "SubtleForms UI Panel Extension" in WordPress admin
3. SubtleForms must be installed and active

## Features

### Free Features
- Basic field count display
- Last modified timestamp
- Form name display

### Pro Features (Capability-Gated)
- Advanced analytics
- Submission count
- Conversion rate
- Export options

## Usage

Once activated:

1. Open any form in the SubtleForms builder
2. Look for the "Form Stats" panel at the bottom of the sidebar
3. Pro features show upgrade prompts if not licensed

## Code Walkthrough

### Extension Registration

```javascript
const api = registerExtension({
  id: 'com.example.ui-panel',
  name: 'UI Panel Extension',
  version: '1.0.0'
});
```

### UI Slot Registration

```javascript
api.addUISlot(UI_SLOTS.BUILDER_SIDEBAR_BOTTOM, FormStatsPanel, {
  priority: 10,
  shouldRender: (context) => context.formId != null
});
```

### Component with Data Hooks

```javascript
const FormStatsPanel = ({ schema, formId }) => {
  const { data: form, loading, error } = useForm(formId);
  
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  
  return <StatsDisplay form={form} schema={schema} />;
};
```

### Capability Checks

```javascript
import { Can, Cannot, useAbility } from '@subtleforms/sdk';

// Declarative (JSX)
<Can I="use" a="advanced_analytics">
  <AdvancedStats />
</Can>

// Programmatic (hook)
const analytics = useAbility('use', 'advanced_analytics');
if (analytics.can) {
  // Show Pro feature
}
```

## Component Structure

```
FormStatsPanel (Container)
├── LoadingState (loading)
├── ErrorState (error)
└── StatsDisplay
    ├── BasicStats (free)
    └── ProStats (capability-gated)
        ├── AdvancedMetrics (Can)
        └── UpgradePrompt (Cannot)
```

## Styling

The extension uses SubtleForms' CSS classes for consistency:

```css
.sf-panel { /* Panel container */ }
.sf-panel-header { /* Panel header */ }
.sf-panel-body { /* Panel body */ }
.sf-stat { /* Stat item */ }
.sf-button { /* Button */ }
.sf-upgrade-prompt { /* Upgrade message */ }
```

## Customization

### Change Panel Position

```javascript
// Bottom of sidebar (default)
api.addUISlot(UI_SLOTS.BUILDER_SIDEBAR_BOTTOM, Component);

// Top of sidebar
api.addUISlot(UI_SLOTS.BUILDER_SIDEBAR_TOP, Component);

// Toolbar
api.addUISlot(UI_SLOTS.BUILDER_TOOLBAR_RIGHT, Component);
```

### Add Custom Stats

```javascript
const CustomStats = ({ schema }) => {
  const emailFields = Object.values(schema.nodes)
    .filter(node => node.type === 'email').length;
  
  return (
    <div className="sf-stat">
      <label>Email Fields</label>
      <strong>{emailFields}</strong>
    </div>
  );
};
```

### Custom Capability

```javascript
api.addCapability('custom_feature', {
  description: 'Custom Feature',
  check: ({ license }) => license?.plan === 'pro',
  upgradeMessage: 'Upgrade to Pro for Custom Feature'
});

// Use in component
<Can I="use" a="custom_feature">
  <CustomFeature />
</Can>
```

## Testing

1. Activate the extension
2. Open a form in SubtleForms builder
3. Check bottom of sidebar for "Form Stats" panel
4. Test with both Free and Pro licenses (if available)

## Production Build

If using a build process:

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Output: build/index.js
```

## Next Steps

- Review [UI Extensions Guide](/docs/ui-extensions.md)
- Check [Capabilities Documentation](/docs/capabilities.md)
- Explore [Capability Extension](/examples/capability-extension)
