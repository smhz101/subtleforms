# Accessibility Audit & Fixes

## Summary

This audit focused on keyboard navigation, focus management, and ARIA roles within the Form Builder UI. The goal was to ensure the builder is usable via keyboard and screen readers, adhering to WordPress accessibility standards.

## Key Findings & Fixes

### 1. Canvas Focus & Field Selection

- **Issue**: Fields on the canvas were not keyboard focusable. Users could not select a field to edit its properties without using a mouse.
- **Fix**:
  - Made the field wrapper (`FieldChrome`) focusable (`tabIndex="0"`).
  - Added `role="group"` and `aria-label` to describe the field.
  - Added `onKeyDown` handler to allow selection via `Enter` or `Space` keys.
  - Ensured internal preview inputs are removed from the tab order (`tabIndex="-1"`) to prevent confusion.

### 2. Drag and Drop

- **Issue**: The drag-and-drop functionality relied solely on pointer events (mouse/touch), making it inaccessible to keyboard users.
- **Fix**:
  - Integrated `KeyboardSensor` and `sortableKeyboardCoordinates` from `@dnd-kit` into `FormBuilder`.
  - This allows users to move fields using arrow keys when a drag handle is activated.

### 3. Modal Dialogs (Field Picker)

- **Issue**: The "Add Field" popover lacked explicit ARIA roles and focus management properties.
- **Fix**:
  - Added `role="dialog"` and `aria-label` to the popover content.
  - Enabled `focusOnMount` to ensure focus moves into the popover when opened.

### 4. Inspector Focus

- **Observation**: The DOM order (Dock -> Canvas -> Inspector) supports a natural tab flow.
- **Result**: No structural changes were needed. The improved focusability of the canvas fields ensures users can navigate from the canvas to the inspector seamlessly.

## Verification

- **Keyboard Navigation**: Verify that you can tab through the fields on the canvas and select them with Enter.
- **Drag & Drop**: Verify that you can tab to a drag handle, press Enter/Space to lift, use Arrow keys to move, and Enter/Space to drop.
- **Screen Reader**: Verify that fields are announced as groups and the "Add Field" popover is announced as a dialog.
