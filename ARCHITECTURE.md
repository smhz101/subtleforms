# SubtleForms Builder Architecture

## Overview

The SubtleForms Builder is a React-based Single Page Application (SPA) embedded within the WordPress Admin. It uses a normalized state tree, a strict Finite State Machine (FSM) for lifecycle management, and a command-based mutation layer.

## Core Concepts

### 1. Data Model (Normalized Tree)

Instead of a nested JSON structure, the builder uses a normalized tree to ensure O(1) lookups and simplified drag-and-drop logic.

```javascript
{
  rootId: "root",
  nodes: {
    "root": { id: "root", children: ["node_1", "node_2"] },
    "node_1": { id: "node_1", type: "text", config: { ... } },
    "node_2": { id: "node_2", type: "container", children: ["node_3"] }
  }
}
```

### 2. Finite State Machine (FSM)

The builder lifecycle is governed by a strict FSM implemented in `useBuilderReducer.js`.

**Key States:**

- `INIT`: Initial loading state.
- `EDITING`: Stable state, ready for user interaction.
- `DIRTY`: Unsaved changes exist.
- `AUTOSAVING`: Async save in progress.
- `SAVED`: Changes persisted.
- `ERROR`: Critical failure state.

**Behavior:**

- **Development**: Invalid transitions throw errors to catch bugs early.
- **Production**: Invalid transitions are ignored or fail safely to prevent crashes.

### 3. Schema Commands

All state mutations are performed by pure functions in `schema/commands/`. These functions take the current tree and a command object, returning a **new** immutable tree.

- `insertNode(tree, { definition, parentId, index })`
- `moveNode(tree, { nodeId, parentId, index })`
- `updateNodeConfig(tree, { nodeId, changes })`
- `deleteNode(tree, { nodeId })`

## Data Flow

1. **User Interaction**: User drags a field or changes a setting.
2. **Action Dispatch**: Component calls a handler from `BuilderContext` (e.g., `onMove`).
3. **Reducer Processing**: `useBuilderReducer` receives the action.
   - Validates FSM transition (e.g., `EDITING` -> `DIRTY`).
   - Calls the appropriate **Schema Command**.
4. **State Update**: Reducer updates the `draftSchema` and pushes to history (Undo/Redo).
5. **Render**: `BuilderContext` propagates the new tree to components.

## Context Boundaries

### `BuilderProvider`

The source of truth for the active form session.

- **Holds**: Current Tree, Selection State, Validation Errors.
- **Exposes**: Command functions and Action handlers.

### `FormEditor`

The layout orchestrator.

- **Manages**: Panels (Dock, Canvas, Inspector).
- **Integrates**: `useDraftAutosave` (Side effect for persistence).
- **Integrates**: `useBuilderReducer` (State logic).

## Undo/Redo Strategy

- **Batching**: High-frequency updates (like dragging) are batched.
- **Commit**: History is committed only when the user stops interacting (debounce) or explicitly finishes an action.
- **Memory**: History stack is capped (default 50) to prevent memory leaks.

## Directory Structure

```
resources/admin/components/builder/
├── context/          # React Context definitions
├── schema/           # Pure schema manipulation logic
│   └── commands/     # Mutation functions (insert, move, etc.)
├── utils/            # Helpers (ID generation, tree traversal)
├── FormEditor.jsx    # Main entry point & layout
├── FormBuilder.jsx   # Canvas & Drag-and-Drop logic
└── FieldInspector.jsx # Property editing panel
```
