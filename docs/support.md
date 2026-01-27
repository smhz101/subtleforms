# Support & Evolution Guide

Guidelines for getting help, reporting issues, and understanding platform evolution.

## Getting Help

### Before Asking for Help

1. **Check Documentation:**
   - [Getting Started](/docs/getting-started.md)
   - [Extension Guide](/docs/extension-guide.md)
   - [API Reference](/sdk/)

2. **Search Existing Issues:**
   - [GitHub Issues](https://github.com/subtleforms/issues)
   - [Discussion Forum](https://forum.subtleforms.com)

3. **Review Examples:**
   - [Example Extensions](/examples/)
   - Look for similar implementations

4. **Check Compatibility:**
   - Verify SubtleForms version
   - Check SDK version
   - Test with default WordPress theme
   - Disable other plugins

### Where to Ask

#### GitHub Issues
**For:** Bug reports, feature requests  
**Link:** https://github.com/subtleforms/issues

#### Discussion Forum
**For:** How-to questions, general discussion  
**Link:** https://forum.subtleforms.com

#### Stack Overflow
**Tag:** `subtleforms`  
**For:** Technical questions with code

#### Email Support
**Pro License:** support@subtleforms.com  
**Security:** security@subtleforms.com

### Response Times

- **Critical Bugs:** 24-48 hours
- **High Priority:** 2-5 business days
- **General Questions:** 5-7 business days
- **Feature Requests:** Variable

## Reporting Bugs

### Bug vs Feature

**Bug:** Something doesn't work as documented

Examples:
- Extension hook not firing
- Console errors
- Data loss
- Incorrect behavior

**Feature:** New functionality request

Examples:
- Additional hook points
- New UI slots
- Enhanced capabilities
- API additions

### Bug Report Template

Use this template when reporting bugs:

```markdown
## Description
Brief description of the issue

## To Reproduce
1. Create extension with...
2. Register hook for...
3. Trigger event by...
4. Observe error

## Expected Behavior
What should happen according to docs

## Actual Behavior
What actually happens

## Environment
- SubtleForms Version: 1.8.0
- SDK Version: 1.0.0
- WordPress Version: 6.4
- PHP Version: 8.1
- Browser: Chrome 120
- OS: macOS 14.0

## Code Sample
```javascript
// Minimal reproduction
import { registerExtension } from '@subtleforms/sdk';

const api = registerExtension({
  id: 'com.example.test',
  name: 'Test',
  version: '1.0.0'
});

api.addBuilderHook('beforeSave', (payload) => {
  // Issue occurs here
});
```

## Console Output
```
[Error messages or warnings]
```

## Screenshots
[If applicable]

## Additional Context
[Any other relevant information]
```

### Good Bug Reports

✅ **Do:**
- Provide minimal reproduction
- Include version numbers
- Show actual vs expected
- Include error messages
- Test with default theme
- Disable other plugins

❌ **Don't:**
- Report multiple issues in one report
- Include irrelevant information
- Skip reproduction steps
- Assume context
- Use vague descriptions

## Feature Requests

### Proposing Features

Good feature requests include:

1. **Use Case:** Why is this needed?
2. **Current Workaround:** How do you do it now?
3. **Proposed Solution:** What should be added?
4. **Alternatives:** Other approaches considered?
5. **Examples:** Code samples or mockups

### Feature Request Template

```markdown
## Problem Statement
Describe the problem this feature would solve

## Use Case
Explain a real-world scenario

## Proposed Solution
Describe your ideal solution

## Example Usage
```javascript
// How would the API look?
api.newFeature('example', {
  option: 'value'
});
```

## Alternatives Considered
Other approaches you've thought about

## Implementation Notes
Technical considerations (optional)
```

### Feature Prioritization

Features are prioritized based on:

1. **Impact:** How many users benefit?
2. **Effort:** How complex is implementation?
3. **Alignment:** Fits platform vision?
4. **Demand:** Community interest level?

## Version Compatibility

### Supported Versions

SubtleForms supports:
- **Current major version:** Full support
- **Previous major version:** Security updates only
- **Older versions:** No support

Example:
- 1.8.x: ✅ Full support
- 1.7.x: ✅ Security only
- 1.6.x: ❌ No support

### SDK Compatibility

Extensions should:

```javascript
// Check minimum SDK version
const compatibility = checkSDKCompatibility('1.0.0', {
  hooks: true,
  uiSlots: true
});

if (!compatibility.compatible) {
  // Show error, don't load
  return;
}
```

### Backward Compatibility

SubtleForms commits to:

- **Patch updates (1.0.x):** No breaking changes
- **Minor updates (1.x.0):** New features, no breaks
- **Major updates (x.0.0):** May include breaking changes

## Breaking Changes

### Definition

A breaking change:
- Removes or renames public API
- Changes function signatures
- Alters hook payloads
- Modifies behavior that extensions rely on

### Communication

Breaking changes are:

1. **Announced** in advance (at least 90 days)
2. **Documented** in migration guide
3. **Deprecated** before removal (1-2 minor versions)
4. **Bundled** in major version releases

### Migration Support

For major version upgrades:

- Comprehensive migration guide
- Deprecated API warnings in console
- Backward compatibility shims (when possible)
- Example migration code

## API Stability

### Stability Levels

APIs are marked with stability indicators:

**Stable** - Safe to use, won't break

```javascript
/**
 * @stability stable
 */
export function registerExtension(config) { }
```

**Experimental** - May change, use with caution

```javascript
/**
 * @stability experimental
 */
export function experimentalFeature() { }
```

**Deprecated** - Will be removed, migrate away

```javascript
/**
 * @deprecated Use newFunction() instead
 * @stability deprecated
 */
export function oldFunction() { }
```

### Safe to Use

Current stable APIs:

- `registerExtension()`
- Hook system (`addHook`, `addBuilderHook`)
- UI slots (`addUISlot`, `UISlot`)
- Capabilities (`addCapability`, `Can`, `Cannot`)
- Data hooks (`useForm`, `useForms`, etc.)
- Policy layer (`useAbility`)

## Deprecation Process

### Timeline

1. **Announce (v1.8):** "Feature X will be deprecated"
2. **Deprecate (v1.9):** Console warnings, docs updated
3. **Remove (v2.0):** Breaking removal in major version

### Handling Deprecations

```javascript
// Check for deprecation warnings
if (window.subtleformsAdmin?.dev) {
  // Warnings visible in dev mode
}

// Migrate proactively
// Old (deprecated)
api.oldMethod();

// New (recommended)
api.newMethod();
```

## Future Features

### Planned (SDK 1.x)

- Submission hooks (1.1)
- Custom field types (1.2)
- REST API endpoints (1.3)

### Under Consideration

- GraphQL API
- WebSocket support
- Plugin marketplace
- Cloud sync

### Requesting Features

Vote on features:
- GitHub Discussions (👍 reactions)
- Feature request issues
- Community polls

## Extension Ecosystem

### Publishing Extensions

Coming soon:
- Official extension directory
- Automated testing
- Quality guidelines
- Revenue sharing (for paid extensions)

### Best Practices

For maintainable extensions:

1. **Semantic Versioning:** Use SemVer strictly
2. **Changelog:** Document all changes
3. **Tests:** Automated test coverage
4. **Documentation:** Clear usage guides
5. **Support:** Respond to issues
6. **Updates:** Keep dependencies current

## System Boundaries

### What You Can Do

✅ Use public SDK APIs  
✅ Register hooks and UI slots  
✅ Add custom capabilities  
✅ Fetch data via provided hooks  
✅ Modify payloads in filters  
✅ Prevent actions (return false)

### What You Cannot Do

❌ Access internal React state  
❌ Modify core components directly  
❌ Bypass capability checks  
❌ Access private functions  
❌ Mutate core data structures  
❌ Override WordPress core

### Gray Areas

**Database Access:**
- Use WordPress `wpdb` if needed
- Prefix custom tables
- Don't modify SubtleForms tables directly

**External APIs:**
- OK to call external services
- Handle errors gracefully
- Consider rate limits

**WordPress APIs:**
- Safe to use WordPress functions
- Check capabilities properly
- Follow WordPress guidelines

## Community Guidelines

### Code of Conduct

All community members must follow our [Code of Conduct](CODE_OF_CONDUCT.md).

### Contributing

See [Contributing Guide](CONTRIBUTING.md) for how to:
- Report bugs
- Submit patches
- Propose features
- Review code

## Resources

### Documentation
- [API Reference](/sdk/)
- [User Guide](/docs/)
- [Examples](/examples/)

### Community
- [GitHub](https://github.com/subtleforms)
- [Forum](https://forum.subtleforms.com)
- [Twitter](https://twitter.com/subtleforms)

### Professional Support

**Pro License Benefits:**
- Priority email support
- Direct developer access
- Custom integration assistance
- Training resources

**Contact:** support@subtleforms.com

## FAQ

**Q: Will my extension break in future versions?**  
A: Not in minor/patch updates. Major versions may have breaking changes but include migration guides.

**Q: How long are versions supported?**  
A: Current + previous major version. Upgrade within 1 year of new major release.

**Q: Can I sell my extension?**  
A: Yes, under GPL-compatible license. Marketplace coming soon.

**Q: What if I need a feature that doesn't exist?**  
A: Submit feature request. For urgent needs, Pro license holders get priority.

**Q: How do I report security issues?**  
A: Email security@subtleforms.com. See [SECURITY.md](SECURITY.md).

**Q: Can I modify SubtleForms core?**  
A: You can fork under GPL, but extensions are the recommended approach.

## Changelog

Stay informed about changes:

- [GitHub Releases](https://github.com/subtleforms/releases)
- [CHANGELOG.md](CHANGELOG.md)
- [Migration Guide](/docs/migration-guide.md)

Thank you for being part of the SubtleForms community! 🙌
