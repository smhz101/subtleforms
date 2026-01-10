# Test Coverage Summary

## Overview

New unit tests have been added to cover critical paths where regressions are most dangerous. These tests focus on data integrity, state management, and user data protection.

## 1. Schema Commands & Integrity

**File:** `resources/admin/components/builder/schema/__tests__/commands.test.js`

### Covered Scenarios:

- **Node Insertion**: Verifies that nodes are correctly added to the tree structure.
- **Field Key Uniqueness**:
  - Ensures `insertNode` generates unique keys for duplicate field types (e.g., `text_1`, `text_2`).
  - Verifies that `duplicateNode` creates a new unique key for the copy.
- **Move Operations**: Tests reparenting and reordering of nodes.
- **Deletion**: Confirms nodes are removed from both the node map and their parent's children list.
- **Invariants**: Verifies that invalid operations (like moving to a non-existent parent) throw errors in development.

## 2. Autosave & Data Protection

**File:** `resources/admin/hooks/__tests__/useDraftAutosave.test.js`

### Covered Scenarios:

- **Debouncing**: Verifies that autosave is not triggered immediately on every keystroke, but waits for the debounce period (500ms).
- **Dirty State**: Ensures autosave only runs when there are actual changes (`isDirty: true`).
- **Error Handling**:
  - Simulates API failures.
  - Verifies that the reducer receives `AUTOSAVE_ERROR` actions.
- **Retry Logic**: Tests that the system attempts to save again after a failure (simulating network glitches).

## 3. Undo/Redo State Machine

**File:** `resources/admin/hooks/__tests__/useBuilderReducer.undo.test.js`

### Covered Scenarios:

- **History Limits**: Verifies that the history stack does not exceed `MAX_HISTORY_LENGTH` (default 50) to prevent memory leaks.
- **Branching History**: Ensures that making a new edit while in the past (after undoing) correctly clears the "future" (redo) stack.
- **Edge Cases**:
  - Undoing when history is empty.
  - Redoing when future is empty.
- **Batching Logic**: Tests the `COMMIT_HISTORY_BATCH` action to ensure high-frequency updates (like dragging) are correctly grouped into single undo points.

## Running Tests

To run these tests, use the standard WordPress scripts test runner:

```bash
npm test
```

Or target specific files:

```bash
npm test -- resources/admin/components/builder/schema/__tests__/commands.test.js
```
