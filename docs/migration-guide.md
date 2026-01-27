# Migration Guide

Guide for upgrading extensions across SubtleForms SDK versions.

## Version Policy

SubtleForms SDK follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.x → 2.x): Breaking changes - manual migration required
- **MINOR** (1.0 → 1.1): New features - backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes - drop-in replacement

## Checking Compatibility

Always check compatibility on extension load:

```javascript
import { checkSDKCompatibility } from '@subtleforms/sdk';

const compatibility = checkSDKCompatibility('1.0.0', {
  hooks: true,
  uiSlots: true
});

if (!compatibility.compatible) {
  console.error('Incompatible SDK:', compatibility.reason);
  return;
}
```

## Migration Paths

### v1.0 to v1.1 (Minor)

**Changes:**
- Added `submissionHooks` feature (currently false)
- Added `getSDKInfo()` function

**Migration:**
No changes required - fully backward compatible.

**Optional Enhancements:**
```javascript
// Check for new features
const info = getSDKInfo();
if (info.features.submissionHooks) {
  // Use new submission hooks
  api.addAction('submission.beforeCreate', handler);
}
```

### Future: v1.x to v2.0 (Major - Hypothetical)

This section documents potential breaking changes for future major versions.

**Potential Breaking Changes:**
- Hook name changes
- API signature changes
- Removed deprecated features

**Example Migration:**

```javascript
// v1.x (old)
api.addHook('beforeFieldInsert', handler);

// v2.x (new)
api.addBuilderHook('builder.beforeFieldInsert', handler);
```

**Backward Compatibility Layer:**

```javascript
// Support both versions
if (api.addBuilderHook) {
  // v2.x
  api.addBuilderHook('builder.beforeFieldInsert', handler);
} else {
  // v1.x fallback
  api.addHook('beforeFieldInsert', handler);
}
```

## Deprecation Policy

SubtleForms follows a graceful deprecation policy:

1. **Announce**: Deprecation notice in docs and console warnings
2. **Grace Period**: Feature remains functional for at least 2 minor versions
3. **Remove**: Breaking removal only in major version bump

**Example Console Warning:**
```
⚠️ Warning: api.addHook() is deprecated. Use api.addBuilderHook() instead.
This will be removed in v2.0.0. See migration guide: https://...
```

## Feature Detection

Use feature flags to adapt to available capabilities:

```javascript
import { SDK_FEATURES, getSDKInfo } from '@subtleforms/sdk';

const info = getSDKInfo();

if (info.features.submissionHooks) {
  // Use submission hooks
  registerSubmissionHooks(api);
} else {
  // Fallback to workaround
  console.log('Submission hooks not available yet');
}
```

## Breaking Change Checklist

When updating your extension for a major SDK version:

- [ ] Read full changelog
- [ ] Update SDK version in `package.json`
- [ ] Update `requires.subtleforms` in extension config
- [ ] Search codebase for deprecated APIs
- [ ] Update hook names/signatures
- [ ] Update UI slot names
- [ ] Test all functionality
- [ ] Update documentation
- [ ] Test with both old and new SubtleForms versions (if supporting both)

## Hook Name Changes

If hook names change, update all references:

```javascript
// Find all hook registrations
grep -r "addAction\|addFilter\|addBuilderHook" src/
```

**Migration Script Example:**

```bash
# Find and replace hook names
find src/ -name "*.js" -exec sed -i '' \
  's/beforeFieldInsert/builder.beforeFieldInsert/g' {} +
```

## Capability Changes

If capability names change:

```javascript
// Old
<Can I="use" a="pro_feature" />

// New
<Can I="use" a="premium_feature" />

// Transition - support both
const FeatureComponent = () => {
  const newCap = useAbility('use', 'premium_feature');
  const oldCap = useAbility('use', 'pro_feature');
  
  const allowed = newCap.can || oldCap.can;
  
  return allowed ? <Feature /> : <Upgrade />;
};
```

## Data Structure Changes

If schema or payload structures change:

```javascript
// v1.x
api.addFilter('builder.beforeSave', (payload) => {
  const nodes = payload.schema.nodes;
  // ...
});

// v2.x (hypothetical - nodes → fields)
api.addFilter('builder.beforeSave', (payload) => {
  const fields = payload.schema.fields || payload.schema.nodes;
  // ...
});
```

## Testing Migrations

### Version Matrix Testing

Test your extension with multiple SubtleForms versions:

```json
{
  "devDependencies": {
    "@subtleforms/sdk": "^1.0.0"  // Current
  }
}
```

**Test Script:**
```bash
#!/bin/bash
# Test against multiple versions

for version in "1.0.0" "1.1.0" "2.0.0"; do
  npm install --no-save @subtleforms/sdk@$version
  npm test
done
```

### Compatibility Tests

```javascript
// __tests__/compatibility.test.js
import { getSDKInfo } from '@subtleforms/sdk';

describe('SDK Compatibility', () => {
  test('supports required features', () => {
    const info = getSDKInfo();
    expect(info.features.hooks).toBe(true);
    expect(info.features.uiSlots).toBe(true);
  });

  test('meets minimum version', () => {
    const info = getSDKInfo();
    const [major, minor] = info.version.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(1);
  });
});
```

## Documentation Updates

Update your extension's documentation:

1. **README.md**: Update "Requirements" section
   ```markdown
   ## Requirements
   - SubtleForms >= 1.8.0
   - WordPress >= 6.0
   - PHP >= 7.4
   ```

2. **CHANGELOG.md**: Document breaking changes
   ```markdown
   ## [2.0.0] - 2024-01-01
   ### BREAKING CHANGES
   - Updated for SubtleForms SDK 2.0
   - Renamed hooks: `beforeFieldInsert` → `builder.beforeFieldInsert`
   - Removed deprecated `api.addHook()` method
   ```

3. **Migration Guide**: Provide step-by-step instructions
   ```markdown
   ## Upgrading from v1.x to v2.x
   1. Update SubtleForms to v2.0+
   2. Replace all `api.addHook()` with `api.addBuilderHook()`
   3. Update hook names (see table below)
   4. Test thoroughly
   ```

## Version Support

### Maintaining Multiple Versions

If supporting both old and new SubtleForms:

```javascript
// extension.js
import { getSDKInfo } from '@subtleforms/sdk';

const info = getSDKInfo();
const [major] = info.version.split('.').map(Number);

if (major >= 2) {
  // Use v2.x APIs
  require('./v2/hooks');
} else {
  // Use v1.x APIs
  require('./v1/hooks');
}
```

### Dropping Old Versions

When dropping support for older versions:

1. Update `requires.subtleforms` in extension config
2. Remove compatibility shims
3. Document in changelog
4. Bump major version of your extension

```javascript
// Before
requires: {
  subtleforms: '>=1.8.0'
}

// After
requires: {
  subtleforms: '>=2.0.0'
}
```

## Common Migration Scenarios

### Scenario 1: Hook Signature Change

```javascript
// v1.x - returns modified payload
api.addFilter('beforeSave', (payload) => {
  return { ...payload, modified: true };
});

// v2.x - returns just the modified field
api.addFilter('beforeSave', (schema, context) => {
  return { ...schema, modified: true };
});

// Adaptation
api.addFilter('beforeSave', (...args) => {
  if (args.length === 1) {
    // v1.x
    return { ...args[0], modified: true };
  } else {
    // v2.x
    return { ...args[0], modified: true };
  }
});
```

### Scenario 2: Removed Feature

```javascript
// v1.x - deprecated feature
api.registerCustomFieldType('my-field', config);

// v2.x - feature removed, use alternative
api.registerFieldRenderer('my-field', {
  component: MyFieldComponent,
  validator: myValidator
});
```

### Scenario 3: Renamed Exports

```javascript
// v1.x
import { Can, Cannot } from '@subtleforms/sdk/policy';

// v2.x
import { Can, Cannot } from '@subtleforms/sdk';

// Transition - try new import first
let Can, Cannot;
try {
  ({ Can, Cannot } = require('@subtleforms/sdk'));
} catch {
  ({ Can, Cannot } = require('@subtleforms/sdk/policy'));
}
```

## Rollback Plan

If migration fails:

1. **Revert package.json**:
   ```json
   {
     "dependencies": {
       "@subtleforms/sdk": "1.0.0"  // Pin to working version
     }
   }
   ```

2. **Document Issues**: Report bugs to SubtleForms
3. **Communicate**: Inform users about compatibility
4. **Temporary Fork**: If critical, fork and patch

## Future-Proofing

Write extensions that adapt to changes:

```javascript
// Feature detection
const hasFeature = (feature) => {
  const info = getSDKInfo();
  return info.features[feature] === true;
};

// Conditional registration
if (hasFeature('submissionHooks')) {
  api.addAction('submission.beforeCreate', handler);
} else {
  // Polyfill or skip
  console.log('Submission hooks not available');
}
```

## Resources

- [Changelog](https://github.com/subtleforms/changelog)
- [SDK Documentation](https://docs.subtleforms.com)
- [Support Forum](https://forum.subtleforms.com)
- [GitHub Issues](https://github.com/subtleforms/issues)

## Questions?

If you encounter migration issues:
1. Check [GitHub Issues](https://github.com/subtleforms/issues) for known problems
2. Review [migration examples](https://github.com/subtleforms/examples)
3. Ask in [support forum](https://forum.subtleforms.com)
4. Report bugs with reproduction steps
