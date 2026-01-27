# Extension Development Guide

Deep dive into building robust SubtleForms extensions.

## Table of Contents

1. [Extension Lifecycle](#extension-lifecycle)
2. [Architecture Patterns](#architecture-patterns)
3. [State Management](#state-management)
4. [Error Handling](#error-handling)
5. [Testing](#testing)
6. [Distribution](#distribution)

## Extension Lifecycle

### Registration Phase

Extensions register during WordPress `admin_enqueue_scripts`:

```php
function my_extension_init() {
  if (!function_exists('subtleforms')) {
    return; // SubtleForms not active
  }

  wp_enqueue_script(
    'my-extension',
    plugins_url('build/index.js', __FILE__),
    ['subtleforms-admin'],
    '1.0.0',
    true
  );
}
add_action('admin_enqueue_scripts', 'my_extension_init');
```

### Initialization

Check compatibility and register:

```javascript
import { 
  checkSDKCompatibility, 
  registerExtension 
} from '@subtleforms/sdk';

// Verify SubtleForms version
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
  id: 'my-extension',
  name: 'My Extension',
  version: '1.0.0',
  requires: {
    subtleforms: '>=1.8.0',
    php: '>=7.4',
  }
});
```

### Activation

Add hooks and UI components:

```javascript
// Add hooks
api.addAction('builder.afterSave', handleFormSave);
api.addFilter('builder.beforeSave', validateBeforeSave);

// Register UI slots
api.registerUISlot('builder.sidebar.bottom', CustomPanel);

// Register capabilities
api.registerCapability('custom_feature', {
  description: 'Custom Feature',
  check: ({ license }) => license?.plan === 'pro',
  upgradeMessage: 'Upgrade to Pro for this feature'
});
```

### Lifecycle Hooks

Extensions can react to platform events:

```javascript
// Platform ready
api.onReady(() => {
  console.log('SubtleForms ready');
});

// Extension unload (rare)
api.onUnload(() => {
  // Cleanup resources
});
```

## Architecture Patterns

### Service-Based Architecture

Organize extension logic into services:

```
my-extension/
├── src/
│   ├── index.js           # Entry point
│   ├── services/
│   │   ├── analytics.js   # Analytics service
│   │   ├── sync.js        # Sync service
│   │   └── validation.js  # Validation service
│   ├── components/
│   │   ├── Panel.jsx      # UI components
│   │   └── Settings.jsx
│   └── hooks/
│       ├── builder.js     # Builder hooks
│       └── submission.js  # Submission hooks
├── build/                 # Compiled output
└── assets/                # CSS, images
```

**Example Service:**

```javascript
// services/analytics.js
export class AnalyticsService {
  constructor(api) {
    this.api = api;
    this.initialize();
  }

  initialize() {
    this.api.addAction('builder.afterSave', this.track.bind(this));
  }

  track(payload) {
    // Send analytics event
    this.send('form_saved', {
      formId: payload.formId,
      fieldCount: Object.keys(payload.schema.nodes).length
    });
  }

  send(event, data) {
    // Implementation
  }
}
```

**Entry Point:**

```javascript
// index.js
import { registerExtension } from '@subtleforms/sdk';
import { AnalyticsService } from './services/analytics';
import { Panel } from './components/Panel';

const api = registerExtension({...});

// Initialize services
const analytics = new AnalyticsService(api);

// Register UI
api.registerUISlot('builder.sidebar.bottom', Panel);
```

### Plugin Pattern

For modular functionality:

```javascript
class ExtensionPlugin {
  constructor(api) {
    this.api = api;
  }

  install() {
    // Override in subclasses
  }

  uninstall() {
    // Cleanup
  }
}

class ValidationPlugin extends ExtensionPlugin {
  install() {
    this.api.addFilter('builder.beforeSave', this.validate);
  }

  validate(payload) {
    // Validation logic
    return payload;
  }
}

// Usage
const validation = new ValidationPlugin(api);
validation.install();
```

## State Management

### Using React Query (Recommended)

Extensions inherit SubtleForms' React Query instance:

```javascript
import { useForm, useForms } from '@subtleforms/sdk';

const MyComponent = ({ formId }) => {
  // Automatically cached and synced
  const { data: form, loading, error } = useForm(formId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{form.name}</div>;
};
```

### Custom Queries

```javascript
import { useQuery } from '@tanstack/react-query';

const useCustomData = (formId) => {
  return useQuery({
    queryKey: ['myExtension', 'customData', formId],
    queryFn: async () => {
      const response = await fetch(`/wp-json/my-extension/v1/data/${formId}`);
      return response.json();
    },
    staleTime: 60000 // 1 minute
  });
};
```

### Local State

Use React hooks for component state:

```javascript
import { useState, useEffect } from 'react';

const StatefulComponent = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Side effects
    return () => {
      // Cleanup
    };
  }, [count]);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
};
```

## Error Handling

### Hook Error Boundaries

Hook errors are caught and logged:

```javascript
api.addFilter('builder.beforeSave', (payload) => {
  try {
    return processSchema(payload.schema);
  } catch (error) {
    console.error('Processing failed:', error);
    return payload.schema; // Return original on error
  }
});
```

### Component Error Boundaries

```javascript
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Extension error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="sf-error">
          <h4>Extension Error</h4>
          <p>{this.state.error.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrap components
api.registerUISlot('builder.sidebar.bottom', () => (
  <ErrorBoundary>
    <MyComponent />
  </ErrorBoundary>
));
```

### Network Error Handling

```javascript
const useRobustData = (formId) => {
  const query = useForm(formId);

  if (query.error) {
    // Retry logic
    if (query.failureCount < 3) {
      query.refetch();
    }
  }

  return query;
};
```

## Testing

### Unit Testing

Test services and utilities:

```javascript
// __tests__/services/analytics.test.js
import { AnalyticsService } from '../services/analytics';

describe('AnalyticsService', () => {
  let service;
  let mockApi;

  beforeEach(() => {
    mockApi = {
      addAction: jest.fn()
    };
    service = new AnalyticsService(mockApi);
  });

  test('registers hooks on initialization', () => {
    expect(mockApi.addAction).toHaveBeenCalledWith(
      'builder.afterSave',
      expect.any(Function)
    );
  });

  test('tracks events correctly', () => {
    const spy = jest.spyOn(service, 'send');
    service.track({ formId: 123, schema: { nodes: {} } });
    expect(spy).toHaveBeenCalledWith('form_saved', expect.any(Object));
  });
});
```

### Component Testing

```javascript
// __tests__/components/Panel.test.jsx
import { render, screen } from '@testing-library/react';
import { Panel } from '../components/Panel';

test('renders panel with form data', () => {
  render(<Panel formId={123} />);
  expect(screen.getByText(/Form/i)).toBeInTheDocument();
});
```

### Integration Testing

Test with SubtleForms:

```javascript
// __tests__/integration.test.js
import { registerExtension } from '@subtleforms/sdk';

describe('Extension Integration', () => {
  let api;

  beforeAll(() => {
    api = registerExtension({
      id: 'test-extension',
      name: 'Test',
      version: '1.0.0'
    });
  });

  test('hooks execute correctly', async () => {
    const handler = jest.fn();
    api.addAction('builder.afterSave', handler);
    
    // Trigger hook via SDK
    // ...assertions
  });
});
```

## Distribution

### WordPress Plugin Structure

```
my-extension/
├── my-extension.php      # Main plugin file
├── readme.txt            # WordPress.org readme
├── build/
│   └── index.js          # Compiled extension
├── assets/
│   ├── icon.svg          # Plugin icon
│   └── style.css
└── languages/            # Translations
```

### Main Plugin File

```php
<?php
/**
 * Plugin Name: My SubtleForms Extension
 * Plugin URI: https://example.com/my-extension
 * Description: Extends SubtleForms with custom features
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Requires Plugins: subtleforms
 * Author: Your Name
 * License: GPL v2 or later
 * Text Domain: my-extension
 */

if (!defined('ABSPATH')) exit;

// Load extension
function my_extension_load() {
  // Check SubtleForms active
  if (!function_exists('subtleforms')) {
    add_action('admin_notices', function() {
      echo '<div class="error"><p>';
      echo 'My Extension requires SubtleForms to be installed and activated.';
      echo '</p></div>';
    });
    return;
  }

  // Enqueue script
  add_action('admin_enqueue_scripts', function() {
    wp_enqueue_script(
      'my-extension',
      plugin_dir_url(__FILE__) . 'build/index.js',
      ['subtleforms-admin'],
      '1.0.0',
      true
    );

    wp_enqueue_style(
      'my-extension',
      plugin_dir_url(__FILE__) . 'assets/style.css',
      ['subtleforms-admin'],
      '1.0.0'
    );
  });
}
add_action('plugins_loaded', 'my_extension_load');
```

### Build Process

Use webpack or your preferred bundler:

```javascript
// webpack.config.js
module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'build'),
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
```

**package.json scripts:**

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch",
    "test": "jest"
  }
}
```

### Versioning

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes

Update version in:
- `package.json`
- Plugin header
- Extension registration

### Publishing

**WordPress.org:**

1. Create readme.txt with WordPress.org format
2. Submit plugin for review
3. Use SVN for updates

**GitHub:**

1. Tag releases with version numbers
2. Include changelog in release notes
3. Provide clear installation instructions

## Security

### Input Validation

```javascript
api.addFilter('builder.beforeFieldUpdate', (payload) => {
  // Sanitize user input
  const sanitized = {
    ...payload.changes,
    label: payload.changes.label?.trim().substring(0, 255)
  };
  return { ...payload, changes: sanitized };
});
```

### Capability Checks

```javascript
// Only show admin features
api.registerUISlot('builder.toolbar.right', AdminPanel, {
  shouldRender: () => window.subtleFormsData?.currentUser?.can_manage_options
});
```

### Nonce Verification

```php
// Server-side endpoint
function handle_extension_request() {
  check_ajax_referer('my-extension-nonce');
  // Process request
}
```

## Performance

### Code Splitting

```javascript
import { lazy, Suspense } from 'react';

const HeavyFeature = lazy(() => import('./components/HeavyFeature'));

api.registerUISlot('builder.sidebar.bottom', () => (
  <Suspense fallback={<div>Loading...</div>}>
    <HeavyFeature />
  </Suspense>
));
```

### Debouncing

```javascript
import { debounce } from 'lodash';

const debouncedHandler = debounce((payload) => {
  // Expensive operation
}, 500);

api.addAction('builder.fieldSelected', debouncedHandler);
```

### Memoization

```javascript
import { useMemo } from 'react';

const ExpensiveComponent = ({ schema }) => {
  const computed = useMemo(() => {
    return expensiveCalculation(schema);
  }, [schema]);

  return <div>{computed}</div>;
};
```

## Best Practices Summary

✅ Check SDK compatibility on load  
✅ Use semantic versioning  
✅ Handle errors gracefully  
✅ Test thoroughly  
✅ Document public APIs  
✅ Follow WordPress coding standards  
✅ Respect user capabilities  
✅ Optimize performance  
✅ Provide clear error messages  
✅ Clean up resources on unload

## Next Steps

- Review [Builder Hooks Reference](builder-hooks.md)
- Explore [UI Extensions Guide](ui-extensions.md)
- Check [Capabilities Documentation](capabilities.md)
- Study [Example Extensions](/examples/)

## Support

- GitHub Issues: Report bugs and request features
- Documentation: Comprehensive guides and API reference
- Community: Join the SubtleForms community
