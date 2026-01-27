# SubtleForms Development Guide

This document provides architectural context for developers maintaining or extending SubtleForms.

## Architecture Overview

SubtleForms follows a clean architecture with clear separation of concerns:

- **UI Layer**: React components with WordPress Components
- **State Layer**: TanStack Query for server state, React Context for builder state
- **Data Layer**: REST API integration via custom hooks
- **Policy Layer**: Centralized Pro feature access control
- **Diagnostics**: Internal-only event logging and performance tracking

## Key Design Patterns

### 1. Builder State Management (Immutable Tree + FSM)

The form builder uses an **immutable tree structure** with **functional updates**:

```javascript
// Tree operations return new trees (never mutate)
const newTree = insertNode(tree, { parentId, type: 'text', config: {} });
```

**Why immutable?**
- Reliable undo/redo
- React render optimization
- Predictable state updates
- Easier debugging (snapshot history)

**Builder FSM states:**
- `idle`: Ready for user interaction
- `dragging`: User dragging a field
- `inserting`: Inserting new field
- `moving`: Repositioning existing field

Location: `/resources/admin/components/builder/context/`

### 2. Policy Layer (Capability-Based Access Control)

Instead of checking license status everywhere, components query **abilities**:

```jsx
const { can, loading, ready, reason } = useAbility('templates.pro');

if (!ready) return <Loading />;
if (!can) return <UpgradePrompt reason={reason} />;
return <ProFeature />;
```

**Benefits:**
- Single source of truth for Pro features
- Consistent upgrade messaging
- Easy to test (mock abilities)
- Graceful degradation during grace period

**Adding a new capability:**
1. Add to `CAPABILITIES` in `/resources/admin/policies/abilities.js`
2. Backend returns capability in `license.capabilities`
3. Use `useAbility('your.capability')` in components

Location: `/resources/admin/policies/abilities.js`

### 3. TanStack Query Integration

Server state (forms, templates, license) uses **TanStack Query v5**:

```javascript
const { data, isLoading, error } = useForms();
```

**Benefits:**
- Automatic caching and refetching
- Optimistic updates
- Background synchronization
- Stale-while-revalidate pattern

**Query Configuration:**
- Forms list: `staleTime: 30s` (frequently changing)
- Form details: `staleTime: 2min` (less volatile)
- Templates: `staleTime: 5min` (rarely change)

Location: `/resources/admin/data/queries/`

### 4. Modal Orchestration

Modals are managed through **ModalProvider** context to prevent z-index wars:

```jsx
const { openModal, closeModal } = useModalContext();

openModal('confirmDelete', { formId: 123 });
```

**Why centralized?**
- Prevents multiple modals stacking incorrectly
- Single escape-key handler
- Focus management
- Consistent animations

Location: `/resources/admin/modals/ModalProvider.jsx`

### 5. Diagnostics (Privacy-First)

Internal-only logging with **NO external analytics**:

```javascript
import { logger, perfMarkers } from '../diagnostics';

// Performance tracking
perfMarkers.start('fetch-forms');
const result = await fetchForms();
const duration = perfMarkers.end('fetch-forms');
logger.slow('fetch-forms', duration, 2000); // warn if >2s

// Error tracking with context
logger.error('Failed to save', error, { formId, fieldCount });

// Feature usage (internal only)
logger.feature('conditional-logic', 'enabled');
```

**Configuration:**
- Disable: `window.subtleformsAdmin.diagnostics = false`
- Dev mode: Exposed as `window.subtleformsLogger`
- Max 100 events in memory (prevents leaks)

Location: `/resources/admin/diagnostics/`

## Extension Points (Stable APIs)

### Safe to Extend

1. **Field Type Definitions** (`/resources/admin/components/builder/fields/definitions.js`)
   - Add custom field types
   - Register renderers
   - Define validation rules

2. **Abilities Policy** (`/resources/admin/policies/abilities.js`)
   - Add new capabilities
   - Customize grace period behavior
   - Implement custom upgrade logic

3. **Template System** (`/resources/admin/templates/`)
   - Add template categories
   - Create custom templates
   - Implement template transformations

4. **Modal Registry** (`/resources/admin/modals/registry.js`)
   - Register custom modals
   - Use ModalProvider for orchestration

### Internal APIs (Do Not Depend On)

1. **Builder Internals** (`/components/builder/context/`)
   - Tree manipulation functions
   - Drag-and-drop handlers
   - Internal React Context

2. **Schema Tree Structure**
   - Node IDs and parent relationships
   - Internal tree traversal utilities

3. **REST API Response Formats**
   - Use TanStack Query hooks instead
   - Don't parse responses directly

## Performance Considerations

### Bundle Size

Current: **552 KiB** (Phase 3 baseline)

**Heavy Dependencies:**
- `@dnd-kit/*`: 45 KiB (drag-and-drop)
- `@wordpress/components`: 120 KiB (UI primitives)
- `@tanstack/react-query`: 35 KiB (server state)

**Optimization Strategies:**
- Code splitting: Lazy-load builder components
- Tree shaking: Use named imports
- Avoid: Lodash (use native JS), Moment.js (use date-fns or native)

### Re-Render Prevention

- **Builder components**: Extensively use `useCallback` and `useMemo`
- **FormsList**: Memoized filters and sorting
- **FieldInspector**: Memoized config panel

**Audit tool:**
```javascript
// Enable in dev
window.subtleformsAdmin.diagnostics = true;
perfMarkers.start('component-render');
// ... render logic
perfMarkers.end('component-render');
```

### Query Optimization

```javascript
// Forms list: Short staleTime (data changes frequently)
useQuery({ queryKey: ['forms'], staleTime: 30_000 });

// Templates: Long staleTime (rarely change)
useQuery({ queryKey: ['templates'], staleTime: 300_000 });
```

## Debugging

### Enable Diagnostics

```javascript
// In browser console
window.subtleformsAdmin.diagnostics = true;

// View event log
window.subtleformsLogger.getEvents();

// View performance entries
window.subtleformsPerfMarkers.getEntries();
```

### React DevTools

Install [React Developer Tools](https://react.dev/learn/react-developer-tools) to inspect:
- Component tree
- Context values
- Re-render causes

### TanStack Query DevTools

```javascript
// Add to development environment (package.json)
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// In AdminShell.jsx (dev only)
{process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
```

## Testing Guidelines

### Unit Tests (Recommended)

```bash
npm test
```

**Priority areas:**
- Tree manipulation utilities (`/utils/schemaTree.js`)
- Validation logic
- Policy layer (`abilities.js`)
- Data transformations

### Integration Tests

- Test builder FSM state transitions
- Test modal orchestration
- Test query caching behavior

### Manual Testing Checklist

- [ ] Create form from template
- [ ] Add/remove/reorder fields
- [ ] Undo/redo operations
- [ ] Pro feature gating (without license)
- [ ] Grace period behavior
- [ ] Form validation
- [ ] Export/import forms

## Common Pitfalls

### ❌ DON'T: Mutate tree directly

```javascript
// WRONG
tree.nodes[nodeId].config.label = 'New Label';
```

```javascript
// CORRECT
const newTree = updateNodeConfig(tree, nodeId, { label: 'New Label' });
```

### ❌ DON'T: Check license state in components

```javascript
// WRONG
const { data: license } = useLicense();
if (license?.plan === 'pro') { /* ... */ }
```

```javascript
// CORRECT
const { can } = useAbility('templates.pro');
if (can) { /* ... */ }
```

### ❌ DON'T: Create multiple modal z-index layers

```javascript
// WRONG
<Modal isOpen={showModal} style={{ zIndex: 9999 }}>
```

```javascript
// CORRECT
const { openModal } = useModalContext();
openModal('myModal', { /* data */ });
```

### ❌ DON'T: Use unstable callbacks in builder

```javascript
// WRONG (causes re-renders)
<FieldInspector onChange={(config) => updateField(config)} />
```

```javascript
// CORRECT
const handleChange = useCallback((config) => {
  updateField(config);
}, [updateField]);
<FieldInspector onChange={handleChange} />
```

## File Organization

```
resources/admin/
├── components/          # React components
│   ├── builder/        # Form builder (drag-drop, canvas)
│   │   ├── context/    # Builder state management
│   │   ├── fields/     # Field renderers and definitions
│   │   └── utils/      # Tree utilities (STABLE)
│   ├── ui/             # Reusable UI components
│   └── *.jsx           # Page-level components
├── data/               # TanStack Query hooks
│   └── queries/        # Query definitions (forms, templates, license)
├── diagnostics/        # Internal logging and perf tracking
├── modals/             # Modal orchestration
├── policies/           # Pro feature access control (STABLE)
├── styles/             # SCSS with BEM methodology
├── templates/          # Template system
└── utils/              # Shared utilities
```

## Build and Deploy

### Development Build

```bash
npm run start
# Watch mode with hot reload
```

### Production Build

```bash
npm run build
# Optimized bundle in /build/
```

### Bundle Analysis

```bash
npm run build:report
# Opens webpack-bundle-analyzer
```

## Migration Guide (Future Versions)

### Deprecation Policy

1. **Mark as deprecated** with `@deprecated` JSDoc tag
2. **Add migration path** in documentation
3. **Console warning** in development mode
4. **Remove after 2 major versions**

### Breaking Changes

**Phase 5+ may include:**
- TypeScript migration (gradual, component-by-component)
- Builder state moved to Zustand (if complexity grows)
- REST API → GraphQL (for advanced queries)

**Guaranteed stable until v2.0:**
- `useAbility()` hook API
- Field type definitions structure
- TanStack Query integration pattern
- Modal orchestration API

## Getting Help

- **Documentation**: `/README.md` and inline JSDoc comments
- **Architecture questions**: Check this file (`DEVELOPMENT.md`)
- **Debugging**: Enable diagnostics (`window.subtleformsAdmin.diagnostics = true`)

---

**Last Updated**: Phase 4 (Performance hardening, diagnostics, onboarding, monetization polish)
