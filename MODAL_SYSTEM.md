# Modal System Documentation

## Overview

SubtleForms uses a standardized modal system for consistent user experience across all dialogs. As of v1.1.30, all confirmation modals use the `ConfirmModal` component with flat, minimal design.

## Components

### ConfirmModal

Reusable confirmation modal component with consistent styling and behavior.

**Location:** `resources/admin/components/ConfirmModal.jsx`

**Props:**

- `isOpen` (boolean, required): Controls modal visibility
- `onClose` (function, required): Called when modal is closed
- `title` (string, required): Modal title
- `message` (string, required): Confirmation message
- `onConfirm` (function, required): Called when user confirms
- `confirmText` (string, optional): Confirm button text (default: "Confirm")
- `confirmVariant` (string, optional): Button style - 'primary' or 'destructive' (default: 'primary')
- `onSecondary` (function, optional): Secondary action (for 3-button modals)
- `secondaryText` (string, optional): Secondary button text
- `cancelText` (string, optional): Cancel button text (default: "Cancel")
- `isLoading` (boolean, optional): Shows loading state on confirm button

**Example Usage:**

```jsx
import ConfirmModal from './components/ConfirmModal';

// Simple confirmation (2 buttons)
<ConfirmModal
	isOpen={showDeleteModal}
	onClose={() => setShowDeleteModal(false)}
	title="Delete Form"
	message="Are you sure you want to delete this form? This action cannot be undone."
	onConfirm={handleDelete}
	confirmText="Delete"
	confirmVariant="destructive"
	isLoading={isDeleting}
/>

// Three-button modal (Save/Discard/Cancel)
<ConfirmModal
	isOpen={showDiscardModal}
	onClose={() => setShowDiscardModal(false)}
	title="Unsaved Changes"
	message="You have unsaved changes. Would you like to save them before leaving?"
	onConfirm={handleSaveDraft}
	confirmText="Save Draft"
	confirmVariant="primary"
	onSecondary={handleDiscardChanges}
	secondaryText="Discard Changes"
	cancelText="Cancel"
/>
```

### CreateFormModal

Two-step wizard for creating new forms.

**Location:** `resources/admin/components/CreateFormModal.jsx`

**Features:**

- **Step 1 - Form Details:**

  - Form title (required)
  - Description (optional)
  - Template selection (Blank or Template)

- **Step 2 - Form Structure:**
  - Form type: Regular, Multi-step, or Sectioned
  - Each type creates appropriate initial field structure

**Styling:** Fully Tailwind-based with sharp edges and minimal design

## Design System

### Visual Style

- **Border Radius:** 0 (sharp edges enforced via CSS)
- **Shadows:** None (flat design)
- **Colors:**
  - Primary: `#2563eb` (blue-600)
  - Destructive: `#dc2626` (red-600)
  - Gray: `#6b7280` (gray-500)
  - Background: `#ffffff`
  - Border: `#d1d5db` (gray-300)

### Button Styling

```jsx
// Primary button
className =
	'inline-flex items-center justify-center px-4 h-9 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border-0 cursor-pointer transition-colors duration-150';

// Destructive button
className =
	'inline-flex items-center justify-center px-4 h-9 text-sm font-medium text-white bg-red-600 hover:bg-red-700 border-0 cursor-pointer transition-colors duration-150';

// Secondary button
className =
	'inline-flex items-center justify-center px-4 h-9 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 cursor-pointer transition-colors duration-150';
```

### Modal Layout

- **Max Width:** 480px (ConfirmModal), full-width (CreateFormModal)
- **Padding:** 24px
- **Gap:** 3 (12px) between buttons
- **Border:** 1px solid #d1d5db

## CSS Classes

### .subtleforms-confirm-modal

Applied to ConfirmModal wrapper for consistent styling:

- Sharp edges (border-radius: 0)
- Max width constraint (480px)
- Close button positioning
- Consistent padding and spacing

### .subtleforms-create-modal

Applied to CreateFormModal wrapper:

- Full-width layout
- Step indicator styling
- Form field margins
- Navigation buttons

## Migration Guide

When adding new modals:

1. **For simple confirmations** (Yes/No, Delete/Cancel):

   - Use `ConfirmModal` component
   - Set appropriate `confirmVariant` ('primary' or 'destructive')

2. **For three-button flows** (Save/Discard/Cancel):

   - Use `ConfirmModal` with `onSecondary` prop
   - Primary action is confirm, secondary is alternate action

3. **For complex forms**:
   - Create custom modal with `.subtleforms-*-modal` class
   - Use Tailwind classes matching design system
   - Ensure sharp edges (border-radius: 0)

## Keyboard Navigation

All modals support:

- **Escape:** Close modal
- **Tab:** Navigate between buttons
- **Enter:** Confirm action (when focused)
- **Auto-focus:** First button on open

## Testing Checklist

When adding/modifying modals:

- [ ] Sharp edges (no rounded corners except close button hover)
- [ ] Consistent button heights (h-9 / 36px)
- [ ] Proper spacing (gap-3 / 12px)
- [ ] Loading states work correctly
- [ ] Keyboard navigation functions
- [ ] Close button works (X and Cancel)
- [ ] Escape key closes modal
- [ ] Focus returns to trigger element on close

## Version History

- **v1.1.30:** Standardized modal system with ConfirmModal component
- **v1.1.28:** Introduced flat UI design, removed rounded corners
- **v1.1.27:** Initial unified admin layout shell
