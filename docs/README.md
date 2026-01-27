# SubtleForms Documentation

Complete documentation for SubtleForms core and extension development.

## Quick Links

- **[Getting Started](/docs/getting-started.md)** - New to SubtleForms extensions? Start here
- **[SDK Reference](/sdk/README.md)** - Complete API documentation
- **[Examples](/examples/)** - Working code examples
- **[Support](/docs/support.md)** - Get help and report issues

## Documentation Structure

### For Extension Developers

#### Getting Started
1. **[Getting Started Guide](/docs/getting-started.md)**
   - Prerequisites and installation
   - Quick start (3 steps)
   - Core concepts
   - WordPress integration
   - Best practices

#### Core Guides
2. **[Extension Development Guide](/docs/extension-guide.md)**
   - Extension lifecycle
   - Architecture patterns
   - State management
   - Error handling
   - Testing strategies
   - Distribution

3. **[Builder Hooks Reference](/docs/builder-hooks.md)**
   - Complete hook catalog
   - Payload structures
   - Return requirements
   - Examples for each hook

4. **[UI Extensions Guide](/docs/ui-extensions.md)**
   - Available UI slots
   - Component patterns
   - Context usage
   - Styling guidelines
   - Performance tips

5. **[Capabilities & Pro Features](/docs/capabilities.md)**
   - Policy layer overview
   - Can/Cannot components
   - useAbility hook
   - Custom capabilities
   - License integration

#### Advanced Topics
6. **[Migration Guide](/docs/migration-guide.md)**
   - Version compatibility
   - Upgrade paths
   - Breaking changes
   - Deprecation policy

7. **[Support & Evolution](/docs/support.md)**
   - Getting help
   - Bug reporting
   - Feature requests
   - Community guidelines

### For Contributors

#### Contributing to Core
8. **[Contributing Guide](/CONTRIBUTING.md)**
   - Development setup
   - Branching strategy
   - Pull request process
   - Coding standards
   - Testing requirements

9. **[Code of Conduct](/CODE_OF_CONDUCT.md)**
   - Community standards
   - Enforcement guidelines
   - Contact information

10. **[Security Policy](/SECURITY.md)**
    - Vulnerability reporting
    - Supported versions
    - Disclosure process
    - Security features

### Reference

#### SDK
11. **[SDK Documentation](/sdk/README.md)**
    - Installation
    - API reference
    - TypeScript support
    - Version compatibility

12. **[TypeScript Definitions](/sdk/index.d.ts)**
    - Complete type definitions
    - Interfaces and types
    - Module exports

#### Examples
13. **[Examples Overview](/examples/README.md)**
    - Example descriptions
    - Installation instructions
    - Troubleshooting

14. **[Basic Extension Example](/examples/basic-extension/)**
    - Hook usage fundamentals
    - Event logging
    - Data transformation

15. **[UI Panel Extension Example](/examples/ui-panel-extension/)**
    - Custom UI components
    - Data fetching
    - Capability gating

## Learning Paths

### Path 1: Build Your First Extension (1-2 hours)

1. Read [Getting Started](/docs/getting-started.md) (15 min)
2. Study [Basic Extension Example](/examples/basic-extension/) (20 min)
3. Set up development environment (20 min)
4. Build "Hello World" extension (30 min)
5. Test in WordPress (15 min)

**Outcome:** Working extension that logs form saves

### Path 2: Add Custom UI (2-3 hours)

1. Complete Path 1
2. Read [UI Extensions Guide](/docs/ui-extensions.md) (30 min)
3. Study [UI Panel Example](/examples/ui-panel-extension/) (30 min)
4. Add sidebar panel to your extension (60 min)
5. Style and test (30 min)

**Outcome:** Extension with custom admin panel

### Path 3: Build Pro Features (3-4 hours)

1. Complete Path 2
2. Read [Capabilities Documentation](/docs/capabilities.md) (30 min)
3. Register custom capability (30 min)
4. Gate features with Can/Cannot (60 min)
5. Add upgrade prompts (30 min)
6. Test with different license tiers (30 min)

**Outcome:** Extension with Free and Pro tiers

### Path 4: Production-Ready Extension (1-2 days)

1. Complete Path 3
2. Read [Extension Guide](/docs/extension-guide.md) (60 min)
3. Add comprehensive error handling (2 hours)
4. Write automated tests (3 hours)
5. Add documentation (2 hours)
6. Set up build process (2 hours)
7. Prepare for distribution (2 hours)

**Outcome:** Production-ready, publishable extension

## Cheat Sheets

### Quick API Reference

```javascript
// Extension Registration
import { registerExtension } from '@subtleforms/sdk';
const api = registerExtension({ id, name, version });

// Hooks
import { BUILDER_HOOKS } from '@subtleforms/sdk';
api.addBuilderHook(BUILDER_HOOKS.BEFORE_SAVE, callback);

// UI Slots
import { UI_SLOTS } from '@subtleforms/sdk';
api.addUISlot(UI_SLOTS.BUILDER_SIDEBAR_BOTTOM, Component);

// Capabilities
import { Can, useAbility } from '@subtleforms/sdk';
<Can I="use" a="feature">...</Can>
const ability = useAbility('use', 'feature');

// Data Fetching
import { useForm } from '@subtleforms/sdk';
const { data, loading, error } = useForm(formId);
```

### Common Patterns

**Validate Before Save:**
```javascript
api.addBuilderHook('beforeSave', (payload) => {
  if (!isValid(payload.schema)) {
    alert('Validation failed');
    return false; // Prevent save
  }
  return payload;
});
```

**Add Custom Panel:**
```javascript
const Panel = ({ schema }) => <div>Custom content</div>;
api.addUISlot(UI_SLOTS.BUILDER_SIDEBAR_BOTTOM, Panel);
```

**Check Capability:**
```javascript
const ability = useAbility('use', 'webhooks');
if (ability.can) {
  // Show Pro feature
}
```

### File Structure

```
my-extension/
├── my-extension.php    # WordPress plugin
├── index.js            # Extension entry
├── package.json        # Dependencies
├── README.md           # Documentation
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Hook handlers
│   └── utils/          # Utilities
├── build/              # Compiled output
└── tests/              # Automated tests
```

## Troubleshooting

### Common Issues

**Extension Not Loading**
→ Check SubtleForms is active  
→ Verify script dependency (`subtleforms-admin`)  
→ Look for console errors  
→ Enable dev mode

**Hooks Not Firing**
→ Confirm hook name is correct  
→ Check event is actually triggered  
→ Verify callback is registered before event  
→ Test with console.log

**UI Not Appearing**
→ Validate slot name  
→ Check component renders without errors  
→ Verify `shouldRender` returns true  
→ Inspect with React DevTools

**TypeScript Errors**
→ Install `@subtleforms/sdk` types  
→ Check tsconfig.json settings  
→ Update to latest SDK version

See [Support Guide](/docs/support.md) for detailed troubleshooting.

## Resources

### Official
- **Website:** https://subtleforms.com
- **Documentation:** https://docs.subtleforms.com
- **GitHub:** https://github.com/subtleforms
- **Changelog:** [CHANGELOG.md](/CHANGELOG.md)

### Community
- **Forum:** https://forum.subtleforms.com
- **Discord:** https://discord.gg/subtleforms
- **Twitter:** [@SubtleForms](https://twitter.com/subtleforms)
- **Newsletter:** Subscribe at subtleforms.com

### Support
- **Issues:** https://github.com/subtleforms/issues
- **Security:** security@subtleforms.com
- **Pro Support:** support@subtleforms.com

## Version Information

- **Current SDK:** 1.0.0
- **Required SubtleForms:** ≥1.8.0
- **Required WordPress:** ≥6.0
- **Required PHP:** ≥7.4
- **Node.js (dev):** ≥16.0

## Feedback

We value your feedback! Help improve this documentation:

1. **Found an error?** [Report it](https://github.com/subtleforms/issues)
2. **Have a suggestion?** [Discuss it](https://forum.subtleforms.com)
3. **Want to contribute?** See [CONTRIBUTING.md](/CONTRIBUTING.md)

## License

Documentation is licensed under [Creative Commons BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Code examples are licensed under GPL v2 or later, same as SubtleForms.

---

Last Updated: 2024  
Documentation Version: 1.0.0
