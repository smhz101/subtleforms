---
name: subtleforms-development
description: "Use when developing SubtleForms WordPress plugin: repository pattern, REST API, React admin UI, form schema versioning, security patterns, and performance optimization."
compatibility: "Targets WordPress 6.0+ (PHP 7.4+). Uses @wordpress/scripts for React admin UI. Node.js 20+ for build tooling."
---

# SubtleForms Development

## When to use

Use this skill when working on SubtleForms codebase for:
- Adding/modifying database operations or repositories
- Creating/updating REST API endpoints
- Working with form schema or submission handling
- Implementing new field types or validators
- Refactoring plugin architecture or improving performance
- Fixing security issues or implementing access controls
- Styling admin UI components (BEM methodology only)
- Managing versions and semantic versioning bumps

## Inputs required

- **Repo root:** `/wp-content/plugins/subtleforms/`
- **WordPress version:** 6.0+ minimum (tested up to 6.7)
- **PHP version:** 7.4+ minimum
- **Node.js:** 20+ for @wordpress/scripts build tooling
- **Task type:** Feature, bug fix, performance, security, or refactor
- **Target version bump:** MAJOR, MINOR, or PATCH (or none for docs)

## Procedure

### 0) Project triage and guardrails

1. **Identify task type:**
   - Database/repository work → See `references/repository-pattern.md`
   - REST API changes → See `references/rest-api.md`
   - Styling/CSS → See `styling.md` (BEM only, no utility classes)
   - Version bump → See `versioning.md` (triple synchronization)
   - Testing → See `testing.md` (PHPUnit guidelines)

2. **Check version requirements:**
   - Does this change break backward compatibility? → MAJOR bump
   - Does this add new features? → MINOR bump
   - Does this fix bugs only? → PATCH bump
   - Is this documentation only? → NO bump

### 1) Architecture and patterns

**Repository Pattern** (mandatory for all database access)
- All database operations MUST go through repository classes
- Never use `$wpdb` directly in controllers or business logic
- Repository methods return arrays or throw exceptions
- Add bulk query methods to avoid N+1 problems

**Dependency Injection**
- Controllers receive dependencies via constructor
- No global state access except WordPress core functions
- Settings accessed via `Settings` class only

**Schema Versioning** (immutable after publish)
- Draft forms: Mutable, stored in `draft_schema` column
- Published forms: Immutable, stored in `schema_versions` table
- Never modify active schema; create new version instead

See: `references/repository-pattern.md`, `references/schema-versioning.md`

### 2) Security baseline (always enforce)

- **Admin endpoints:** Check `current_user_can('manage_options')`
- **Public endpoints:** Verify REST nonce via `X-WP-Nonce` header
- **Rate limiting:** 10 requests/min per IP on submit endpoint
- **Input sanitization:** Use `Helpers::safe_sanitize_text()` for all user input
- **SQL safety:** Always use `$wpdb->prepare()` with `%d`, `%s`, `%f` placeholders
- **CAPTCHA:** Verify before submission processing

See: `references/security.md`

### 3) Performance rules

**Database:**
- Use bulk queries (e.g., `get_counts_by_forms()` instead of looping)
- Add transient caching for expensive queries (5-minute TTL)
- Add database indexes on frequently queried columns

**Frontend:**
- Separate admin and frontend bundles
- Use React.memo() for pure components
- Lazy load heavy components

See: `references/performance.md`

### 4) Code changes

**For PHP changes:**
```bash
# Edit files in src/
# Follow WordPress Coding Standards
# Use repository pattern for database access
```

**For React/JS changes:**
```bash
# Edit files in resources/admin/ or resources/frontend/
# Follow BEM methodology (see styling.md)
# NO utility classes allowed
npm run build
```

**For version bumps:**
1. Update `subtleforms.php` header (line ~10)
2. Update `SUBTLEFORMS_VERSION` constant (line ~25)
3. Update `package.json` version (line 3)
4. Verify all 3 match exactly

See: `versioning.md`

### 5) Commit and tag

```bash
# Stage changes
git add -A

# Commit with conventional message
git commit -m "fix: correct captcha rendering"  # PATCH
git commit -m "feat: add country field enhancements"  # MINOR
git commit -m "feat!: restructure REST API endpoints"  # MAJOR
git commit -m "docs: update architecture guide"  # NO version bump

# Tag if version bumped (skip for docs-only)
git tag -a v1.6.12 -m "v1.6.12: Country field enhancements"
```

See: `versioning.md`

## Verification

- ✅ All repository methods use `$wpdb->prepare()` with placeholders
- ✅ No direct `$wpdb` usage in controllers
- ✅ REST endpoints check capabilities and nonces
- ✅ Published forms have immutable schema version in `schema_versions` table
- ✅ Build succeeds: `npm run build`
- ✅ No N+1 queries in forms list or dashboard
- ✅ Version numbers match in all 3 locations (if bumped)
- ✅ Git tag created for version bumps (format: `v1.6.12`)
- ✅ No utility CSS classes (only BEM)

## Failure modes / debugging

**Schema version not created on publish:**
- Check `createSchemaVersion()` is called in publish endpoint
- Verify `schema_versions` table exists in database
- Confirm form status changed from 'draft' to 'published'

**N+1 query problem:**
- Use `get_counts_by_forms()` instead of looping with `count()`
- Add transient caching for expensive operations
- Profile with Query Monitor plugin

**Permission errors:**
- Verify `current_user_can('manage_options')` for admin endpoints
- Check REST nonce is sent via `X-WP-Nonce` header
- Confirm user is authenticated and has correct role

**Build failures:**
- Check Node.js version: `node -v` (requires 20+)
- Clear cache: `rm -rf node_modules build && npm install`
- Check for syntax errors in JSX files

**Version mismatch:**
- Verify versions match in subtleforms.php (header + constant) and package.json
- Use `git diff` to see what changed
- Run version check: `grep -E "Version:|SUBTLEFORMS_VERSION|\"version\"" subtleforms.php package.json`

## Escalation

For canonical documentation, consult:
- Repository pattern → `references/repository-pattern.md`
- REST API structure → `references/rest-api.md`
- Schema versioning → `references/schema-versioning.md`
- Security patterns → `references/security.md`
- Performance optimization → `references/performance.md`
- Styling guidelines → `styling.md` (BEM methodology)
- Version management → `versioning.md` (triple synchronization)
- Testing strategy → `testing.md` (PHPUnit guidelines)

For WordPress-specific questions:
- Plugin Handbook: https://developer.wordpress.org/plugins/
- REST API: https://developer.wordpress.org/rest-api/
- @wordpress/scripts: https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/
