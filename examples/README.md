# SubtleForms Extension Examples

Working code examples demonstrating SubtleForms SDK usage.

## Examples

### 1. Basic Extension
**Location:** `/examples/basic-extension/`

Minimal extension demonstrating:
- Extension registration
- SDK compatibility checking
- Action hooks (event logging)
- Filter hooks (data transformation)
- Hook priorities
- Validation and prevention

**Use this when:**
- Building your first extension
- Learning hook system basics
- Need simple event tracking
- Want to modify form data

### 2. UI Panel Extension
**Location:** `/examples/ui-panel-extension/`

Custom UI component demonstrating:
- UI slot registration
- React component integration
- Data fetching with hooks
- Capability-gated features
- Loading and error states
- Custom styling

**Use this when:**
- Adding custom UI to builder
- Need to display data
- Want Pro/Free feature gating
- Building admin panels

### 3. Capability Extension
**Location:** `/examples/capability-extension/`

Custom capability demonstrating:
- Capability registration
- License-based access control
- Policy layer integration
- Upgrade messaging
- Feature flags

**Use this when:**
- Offering Pro features
- Need license checking
- Building paid extensions
- Controlling feature access

## Getting Started

### Prerequisites

All examples require:
- SubtleForms 1.8.0 or later
- WordPress 6.0 or later
- PHP 7.4 or later

### Installation

Each example is a complete WordPress plugin:

1. **Copy to plugins directory:**
   ```bash
   cp -r examples/basic-extension /path/to/wordpress/wp-content/plugins/
   ```

2. **Activate in WordPress:**
   - Go to Plugins → Installed Plugins
   - Find the example extension
   - Click "Activate"

3. **Verify:**
   - Open browser console (F12)
   - Look for initialization message
   - Test extension functionality

### Quick Test

```bash
# Install all examples
cd /path/to/wordpress/wp-content/plugins/
cp -r /path/to/subtleforms/examples/* .

# Activate via WP-CLI
wp plugin activate subtleforms-basic-extension
wp plugin activate subtleforms-ui-panel-extension
wp plugin activate subtleforms-capability-extension
```

## Running Examples

### Basic Extension

1. Activate plugin
2. Open a form in SubtleForms builder
3. Open browser console (F12)
4. Save the form
5. See console messages

### UI Panel Extension

1. Activate plugin
2. Open a form in SubtleForms builder
3. Look for "Form Stats" panel in sidebar
4. Test Pro features (if licensed)

### Capability Extension

1. Activate plugin
2. Check builder for custom capability indicators
3. Test with Free and Pro licenses
4. Verify upgrade prompts

## Modifying Examples

### Change Hook Behavior

```javascript
// In basic-extension/index.js

// Add your own hook
api.addBuilderHook(BUILDER_HOOKS.AFTER_FIELD_INSERT, (payload) => {
  console.log('Custom handler:', payload);
});
```

### Add UI Components

```javascript
// In ui-panel-extension/index.js

const MyComponent = ({ formId, schema }) => {
  return <div>My custom content</div>;
};

api.addUISlot(UI_SLOTS.BUILDER_SIDEBAR_TOP, MyComponent);
```

### Register Capabilities

```javascript
// In capability-extension/index.js

api.addCapability('my_feature', {
  description: 'My Custom Feature',
  check: ({ license }) => license?.plan === 'pro',
  upgradeMessage: 'Upgrade for My Feature'
});
```

## Building for Production

### Setup Build Process

```bash
cd examples/basic-extension/

# Initialize npm
npm init -y

# Install dependencies
npm install --save-dev webpack webpack-cli @babel/core @babel/preset-react babel-loader

# Create webpack.config.js
cat > webpack.config.js << 'EOF'
module.exports = {
  entry: './src/index.js',
  output: {
    path: __dirname + '/build',
    filename: 'index.js'
  },
  externals: {
    '@subtleforms/sdk': 'SubtleFormsSDK',
    'react': 'React',
    'react-dom': 'ReactDOM'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  }
};
EOF

# Build
npm run build
```

### Package.json Example

```json
{
  "name": "subtleforms-my-extension",
  "version": "1.0.0",
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch",
    "test": "jest"
  },
  "devDependencies": {
    "@babel/core": "^7.23.0",
    "@babel/preset-react": "^7.22.0",
    "babel-loader": "^9.1.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.0"
  }
}
```

## Testing Examples

### Manual Testing

1. **Functionality:** Does it work as described?
2. **Console:** Any errors or warnings?
3. **Performance:** Is it responsive?
4. **Compatibility:** Works with latest SubtleForms?

### Automated Testing

```javascript
// __tests__/extension.test.js
import { registerExtension } from '@subtleforms/sdk';

describe('Extension', () => {
  test('registers successfully', () => {
    const api = registerExtension({
      id: 'com.test.extension',
      name: 'Test',
      version: '1.0.0'
    });
    
    expect(api).toBeDefined();
    expect(api.addHook).toBeFunction();
  });
});
```

## Troubleshooting

### Extension Not Loading

**Check:**
- SubtleForms is activated
- Extension script is enqueued
- Dependencies are correct (`subtleforms-admin`)
- No JavaScript errors in console

**Debug:**
```javascript
// Add to extension entry point
console.log('Extension loaded:', window.SubtleFormsSDK);
```

### Hooks Not Firing

**Check:**
- Hook name is correct
- Using correct hook type (action vs filter)
- Priority is set appropriately
- Hook is registered before event occurs

**Debug:**
```javascript
// Log all registered hooks
console.log(window.SubtleFormsSDK.getRegisteredHooks());
```

### UI Not Appearing

**Check:**
- Slot name is correct
- Component renders without errors
- `shouldRender` returns true
- CSS is loaded

**Debug:**
```javascript
// Log registered slots
console.log(window.SubtleFormsSDK.getRegisteredSlots());
```

## Best Practices

### Code Organization

```
my-extension/
├── src/
│   ├── index.js          # Entry point
│   ├── components/       # React components
│   ├── hooks/            # Hook handlers
│   └── utils/            # Utilities
├── build/                # Compiled output
├── tests/                # Tests
└── assets/               # CSS, images
```

### Error Handling

```javascript
api.addBuilderHook('beforeSave', (payload) => {
  try {
    return processPayload(payload);
  } catch (error) {
    console.error('Processing failed:', error);
    return payload; // Return original on error
  }
});
```

### Performance

- Debounce expensive operations
- Memoize computed values
- Lazy load heavy components
- Keep hooks fast (< 100ms)

### Security

- Sanitize user input
- Check capabilities
- Validate data types
- Use nonces for AJAX

## Resources

### Documentation
- [Getting Started](/docs/getting-started.md)
- [Extension Guide](/docs/extension-guide.md)
- [Builder Hooks](/docs/builder-hooks.md)
- [UI Extensions](/docs/ui-extensions.md)
- [Capabilities](/docs/capabilities.md)

### SDK Reference
- [API Documentation](/sdk/)
- [TypeScript Definitions](/sdk/index.d.ts)

### Support
- [GitHub Issues](https://github.com/subtleforms/issues)
- [Discussion Forum](https://forum.subtleforms.com)
- [Documentation](https://docs.subtleforms.com)

## Contributing

Found an issue with an example? Want to add a new one?

1. Fork the repository
2. Create your branch: `git checkout -b example/my-example`
3. Commit changes: `git commit -am 'Add my example'`
4. Push to branch: `git push origin example/my-example`
5. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

All examples are released under GPL v2 or later, same as SubtleForms core.

You may use these examples as starting points for your own extensions under any license.
