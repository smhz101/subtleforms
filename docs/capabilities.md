# Capabilities & Pro Features

Integrate with SubtleForms' policy-based access control to offer Pro features in your extensions.

## Overview

SubtleForms uses a capability-based system to gate Pro features. Extensions can:
1. Check existing capabilities (e.g., "use advanced_fields")
2. Register custom capabilities (e.g., "use my_custom_feature")
3. Show upgrade prompts for locked features

## Policy Layer

### Can Component

Conditionally render UI based on capabilities:

```javascript
import { Can } from '@subtleforms/sdk';

const ProFeature = () => (
  <Can I="use" a="advanced_analytics">
    <div className="analytics-panel">
      {/* Pro feature content */}
    </div>
  </Can>
);
```

**Props:**
- `I` - Action (e.g., "use", "edit", "view")
- `a` - Subject (capability name)
- `passThrough` - Render even if not allowed (for custom handling)
- `children` - Content to render if allowed

### Cannot Component

Show upgrade prompts when capability is missing:

```javascript
import { Cannot } from '@subtleforms/sdk';

const UpgradePrompt = () => (
  <Cannot I="use" a="advanced_analytics">
    <div className="sf-upgrade-prompt">
      <p>Upgrade to Pro for Advanced Analytics</p>
      <a href="/upgrade" className="sf-button sf-button-primary">
        Upgrade Now
      </a>
    </div>
  </Cannot>
);
```

### useAbility Hook

Programmatic capability checks:

```javascript
import { useAbility } from '@subtleforms/sdk';

const SmartComponent = () => {
  const analytics = useAbility('use', 'advanced_analytics');

  if (analytics.loading) {
    return <div>Loading...</div>;
  }

  if (!analytics.can) {
    return (
      <div className="locked-feature">
        <p>{analytics.reason || 'Upgrade required'}</p>
      </div>
    );
  }

  return <div>Pro feature active!</div>;
};
```

**Return Value:**
```javascript
{
  can: boolean,           // Whether action is allowed
  loading: boolean,       // Policy still loading
  ready: boolean,         // Policy loaded
  reason: string | null,  // Why action is denied
  upgradeMessage: string | null, // Custom upgrade message
  requiredPlan: string | null    // Required license plan
}
```

## Built-in Capabilities

SubtleForms provides these capabilities:

### Field Types

- `use.basic_fields` - Text, email, textarea (always true)
- `use.advanced_fields` - File upload, signature, rating (Pro)
- `use.layout_fields` - Multi-column, sections (Pro)

### Builder Features

- `use.conditional_logic` - Show/hide fields conditionally (Pro)
- `use.calculations` - Field calculations (Pro)
- `use.custom_validation` - Advanced validation rules (Pro)

### Integrations

- `use.webhooks` - Webhook integrations (Pro)
- `use.api_access` - REST API access (Pro)
- `use.email_marketing` - Email service integrations (Pro)

### Analytics & Reporting

- `use.advanced_analytics` - Detailed analytics (Pro)
- `use.export_submissions` - Export to CSV/PDF (Pro)
- `use.submission_editing` - Edit submitted data (Pro)

### Branding

- `use.remove_branding` - Remove "Powered by SubtleForms" (Pro)
- `use.custom_css` - Custom CSS injection (Pro)

## Registering Custom Capabilities

Extensions can register their own capabilities:

```javascript
api.registerCapability('my_custom_feature', {
  description: 'My Custom Pro Feature',
  check: ({ license, plan }) => {
    // Return true if allowed
    return plan === 'pro' || plan === 'agency';
  },
  upgradeMessage: 'Upgrade to Pro to unlock My Custom Feature'
});
```

### Check Function

The `check` function receives context:

```javascript
{
  license: {
    plan: 'free' | 'pro' | 'agency',
    status: 'active' | 'expired' | 'invalid',
    expiresAt: string | null
  },
  user: {
    id: number,
    roles: string[],
    capabilities: object
  },
  form: object | null  // Current form (if applicable)
}
```

**Examples:**

```javascript
// Require Pro or Agency
check: ({ plan }) => ['pro', 'agency'].includes(plan)

// Require active license
check: ({ license }) => license.status === 'active'

// Require WordPress capability
check: ({ user }) => user.capabilities.manage_options

// Conditional on form type
check: ({ form, plan }) => {
  if (form?.type === 'payment') {
    return plan === 'agency';
  }
  return plan === 'pro';
}
```

## Upgrade Messages

### Default Messages

SubtleForms shows default upgrade prompts:

```javascript
<Can I="use" a="advanced_analytics">
  <AnalyticsPanel />
</Can>
// If denied, shows: "Upgrade to Pro for Advanced Analytics"
```

### Custom Messages

Provide custom upgrade messages:

```javascript
api.registerCapability('custom_exports', {
  description: 'Custom Export Formats',
  check: ({ plan }) => plan === 'agency',
  upgradeMessage: 'Agency plan required for custom export formats. Includes XML, JSON, and custom templates.'
});
```

### Programmatic Messages

```javascript
import { getUpgradeMessage } from '@subtleforms/sdk';

const FeatureButton = () => {
  const ability = useAbility('use', 'webhooks');
  
  const handleClick = () => {
    if (!ability.can) {
      const message = getUpgradeMessage('webhooks');
      alert(message);
      return;
    }
    
    // Execute feature
  };

  return (
    <button onClick={handleClick}>
      Enable Webhooks
    </button>
  );
};
```

## Combining Capabilities

### Multiple Requirements

```javascript
const MultiFeature = () => {
  const webhooks = useAbility('use', 'webhooks');
  const analytics = useAbility('use', 'advanced_analytics');

  const canUse = webhooks.can && analytics.can;

  if (!canUse) {
    return <UpgradePrompt />;
  }

  return <AdvancedFeature />;
};
```

### Any Of Requirements

```javascript
const FlexibleFeature = () => {
  const export1 = useAbility('use', 'export_csv');
  const export2 = useAbility('use', 'export_pdf');

  const canExport = export1.can || export2.can;

  if (!canExport) {
    return <p>No export capabilities available</p>;
  }

  return <ExportOptions />;
};
```

## License Information

### useLicense Hook

Access license details:

```javascript
import { useLicense } from '@subtleforms/sdk';

const LicenseInfo = () => {
  const { data: license, loading } = useLicense();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <p>Plan: {license.plan}</p>
      <p>Status: {license.status}</p>
      {license.expiresAt && (
        <p>Expires: {new Date(license.expiresAt).toLocaleDateString()}</p>
      )}
    </div>
  );
};
```

**License Object:**
```javascript
{
  plan: 'free' | 'pro' | 'agency',
  status: 'active' | 'expired' | 'invalid',
  expiresAt: string | null,
  key: string | null,
  activationsUsed: number,
  activationsLimit: number
}
```

## UI Patterns

### Feature Lock Overlay

```javascript
import { Can, Cannot } from '@subtleforms/sdk';

const LockedFeature = ({ children }) => (
  <div className="feature-container">
    <Can I="use" a="advanced_feature">
      {children}
    </Can>
    <Cannot I="use" a="advanced_feature">
      <div className="feature-lock-overlay">
        <div className="lock-icon">🔒</div>
        <h3>Pro Feature</h3>
        <p>Upgrade to unlock advanced features</p>
        <button className="sf-button sf-button-primary">
          Upgrade Now
        </button>
      </div>
    </Cannot>
  </div>
);
```

### Inline Badge

```javascript
const FeatureLabel = ({ feature, children }) => {
  const ability = useAbility('use', feature);

  return (
    <span>
      {children}
      {!ability.can && (
        <span className="sf-badge sf-badge-pro">PRO</span>
      )}
    </span>
  );
};

// Usage
<FeatureLabel feature="webhooks">
  Enable Webhooks
</FeatureLabel>
```

### Progressive Disclosure

```javascript
const ProgressiveFeature = () => {
  const ability = useAbility('use', 'advanced_analytics');

  return (
    <div>
      {/* Basic feature - always visible */}
      <BasicAnalytics />

      {/* Advanced feature - conditional */}
      {ability.can ? (
        <AdvancedAnalytics />
      ) : (
        <div className="upgrade-cta">
          <p>Get deeper insights with Pro Analytics</p>
          <button>Learn More</button>
        </div>
      )}
    </div>
  );
};
```

## Best Practices

### Do's

✅ Check capabilities before rendering Pro features  
✅ Provide clear upgrade messages  
✅ Use consistent "Pro" badges  
✅ Show value before asking to upgrade  
✅ Handle loading states  
✅ Respect license status  
✅ Test with both Free and Pro licenses

### Don'ts

❌ Hide features without explanation  
❌ Show broken UI for locked features  
❌ Ignore license expiration  
❌ Hardcode plan requirements  
❌ Skip loading states  
❌ Assume license is always valid

## Testing Capabilities

### Mock License

```javascript
// In development
window.subtleFormsData = {
  license: {
    plan: 'pro',  // Test Pro features
    status: 'active'
  }
};
```

### Test Matrix

Test your extension with:
- Free plan (no license)
- Pro plan (active)
- Pro plan (expired)
- Agency plan (active)

## WordPress Integration

### Capability Mapping

Map SubtleForms capabilities to WordPress capabilities:

```javascript
api.registerCapability('manage_forms', {
  description: 'Manage Forms',
  check: ({ user }) => {
    return user.capabilities.edit_posts;
  }
});
```

### Role-Based Access

```javascript
api.registerCapability('advanced_settings', {
  description: 'Advanced Settings',
  check: ({ user }) => {
    return user.roles.includes('administrator');
  }
});
```

## Migration Guide

### v1.0 to v2.0

If capability names change:

```javascript
// Old (deprecated)
<Can I="use" a="pro_analytics" />

// New (recommended)
<Can I="use" a="advanced_analytics" />

// Support both during transition
const Analytics = () => {
  const newCap = useAbility('use', 'advanced_analytics');
  const oldCap = useAbility('use', 'pro_analytics');
  
  const canUse = newCap.can || oldCap.can;
  
  return canUse ? <Panel /> : <Upgrade />;
};
```

## Examples

See `/examples/ui-panel-extension` for a complete example of capability-gated features.

## Reference

- [Extension Guide](extension-guide.md) - General extension development
- [UI Extensions](ui-extensions.md) - UI component patterns
- [Builder Hooks](builder-hooks.md) - Hook system
