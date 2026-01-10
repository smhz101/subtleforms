# SubtleForms AI Development Guide

## Project Overview

SubtleForms is a WordPress form plugin with a React-based admin interface. It uses a **pipeline architecture** for form processing and follows **domain-driven design** principles.

## Key Architecture Patterns

### 1. React Admin Structure (resources/admin/)

```
pages/          # Route components (BuilderPage, FormsPage, etc.)
features/       # Domain logic (forms/, fields/, submissions/, settings/)
  └── */api.js  # API calls for domain
  └── */hooks.js# React hooks for domain
components/     # Reusable UI components
  └── builder/  # Form builder specific components
modals/         # Modal dialogs
utils/          # Pure utilities
```

**Import Direction Rules:**

- ✅ pages → features → components → utils
- ❌ Never: components importing pages, utils importing React

### 2. PHP Backend Structure (src/)

- **Pipeline Processing**: Form submissions flow through `Engine/Pipeline.php` with configurable steps
- **Repository Pattern**: Data access via `FormsRepository`, `SubmissionsRepository`
- **Extension System**: Plugin architecture via `Extensions/ExtensionManager.php`
- **REST API**: Single controller `Api/RestController.php` with namespace `subtleforms/v1`

### 3. WordPress-Specific Patterns

**Tailwind Configuration:**

- Prefix: `sf-` (e.g., `sf-bg-primary`)
- Scoped under `.subtleforms-admin` class
- `preflight: false` to avoid WordPress conflicts

**Asset Building:**

- Admin: `npm run build` → `build/admin/admin.js`
- Frontend: `npm run build:frontend` → `build/frontend/frontend.js`
- Blocks: `npm run build:block` → `build/blocks/`

## Development Workflows

### Starting Development

```bash
npm install
npm run start  # Builds admin + watches Tailwind
```

### Feature Development

1. **Create API endpoints** in `src/Api/RestController.php`
2. **Add API calls** in `resources/admin/features/{domain}/api.js`
3. **Create React hooks** in `resources/admin/features/{domain}/hooks.js`
4. **Build UI components** in `resources/admin/components/`
5. **Wire to pages** in `resources/admin/pages/`

### Testing Strategy

- **E2E**: Playwright tests in `tests/e2e/`
- **Run**: `npm run test:e2e`
- **Config**: Uses WP test site at `https://theme-wp.test` by default

## Critical Code Patterns

### API Communication

```javascript
// resources/admin/utils/api.js provides base functions
import { apiGet, apiPost } from '../../utils/api';

// Domain-specific APIs follow this pattern
export async function getForms() {
	return await apiGet('/forms');
}
```

### Form Builder Architecture

- **Drag & Drop**: Uses `@dnd-kit` for field manipulation
- **Schema Storage**: Forms stored as JSON schema in database
- **Field Registry**: Extensible field types via PHP `FieldRegistry`
- **Conditional Logic**: Real-time show/hide based on form state

### WordPress Integration

- **Shortcode**: `[subtleforms id="123"]`
- **Block**: Gutenberg block via `resources/blocks/`
- **Hooks**: WordPress actions/filters in PHP components
- **Permissions**: Capability-based access control

## Extension Points

### Adding Custom Fields

1. **PHP**: Register in `src/Fields/FieldRegistry.php`
2. **React**: Add component in `resources/admin/components/builder/`
3. **Schema**: Define validation/structure

### Pipeline Steps

Extend form processing by implementing `PipelineStepInterface`:

```php
class CustomStep implements PipelineStepInterface {
    public function process(SubmissionContext $context): PipelineResult
}
```

## Database Schema

- `{prefix}_subtleforms_forms` - Form definitions (JSON schema)
- `{prefix}_subtleforms_submissions` - User submissions
- `{prefix}_subtleforms_logs` - Processing audit trail

## WordPress Dependencies

- **Minimum**: WordPress 6.0, PHP 8.1
- **WordPress Scripts**: Uses `@wordpress/scripts` for React builds
- **Components**: Leverages `@wordpress/components` for UI consistency

## Key Files to Reference

- [ARCHITECTURE.md](resources/admin/ARCHITECTURE.md) - Complete React structure
- [subtleforms.php](subtleforms.php) - Plugin entry point and constants
- [RestController.php](src/Api/RestController.php) - API endpoints
- [routes.js](resources/admin/app/routes.js) - Admin routing logic
- [package.json](package.json) - Build scripts and dependencies
