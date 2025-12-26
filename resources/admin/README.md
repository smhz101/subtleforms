# SubtleForms Admin - Developer Guide

## Quick Start

```bash
# Install dependencies
npm install

# Start development
npm run build

# Watch mode (if available)
npm run build:watch
```

## Project Structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete architecture documentation.

```
resources/admin/
├── app/          # Application entry and routing
├── pages/        # Page components (routes)
├── features/     # Domain logic (API + hooks)
├── modals/       # Modal components
├── components/   # Reusable UI components
├── hooks/        # Generic hooks
└── utils/        # Pure utilities
```

## Adding New Features

### 1. Create a New Page

```bash
# Create the page file
touch resources/admin/pages/MyNewPage.jsx
```

```javascript
// pages/MyNewPage.jsx
import AdminShell from '../components/AdminShell';

export default function MyNewPage() {
  return (
    <AdminShell title="My New Page">
      <p>Content goes here</p>
    </AdminShell>
  );
}
```

**Add route in `app/AdminApp.jsx`:**
```javascript
import MyNewPage from '../pages/MyNewPage';

// In the render method:
{page === 'my-new-page' && <MyNewPage />}
```

### 2. Create a Feature

```bash
mkdir -p resources/admin/features/myfeature
touch resources/admin/features/myfeature/api.js
touch resources/admin/features/myfeature/hooks.js
```

```javascript
// features/myfeature/api.js
import { apiGet, apiPost } from '../../utils/api';

export async function getItems() {
  return apiGet('/myfeature/items');
}

export async function createItem(data) {
  return apiPost('/myfeature/items', data);
}
```

```javascript
// features/myfeature/hooks.js
import { useState, useEffect } from '@wordpress/element';
import { getItems } from './api';

export function useItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    getItems()
      .then(response => setItems(response.body))
      .finally(() => setLoading(false));
  }, []);
  
  return { items, loading };
}
```

### 3. Create a Component

```bash
touch resources/admin/components/MyComponent.jsx
```

```javascript
// components/MyComponent.jsx
import { Button } from '@wordpress/components';

export default function MyComponent({ title, onAction }) {
  return (
    <div className="my-component">
      <h2>{title}</h2>
      <Button onClick={onAction}>Click Me</Button>
    </div>
  );
}
```

### 4. Create a Modal

```bash
touch resources/admin/modals/MyModal.jsx
```

```javascript
// modals/MyModal.jsx
import { Modal, Button } from '@wordpress/components';

export default function MyModal({ isOpen, onClose, onConfirm }) {
  return (
    <Modal
      title="My Modal"
      isOpen={isOpen}
      onRequestClose={onClose}>
      <p>Modal content</p>
      <Button variant="primary" onClick={onConfirm}>
        Confirm
      </Button>
    </Modal>
  );
}
```

**Export from `modals/index.js`:**
```javascript
export { default as MyModal } from './MyModal';
```

## Import Rules

### ✅ DO

```javascript
// Import from modals registry
import { ConfirmModal } from '../modals';

// Import features
import { useForms } from '../features/forms/hooks';

// Import components
import DataTable from '../components/DataTable';

// Import utils
import { apiGet } from '../utils/api';
```

### ❌ DON'T

```javascript
// Deep relative paths
import Modal from '../../../modals/ConfirmModal';

// Cross-feature imports
import { useForms } from '../../features/forms/hooks'; // from features/submissions/

// API calls in components
function MyComponent() {
  useEffect(() => {
    fetch('/api/data'); // ❌ Use features/hooks instead
  }, []);
}
```

## Styling

### Tailwind CSS

Use Tailwind utility classes:

```javascript
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
  <Button className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700">
    Click Me
  </Button>
</div>
```

### Using classnames

For conditional classes:

```javascript
import classNames from 'classnames';

<div className={classNames(
  'base-class',
  {
    'active': isActive,
    'disabled': isDisabled,
  }
)}>
  Content
</div>
```

### Component-specific CSS

Only for complex components:

```javascript
import './MyComponent.css';

export default function MyComponent() {
  return <div className="my-component">...</div>;
}
```

## State Management

### Local State
```javascript
const [count, setCount] = useState(0);
```

### Feature Hooks
```javascript
const { forms, loading } = useForms();
```

### WordPress Data Stores (if needed)
```javascript
import { useSelect, useDispatch } from '@wordpress/data';

const notices = useSelect(select => 
  select('core/notices').getNotices()
);
```

## Common Patterns

### Loading States
```javascript
if (loading) return <Spinner />;
if (error) return <Notice status="error">{error}</Notice>;
if (!data) return null;
```

### Confirmation Dialogs
```javascript
const [showConfirm, setShowConfirm] = useState(false);

<ConfirmModal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  title="Delete Item"
  message="Are you sure?"
/>
```

### Data Fetching
```javascript
useEffect(() => {
  setLoading(true);
  getItems()
    .then(response => setItems(response.body))
    .catch(error => setError(error.message))
    .finally(() => setLoading(false));
}, []);
```

## Icons

Use react-icons (Feather Icons):

```javascript
import { FiCheck, FiX, FiEdit } from 'react-icons/fi';

<FiCheck className="w-4 h-4 text-green-600" />
```

## API Calls

Always use the base API utilities:

```javascript
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';

// GET request
const { ok, body } = await apiGet('/forms');

// POST request
const { ok, body } = await apiPost('/forms', { title: 'New Form' });

// PUT request
const { ok, body } = await apiPut('/forms/123', { title: 'Updated' });

// DELETE request
const { ok, body } = await apiDelete('/forms/123');
```

## Debugging

### Browser Console
```javascript
console.debug('Debug info:', data);
console.error('Error occurred:', error);
```

### React DevTools
Install React DevTools browser extension to inspect component tree.

### Network Tab
Check the Network tab in browser DevTools for API calls.

## Git Workflow

### Commit Messages

Follow conventional commits:

```bash
feat(admin): add new dashboard widget
fix(forms): correct validation error handling
refactor(admin): restructure components directory
style(ui): update button styling
docs(readme): update installation instructions
```

### Branch Strategy

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat(admin): add new feature"

# Push to remote
git push origin feature/my-feature
```

## Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Import Errors

- Check file paths are correct
- Verify exports exist
- Use correct import syntax (default vs named)

### WordPress Integration Issues

- Check `window.subtleformsAdmin` is available
- Verify REST API nonce is present
- Check WordPress is properly enqueuing scripts

## Resources

- [WordPress Components](https://developer.wordpress.org/block-editor/reference-guides/components/)
- [React Hooks](https://react.dev/reference/react)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Icons](https://react-icons.github.io/react-icons/)

## Need Help?

1. Check [ARCHITECTURE.md](./ARCHITECTURE.md) for structure guidelines
2. Review existing components for patterns
3. Search codebase for similar implementations
4. Check browser console for errors
