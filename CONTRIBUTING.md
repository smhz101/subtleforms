# Contributing to SubtleForms

Thank you for your interest in contributing to SubtleForms! This document provides guidelines for contributing to the core plugin and building extensions.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Extension Development](#extension-development)
5. [Pull Request Process](#pull-request-process)
6. [Coding Standards](#coding-standards)
7. [Testing](#testing)
8. [Documentation](#documentation)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. All contributors must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- PHP 7.4+
- WordPress 6.0+
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/subtleforms/subtleforms.git
cd subtleforms

# Install dependencies
npm install

# Build assets
npm run build

# Start development mode (watch)
npm run dev
```

### Local Development

1. **Install in Local WordPress:**
   ```bash
   # Symlink plugin to WordPress installation
   ln -s $(pwd) /path/to/wordpress/wp-content/plugins/subtleforms
   ```

2. **Activate Plugin:**
   - Go to WordPress admin → Plugins
   - Activate SubtleForms

3. **Enable Dev Mode:**
   ```php
   // In wp-config.php
   define('SUBTLEFORMS_DEV', true);
   ```

## Development Workflow

### Branching Strategy

- `main` - Stable release branch
- `develop` - Development branch
- `feature/*` - New features
- `bugfix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes

### Creating a Feature Branch

```bash
# Start from develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/my-new-feature

# Make changes, commit regularly
git add .
git commit -m "Add feature: description"

# Push to GitHub
git push origin feature/my-new-feature
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(builder): add drag-and-drop reordering
fix(validation): handle empty email fields correctly
docs(sdk): update hook reference with examples
```

## Extension Development

### Extension Repository Structure

Extensions should be separate repositories:

```
my-extension/
├── .github/
│   └── workflows/
│       └── test.yml
├── src/
│   ├── index.js
│   ├── components/
│   └── services/
├── build/
├── tests/
├── README.md
├── CHANGELOG.md
├── package.json
└── my-extension.php
```

### Publishing Extensions

1. **Create Repository:** Host on GitHub or similar
2. **Document:** Comprehensive README with usage examples
3. **Test:** Include automated tests
4. **Version:** Follow semantic versioning
5. **License:** Choose appropriate license (GPL recommended for WordPress)

### Submitting to Marketplace

Coming soon: Official SubtleForms extension marketplace.

## Pull Request Process

### Before Submitting

- [ ] Code follows WordPress coding standards
- [ ] JavaScript passes ESLint
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] No console warnings/errors

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Added tests
- [ ] All tests pass
```

### Review Process

1. **Automated Checks:** CI/CD runs tests and linting
2. **Code Review:** Maintainer reviews code quality
3. **Testing:** Manual testing of functionality
4. **Approval:** At least one maintainer approval required
5. **Merge:** Squash and merge into develop

### Review Criteria

- **Functionality:** Works as intended
- **Code Quality:** Readable, maintainable, follows patterns
- **Performance:** No significant performance impact
- **Security:** No security vulnerabilities
- **Compatibility:** Works with supported WordPress/PHP versions
- **Accessibility:** Follows WCAG 2.1 AA guidelines
- **Documentation:** Adequate inline comments and docs

## Coding Standards

### PHP Standards

Follow [WordPress PHP Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/):

```php
<?php
/**
 * Brief description
 *
 * Detailed description (if needed)
 *
 * @param string $param Parameter description
 * @return bool Return description
 */
function subtleforms_example_function( $param ) {
    if ( empty( $param ) ) {
        return false;
    }
    
    return true;
}
```

### JavaScript Standards

Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript):

```javascript
/**
 * Brief description
 *
 * @param {Object} config - Configuration object
 * @param {string} config.id - Item ID
 * @returns {boolean} Success status
 */
export function exampleFunction(config) {
  if (!config.id) {
    return false;
  }
  
  return true;
}
```

### React Standards

```javascript
/**
 * Component description
 *
 * @param {Object} props - Component props
 * @param {number} props.formId - Form ID
 * @param {Function} props.onSave - Save callback
 */
const ExampleComponent = ({ formId, onSave }) => {
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // Side effects
    return () => {
      // Cleanup
    };
  }, [formId]);
  
  return (
    <div className="example-component">
      {/* Component JSX */}
    </div>
  );
};
```

### CSS Standards

Use BEM methodology for class names:

```css
/* Block */
.sf-panel {}

/* Element */
.sf-panel__header {}
.sf-panel__body {}

/* Modifier */
.sf-panel--collapsed {}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- builder.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Writing Tests

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  test('renders with props', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
  
  test('handles click events', () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Test Coverage Goals

- **Unit Tests:** Core business logic
- **Integration Tests:** Component interactions
- **E2E Tests:** Critical user flows
- **Minimum Coverage:** 70% overall, 90% for critical paths

## Documentation

### Documentation Types

1. **Inline Documentation:** JSDoc for all public APIs
2. **User Guides:** Feature documentation for end users
3. **Developer Docs:** API reference and guides for developers
4. **Architecture Docs:** High-level system design

### Writing Documentation

**Inline (JSDoc):**
```javascript
/**
 * Brief description (required)
 *
 * Detailed description explaining purpose,
 * behavior, and any important considerations.
 *
 * @param {string} param - Parameter description
 * @returns {Object} Return value description
 * @throws {Error} When validation fails
 * @example
 * const result = myFunction('value');
 * console.log(result);
 */
```

**Markdown Guides:**
- Clear headings (H1 for title, H2 for sections)
- Code examples with syntax highlighting
- Screenshots for UI features
- Links to related documentation

### Documentation Location

- `/docs/` - Developer documentation
- `/examples/` - Working code examples
- `README.md` - Project overview
- `CHANGELOG.md` - Version history

## Reporting Bugs

### Before Reporting

1. Check [existing issues](https://github.com/subtleforms/issues)
2. Try latest version
3. Reproduce with default WordPress theme
4. Disable other plugins

### Bug Report Template

```markdown
## Describe the Bug
Clear description of the issue

## To Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Environment
- SubtleForms Version: 1.8.0
- WordPress Version: 6.4
- PHP Version: 8.1
- Browser: Chrome 120

## Screenshots
If applicable

## Additional Context
Any other relevant information
```

## Feature Requests

Feature requests are welcome! Please:

1. Search existing requests first
2. Describe the use case clearly
3. Explain why it benefits users
4. Provide examples if possible

## Security Vulnerabilities

**DO NOT** report security vulnerabilities publicly.

See [SECURITY.md](SECURITY.md) for responsible disclosure process.

## License

By contributing, you agree that your contributions will be licensed under the GPLv2 or later license.

## Questions?

- **Documentation:** Check `/docs/` directory
- **GitHub Discussions:** Ask questions and share ideas
- **Support Forum:** Get help from community
- **Twitter:** Follow [@SubtleForms](https://twitter.com/subtleforms) for updates

Thank you for contributing! 🎉
