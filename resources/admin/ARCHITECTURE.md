# SubtleForms Admin Architecture

## Directory Structure

```
resources/admin/
├── index.jsx              # Entry point - mounts AdminApp
│
├── app/                   # Application layer
│   ├── AdminApp.jsx       # Main app component with routing
│   ├── routes.js          # Route definitions and config
│   └── store/             # Global state management (reserved)
│       └── index.js
│
├── pages/                 # Page components (one per route)
│   ├── BuilderPage.jsx    # Form builder/editor page
│   ├── DashboardPage.jsx  # Dashboard with stats
│   ├── FormsPage.jsx      # Forms list page
│   ├── SettingsPage.jsx   # Settings page
│   ├── SubmissionDetailPage.jsx  # Single submission view
│   └── SubmissionsPage.jsx       # Submissions list page
│
├── features/              # Domain logic organized by feature
│   ├── fields/            # Field definitions domain
│   │   ├── api.js         # Field-related API calls
│   │   └── hooks.js       # Field-related hooks
│   ├── forms/             # Forms domain
│   │   ├── api.js         # Form CRUD operations
│   │   └── hooks.js       # Form data hooks
│   ├── settings/          # Settings domain
│   │   ├── api.js         # Settings API calls
│   │   └── hooks.js       # Settings hooks
│   └── submissions/       # Submissions domain
│       ├── api.js         # Submission operations
│       └── hooks.js       # Submission hooks
│
├── modals/                # Modal components
│   ├── ConfirmModal.jsx   # Confirmation dialog
│   ├── CreateFormModal.jsx # Form creation wizard
│   └── index.js           # Modal exports
│
├── components/            # Reusable UI components
│   ├── builder/           # Form builder components
│   │   ├── ColumnDropZone.jsx
│   │   ├── ConditionEditor.jsx
│   │   ├── ContainerRenderer.jsx
│   │   ├── ContainerWrapper.jsx
│   │   ├── ConversationalCanvas.jsx
│   │   ├── FieldChrome.jsx
│   │   ├── FieldDock.jsx
│   │   ├── FieldInspector.jsx
│   │   ├── FieldList.jsx
│   │   ├── FieldRenderer.jsx
│   │   ├── FieldToolbar.jsx
│   │   ├── FieldWrapper.jsx
│   │   ├── FormBuilder.jsx
│   │   ├── FormCanvas.jsx
│   │   ├── FormEditor.jsx
│   │   ├── FormEditorHeader.jsx
│   │   ├── FormSettings.jsx
│   │   ├── InlineAddButton.jsx
│   │   ├── InsertFieldButton.jsx
│   │   ├── StepNavigator.jsx
│   │   └── utils/         # Builder-specific utilities
│   │       ├── iconMap.js
│   │       └── schemaTree.js
│   ├── ActionBar.jsx      # Action bar component
│   ├── AdminHeader.jsx    # Admin header
│   ├── AdminShell.jsx     # Admin layout wrapper
│   ├── DataTable.jsx      # Reusable data table
│   ├── ExecutionLog.jsx   # Execution log viewer
│   ├── FormsList.jsx      # Forms list component
│   ├── Notices.jsx        # Notice display
│   ├── SubmissionsTable.jsx  # Submissions table
│   └── TabBar.jsx         # Tab navigation
│
├── hooks/                 # Generic reusable hooks
│   ├── useDebounce.js     # Debounce hook
│   └── index.js           # Hook exports
│
└── utils/                 # Pure utility functions
    └── api.js             # Base API utilities
```

## Architecture Principles

### 1. Import Direction Rules

**Allowed:**

- pages → features → components → utils
- pages → modals
- features → components → utils
- components → utils

**Never allowed:**

- components importing pages
- utils importing React
- pages importing other pages
- features importing other features

### 2. File Responsibilities

#### Pages (`pages/`)

- Represent WordPress admin routes
- Own layout and data fetching
- Compose features and components
- Handle routing-level logic

#### Features (`features/`)

- Domain-specific business logic
- API calls for the domain
- React hooks for data management
- Schema definitions and constants
- **Never** import from other features

#### Modals (`modals/`)

- Self-contained modal dialogs
- Mounted centrally via registry
- Accept props, emit callbacks
- No direct API calls

#### Components (`components/`)

- Pure UI components
- Accept props, emit callbacks
- No API calls or business logic
- Reusable across features

#### Hooks (`hooks/`)

- Generic, reusable hooks
- No feature-specific logic
- No JSX rendering
- Single responsibility

#### Utils (`utils/`)

- Pure functions
- Stateless
- UI-agnostic
- No React imports

### 3. Naming Conventions

- **Pages:** `*Page.jsx` (e.g., `DashboardPage.jsx`)
- **Hooks:** `use*.js` (e.g., `useDebounce.js`)
- **Components:** `PascalCase.jsx` (e.g., `DataTable.jsx`)
- **Features:** `camelCase.js` (e.g., `api.js`, `hooks.js`)
- **Constants:** `UPPER_SNAKE_CASE`

### 4. Import Patterns

**Prefer:**

```javascript
// Using index exports
import { ConfirmModal, CreateFormModal } from '../modals';
import { useDebounce } from '../hooks';
```

**Avoid:**

```javascript
// Deep relative paths
import Modal from '../../../components/modals/ConfirmModal';
```

### 5. Component Guidelines

**Good Component:**

```javascript
export default function Button({ onClick, children, variant }) {
	return (
		<button onClick={onClick} className={`btn-${variant}`}>
			{children}
		</button>
	);
}
```

**Bad Component:**

```javascript
export default function Button({ formId }) {
	const [data, setData] = useState(null);

	useEffect(() => {
		// ❌ API call in component
		fetch(`/api/forms/${formId}`)
			.then((r) => r.json())
			.then(setData);
	}, [formId]);

	return <button>{data?.title}</button>;
}
```

### 6. Feature Guidelines

**Good Feature Hook:**

```javascript
// features/forms/hooks.js
import { useEffect, useState } from '@wordpress/element';
import { getForms } from './api';

export function useForms() {
	const [forms, setForms] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getForms()
			.then(setForms)
			.finally(() => setLoading(false));
	}, []);

	return { forms, loading };
}
```

**Usage in Page:**

```javascript
// pages/FormsPage.jsx
import { useForms } from '../features/forms/hooks';

export default function FormsPage() {
	const { forms, loading } = useForms();

	if (loading) return <Spinner />;
	return <FormsList forms={forms} />;
}
```

## Migration Guide

### Moving a Component to a Page

1. Move file to `pages/` directory
2. Rename to match `*Page.jsx` convention
3. Update imports to use `../components/`, `../features/`, etc.
4. Extract any business logic to features
5. Update route in `app/AdminApp.jsx`

### Creating a New Feature

1. Create directory in `features/`
2. Add `api.js` with API functions
3. Add `hooks.js` with React hooks
4. Export hooks from `index.js` (optional)
5. Use in pages, never in other features

### Adding a Modal

1. Create modal component in `modals/`
2. Export from `modals/index.js`
3. Import in page using `import { ModalName } from '../modals'`
4. Pass open state and callbacks as props

## Benefits

- **Scalability:** Clear structure supports growth
- **Maintainability:** Easy to find and modify code
- **Testability:** Pure components and utilities
- **Reusability:** Components work across features
- **Type Safety:** Clear boundaries enable better typing
- **Onboarding:** New developers understand structure quickly
- **Debugging:** Dependency direction prevents circular issues

## Common Patterns

### Page with Data Fetching

```javascript
import { useState, useEffect } from '@wordpress/element';
import { useForms } from '../features/forms/hooks';
import FormsList from '../components/FormsList';
import AdminShell from '../components/AdminShell';

export default function FormsPage() {
	const { forms, loading, error } = useForms();

	return (
		<AdminShell title='All Forms'>
			{loading && <Spinner />}
			{error && <Notice status='error'>{error}</Notice>}
			{forms && <FormsList forms={forms} />}
		</AdminShell>
	);
}
```

### Component with Callback

```javascript
export default function FormsList({ forms, onEdit, onDelete }) {
	return (
		<div className='forms-list'>
			{forms.map((form) => (
				<FormCard
					key={form.id}
					form={form}
					onEdit={() => onEdit(form.id)}
					onDelete={() => onDelete(form.id)}
				/>
			))}
		</div>
	);
}
```

### Feature Hook with Mutations

```javascript
export function useForm(formId) {
	const [form, setForm] = useState(null);
	const [saving, setSaving] = useState(false);

	const saveForm = useCallback(
		async (data) => {
			setSaving(true);
			try {
				const updated = await updateForm(formId, data);
				setForm(updated);
			} finally {
				setSaving(false);
			}
		},
		[formId]
	);

	return { form, saving, saveForm };
}
```

## Testing Strategy

- **Utils:** Unit test pure functions
- **Hooks:** Test with React Testing Library
- **Components:** Component tests with snapshots
- **Features:** Mock API calls, test hooks
- **Pages:** Integration tests
- **E2E:** Playwright for critical flows

## Future Improvements

- [ ] Add TypeScript for type safety
- [ ] Implement global state management in `app/store/`
- [ ] Add feature schemas and validators
- [ ] Create component library documentation
- [ ] Add performance monitoring
- [ ] Implement code splitting per route
