---
name: subtleforms-architecture
description: "Use when working on SubtleForms codebase: repository pattern, dependency injection, schema versioning, REST API structure, performance rules, and security patterns."
compatibility: "Targets WordPress 6.0+ (PHP 7.4+). Uses @wordpress/scripts for React admin UI."
---

# SubtleForms Architecture

## When to use

Use this skill when:
- Adding new database operations or repositories
- Creating/modifying REST API endpoints
- Working with form schema or submissions
- Implementing new field types or validators
- Refactoring plugin architecture
- Troubleshooting performance or security issues

## Inputs required

- Repo root: `/wp-content/plugins/subtleforms/`
- Target WordPress version: 6.0+ minimum
- PHP version: 7.4+ minimum
- Node.js: 20+ for build tooling

## Procedure

### 1. Core Architecture Principles

**Repository Pattern**
- All database access MUST go through repositories (`src/Repositories/`)
- Never use `$wpdb` directly in controllers or business logic
- Repository methods return arrays or throw exceptions

**Dependency Injection**
- Controllers receive dependencies via constructor
- No global state access except WordPress core functions
- Use Settings class for all configuration

**Immutable Schema Versioning**
- Draft schema: Mutable, stored in `draft_schema` column
- Active schema: Immutable, stored in `schema_versions` table
- Never modify active schema after publication

### 4. State Machine Discipline
- Builder state transitions are strictly enforced
- See `ALLOWED_TRANSITIONS` map in `useBuilderReducer.js`
- Invalid transitions fail silently (FSM constraint)

## Directory Structure

```
src/
├── Api/                  # REST API controllers
├── Repositories/         # Data access layer
├── Engine/               # Business logic (pipelines, actions)
├── Support/              # Helpers, settings, utilities
├── Fields/               # Field definitions and registry
├── Contracts/            # Interfaces
├── Frontend/             # Public-facing components
└── Activator.php         # Database schema setup

resources/
├── admin/                # React admin UI
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── utils/
└── frontend/             # React frontend renderer
```

## Key Components

### Forms Repository
- `all()`: Paginated form list with filtering
- `find()`: Single form by ID
- `loadSchemaVersion()`: Get active schema for form
- `createSchemaVersion()`: Create immutable version

### Submissions Repository
- `create()`: Insert submission with metadata
- `findAll()`: Advanced filtering and search
- `get_counts_by_forms()`: Bulk counts (avoid N+1)

### REST API Structure
- `/subtleforms/v1/forms` - CRUD for forms
- `/subtleforms/v1/forms/{id}/schema` - Schema versioning
- `/subtleforms/v1/forms/{id}/submit` - Public submission endpoint
- `/subtleforms/v1/submissions` - Submission management
- `/subtleforms/v1/dashboard` - Dashboard stats (cached)

### Field Registry
- Fields defined in `CoreFields.php`
- Each field has: type, category, icon, inspector controls
- Custom fields via `subtleforms_register_fields` filter

### Engine Pipeline
- Submission → SpamProtection → CAPTCHA → Validation → Actions
- Actions: Email, Webhook, Calculation (extensible)
- Context object carries state through pipeline

## Performance Rules

### Database Optimization
- ✅ Use bulk queries (e.g., `get_counts_by_forms()`)
- ❌ Never loop over forms/submissions to fetch related data
- ✅ Add indexes on frequently queried columns
- ✅ Use transient caching for expensive queries (5-minute TTL)

### Frontend Optimization
- Build separates admin and frontend bundles
- Lazy load heavy components when possible
- Use React.memo() for pure components
- Avoid unnecessary re-renders in builder

## Security Patterns

### REST API Authentication
- Admin endpoints: Check `current_user_can('manage_options')`
- Public endpoints: Nonce verification via `X-WP-Nonce` header
- Rate limiting on submission endpoint (10/min per IP)

### Input Validation
- All user input sanitized via `Helpers::safe_sanitize_text()`
- Schema validation via `SchemaValidator`
- CAPTCHA verification before submission processing

### SQL Injection Prevention
- Always use `$wpdb->prepare()` with placeholders
- Never interpolate user input into SQL
- Use `%d`, `%s`, `%f` for type-safe queries

## Extension Points

### Filters
- `subtleforms_register_fields` - Add custom field types
- `subtleforms_captcha_providers` - Add CAPTCHA providers
- `subtleforms_captcha_provider_config` - Customize provider config

### Actions
- `subtleforms_before_submission` - Pre-submission hook
- `subtleforms_after_submission` - Post-submission hook
- `subtleforms_form_published` - Form status change

## Testing Guidelines

### Unit Tests
- Test repository methods with mock data
- Test validation logic in isolation
- Test field registry registration

### Integration Tests
- Test full submission pipeline
- Test schema versioning workflow
- Test REST API endpoints

## Common Pitfalls

❌ **Don't** modify active schemas directly  
✅ **Do** create new schema version and activate it

❌ **Don't** use global `$wpdb` in controllers  
✅ **Do** add repository method and inject dependency

❌ **Don't** loop over forms to get submission counts  
✅ **Do** use `get_counts_by_forms()` bulk query

❌ **Don't** add features without version bump  
✅ **Do** follow semantic versioning (MAJOR.MINOR.PATCH)

❌ **Don't** break backward compatibility in PATCH releases  
✅ **Do** maintain compatibility or bump MAJOR version

## Version Bump Guidelines

- **PATCH** (1.6.10 → 1.6.11): Bug fixes, security patches, performance improvements
- **MINOR** (1.6.x → 1.7.0): New features, backward compatible
- **MAJOR** (1.x.x → 2.0.0): Breaking changes, API changes

Version MUST be synchronized in:
1. `subtleforms.php` (plugin header)
2. `SUBTLEFORMS_VERSION` constant
3. `package.json`

## Code Style

- Follow WordPress Coding Standards
- Use tabs for indentation (PHP)
- Use 2 spaces for indentation (JS/JSX)
- Run `npm run lint` before committing
- No inline styles in JSX (use SCSS)

## Commit Discipline

Format: `type: subject`

Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `perf:` - Performance improvement
- `security:` - Security patch
- `docs:` - Documentation only
- `chore:` - Maintenance (deps, config)

Each commit must:
- Be atomic (one responsibility)
- Include version bump if behavior changes
- Pass build without errors
