# SubtleForms Versioning Skills

## Semantic Versioning: MAJOR.MINOR.PATCH

SubtleForms follows strict semantic versioning with **triple synchronization** across all version identifiers.

## Version Format

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └─ Bug fixes, docs, styling (no API change)
  │     └─────── New features, backward-compatible
  └───────────── Breaking changes, major refactors
```

## Triple Synchronization Rule

**CRITICAL:** Every version bump must update ALL THREE locations atomically:

### 1. Plugin Header (`subtleforms.php`)
```php
/**
 * Plugin Name:       SubtleForms
 * Plugin URI:        https://subtlewp.com/plugins/subtleforms
 * Description:       Zero-BS, high-speed contact form plugin for WordPress. Just forms.
 * Version:           1.6.11
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Subtle WP
 * Author URI:        https://subtlewp.com/
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       subtleforms
 * Domain Path:       /languages
 */
```

### 2. Plugin Constant (`subtleforms.php`)
```php
define( 'SUBTLEFORMS_VERSION', '1.6.11' );
```

### 3. Package.json (`package.json`)
```json
{
  "name": "subtleforms",
  "version": "1.6.11",
  "description": "Zero-BS, high-speed contact form plugin for WordPress.",
  ...
}
```

## Version Bump Examples

### PATCH Bump (Bug Fixes)
**Scenario:** Fix CAPTCHA rendering in builder preview

**Changes:**
- `1.6.10` → `1.6.11`
- Message: `fix: correct captcha rendering in builder, preview, and frontend`
- Git tag: `v1.6.11`

**Command Sequence:**
```bash
# 1. Update version in all 3 locations
# 2. Build assets
npm run build
# 3. Commit
git add -A
git commit -m "fix: correct captcha rendering in builder, preview, and frontend"
# 4. Tag
git tag -a v1.6.11 -m "v1.6.11: Fix CAPTCHA rendering"
git push origin main --tags
```

### MINOR Bump (New Features)
**Scenario:** Add country field enhancements

**Changes:**
- `1.6.11` → `1.6.12`
- Message: `feat: enhance country field with flags, search, and output formats`
- Git tag: `v1.6.12`

**Command Sequence:**
```bash
# 1. Update version in all 3 locations
# 2. Build assets
npm run build
# 3. Commit
git add -A
git commit -m "feat: enhance country field with flags, search, and output formats"
# 4. Tag
git tag -a v1.6.12 -m "v1.6.12: Country field UX improvements"
git push origin main --tags
```

### MAJOR Bump (Breaking Changes)
**Scenario:** Change REST API endpoint structure

**Changes:**
- `1.6.13` → `2.0.0`
- Message: `feat!: restructure REST API endpoints for better consistency`
- Git tag: `v2.0.0`

**Command Sequence:**
```bash
# 1. Update version in all 3 locations
# 2. Build assets
npm run build
# 3. Commit
git add -A
git commit -m "feat!: restructure REST API endpoints for better consistency

BREAKING CHANGE: Endpoint structure changed from /forms/{id}/submit to /submissions/create"
# 4. Tag
git tag -a v2.0.0 -m "v2.0.0: API restructure (BREAKING)"
git push origin main --tags
```

## Commit Types

### Standard Prefixes
- `fix:` - Bug fixes (PATCH bump)
- `feat:` - New features (MINOR bump)
- `feat!:` - Breaking changes (MAJOR bump)
- `perf:` - Performance improvements (PATCH or MINOR depending on scale)
- `docs:` - Documentation only (NO version bump)
- `style:` - Code style/formatting (NO version bump)
- `refactor:` - Code restructuring, no behavior change (PATCH bump)
- `test:` - Test additions/fixes (NO version bump)
- `chore:` - Build process, dependencies (NO version bump)

### Examples
```bash
# PATCH bump required
git commit -m "fix: prevent double submission with disabled button"

# MINOR bump required
git commit -m "feat: add submission export to CSV"

# MAJOR bump required
git commit -m "feat!: change form schema format

BREAKING CHANGE: Old forms need migration"

# NO version bump
git commit -m "docs: update installation instructions"
git commit -m "chore: update webpack config"
```

## Special Cases

### Documentation-Only Changes
**NO VERSION BUMP** required for:
- README updates
- Comment improvements
- `.github/` directory changes
- Code examples in docblocks

**Example:**
```bash
# Update architecture.md
git add .github/skills/architecture.md
git commit -m "docs: add agent-skills and contributor rules"
# NO version change in subtleforms.php or package.json
git push origin main
# NO git tag needed
```

### Hotfix Workflow
**Scenario:** Critical bug in production

```bash
# From main branch
git checkout -b hotfix/1.6.11

# Make fix
# Update version 1.6.10 → 1.6.11 in all 3 locations
npm run build
git add -A
git commit -m "fix: resolve critical XSS vulnerability in textarea field"

# Tag
git tag -a v1.6.11 -m "v1.6.11: Security hotfix"

# Merge back
git checkout main
git merge hotfix/1.6.11
git push origin main --tags

# Delete branch
git branch -d hotfix/1.6.11
```

## Version Verification Checklist

Before committing version bump:

- [ ] `subtleforms.php` header updated (line 10)
- [ ] `SUBTLEFORMS_VERSION` constant updated (line 25)
- [ ] `package.json` version updated (line 3)
- [ ] All 3 versions MATCH exactly
- [ ] `npm run build` executed successfully
- [ ] Commit message follows convention
- [ ] Git tag matches version (`v1.6.11` format)

## Automated Verification Script

Create `.github/workflows/version-check.yml`:

```yaml
name: Version Sync Check
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Verify version sync
        run: |
          PHP_HEADER=$(grep "Version:" subtleforms.php | awk '{print $3}')
          PHP_CONST=$(grep "SUBTLEFORMS_VERSION" subtleforms.php | cut -d"'" -f2)
          NPM_VERSION=$(node -p "require('./package.json').version")
          
          echo "PHP Header: $PHP_HEADER"
          echo "PHP Constant: $PHP_CONST"
          echo "NPM Version: $NPM_VERSION"
          
          if [ "$PHP_HEADER" != "$PHP_CONST" ] || [ "$PHP_HEADER" != "$NPM_VERSION" ]; then
            echo "❌ Version mismatch detected!"
            exit 1
          fi
          
          echo "✅ All versions match: $PHP_HEADER"
```

## Release Process

### 1. Pre-Release Checklist
- [ ] All tests passing
- [ ] Build succeeds without errors
- [ ] No uncommitted changes
- [ ] Version numbers synchronized
- [ ] CHANGELOG.md updated (if exists)

### 2. Version Bump
```bash
# Update all 3 locations manually
# OR use helper script:
./scripts/bump-version.sh 1.6.11
```

### 3. Build Assets
```bash
npm run build
```

### 4. Commit & Tag
```bash
git add -A
git commit -m "fix: correct captcha rendering in builder, preview, and frontend"
git tag -a v1.6.11 -m "v1.6.11: Fix CAPTCHA rendering"
```

### 5. Push to Remote
```bash
git push origin main --tags
```

### 6. GitHub Release (Optional)
Create release from tag on GitHub with:
- Release title: `v1.6.11: Fix CAPTCHA rendering`
- Release notes: Changelog for this version
- Attach `subtleforms.zip` build artifact

## Common Pitfalls

❌ **Mismatched Versions**
```php
// subtleforms.php
Version: 1.6.11
define( 'SUBTLEFORMS_VERSION', '1.6.10' ); // ❌ Doesn't match!

// package.json
"version": "1.6.12" // ❌ Doesn't match!
```

❌ **Wrong Commit Prefix**
```bash
git commit -m "Added new feature" # ❌ No prefix, unclear bump type
```

❌ **Forgetting Git Tag**
```bash
git commit -m "fix: resolve bug"
git push # ❌ No tag created
```

❌ **Version Bump Without Code Change**
```bash
# Bumped from 1.6.10 to 1.6.11
# But NO actual changes ❌
```

✅ **Correct Workflow**
```bash
# 1. Make code changes
# 2. Update version in ALL 3 locations
# 3. Build
npm run build
# 4. Commit with conventional message
git add -A
git commit -m "fix: correct captcha rendering in builder, preview, and frontend"
# 5. Tag
git tag -a v1.6.11 -m "v1.6.11: Fix CAPTCHA rendering"
# 6. Push with tags
git push origin main --tags
```

## Version History Reference

Track major milestones:

- **v1.0.0** - Initial release
- **v1.5.0** - Added CAPTCHA support
- **v1.6.0** - Form builder redesign
- **v1.6.10** - Security hardening release
- **v1.6.11** - CAPTCHA rendering fix
- **v1.6.12** - Country field enhancements
- **v1.6.13** - Settings coverage implementation
- **v1.7.0** - Performance optimization release

## Pre-commit Hook (Optional)

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Extract versions
PHP_HEADER=$(grep "Version:" subtleforms.php | awk '{print $3}')
PHP_CONST=$(grep "SUBTLEFORMS_VERSION" subtleforms.php | cut -d"'" -f2)
NPM_VERSION=$(node -p "require('./package.json').version")

# Check sync
if [ "$PHP_HEADER" != "$PHP_CONST" ] || [ "$PHP_HEADER" != "$NPM_VERSION" ]; then
  echo "❌ Version mismatch detected!"
  echo "   PHP Header: $PHP_HEADER"
  echo "   PHP Constant: $PHP_CONST"
  echo "   NPM Version: $NPM_VERSION"
  exit 1
fi

echo "✅ Version check passed: $PHP_HEADER"
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```
