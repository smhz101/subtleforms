# Schema Command Layer - Implementation Summary

## Overview

Created a single, authoritative schema mutation layer using a command API pattern. All schema mutations now go through validated command functions that ensure immutability and data integrity.

## Architecture

### Location

- **Command Layer**: `resources/admin/components/builder/schema/commands/`
  - `invariants.js` - Validation functions
  - `index.js` - Command implementations

### Design Principles

1. **Immutability**: All commands return new tree structures
2. **Validation**: Invariants checked before mutations
3. **Single Responsibility**: Each command handles one operation type
4. **Fail Fast**: Throws errors in development on invalid operations

## Commands Implemented

### 1. `insertNode(tree, command)`

**Purpose**: Insert a new field/node into the schema tree

**Command Structure**:

```javascript
{
  definition: fieldDefinition,  // From fieldDefinitions registry
  parentId: 'node_xyz',         // Parent node ID (or ROOT)
  columnIndex: 0,               // For column containers (null otherwise)
  position: 2                   // Position in children array (null = append)
}
```

**Validations**:

- Parent must exist
- Column index must be valid (if specified)
- Tree integrity validated after insertion

### 2. `moveNode(tree, command)`

**Purpose**: Move an existing node to a new location

**Command Structure**:

```javascript
{
  nodeId: 'node_abc',          // Node to move
  parentId: 'node_xyz',        // New parent
  columnIndex: null,           // Column index (for column containers)
  position: 1                  // Position in new parent's children
}
```

**Validations**:

- Cannot move root node
- Node must exist
- Parent must exist
- Cannot move into own descendant (prevents circular refs)
- Column index must be valid (if specified)

### 3. `deleteNode(tree, command)`

**Purpose**: Delete a node and all its descendants

**Command Structure**:

```javascript
{
	nodeId: 'node_abc'; // Node to delete
}
```

**Validations**:

- Cannot delete root node
- Node must exist
- Cannot delete last step in multi-step form
- Recursively collects and deletes all descendants

### 4. `duplicateNode(tree, command)`

**Purpose**: Clone a node and all its descendants

**Command Structure**:

```javascript
{
  nodeId: 'node_abc',          // Node to duplicate
  destination: {
    parentId: 'node_xyz',
    columnIndex: null,
    position: 1
  }
}
```

**Returns**: `{ tree, newNodeId }`

**Validations**:

- Node must exist
- Destination parent must exist
- Column index must be valid (if specified)
- Generates new IDs and keys for all cloned nodes

### 5. `updateNodeConfig(tree, command)`

**Purpose**: Update node configuration (non-structural changes)

**Command Structure**:

```javascript
{
  nodeId: 'node_abc',
  changes: {
    label: 'New Label',
    required: true,
    // ... other config properties
  }
}
```

**Validations**:

- Node must exist
- Changes must be an object
- Merges changes immutably

## Invariant Validations

### Core Invariants

1. **Node Existence**: Referenced nodes must exist
2. **Parent Validity**: Parent references must be valid
3. **No Root Operations**: Cannot delete/move root node
4. **No Circular References**: Cannot move node into own descendant
5. **Column Bounds**: Column indices must be within valid range
6. **Minimum Steps**: Multi-step forms must have at least one step
7. **Tree Integrity**: All parent/child references must be bidirectional and valid

### Development vs Production

- Invariants throw errors in development (`process.env.NODE_ENV === 'development'`)
- Full tree integrity validation after each mutation in development
- Production builds skip some expensive validations for performance

## Refactored Call Sites

### FormEditor.jsx

All schema mutation sites updated to use command API:

1. **handleDockAdd**: `insertNode()` - Adding fields from dock
2. **handleInsert**: `insertNode()` - Inserting at specific position
3. **handleDelete**: `deleteNode()` - Deleting fields
4. **handleUpdate**: `updateNodeConfig()` - Updating field config
5. **handleMove**: `moveNode()` - DnD operations
6. **handleDuplicate**: `duplicateNode()` - Duplicating fields
7. **handleAddStep**: `insertNode()` + `updateNodeConfig()` - Adding steps
8. **handleDeleteStep**: `deleteNode()` - Removing steps

### Migration Pattern

**Before** (direct mutation):

```javascript
const node = createNodeFromDefinition(definition);
return addNodeToTree(tree, node, { parentId, columnIndex, position });
```

**After** (command API):

```javascript
return insertNode(tree, { definition, parentId, columnIndex, position });
```

## Schema Helpers Exported

Updated `utils/schemaTree.js` to export:

- `removeNodeFromParent()` - Used by command layer

## Benefits Achieved

1. ✅ **Single Source of Truth**: All mutations go through one layer
2. ✅ **Validation Centralized**: Invariants enforced consistently
3. ✅ **Immutability Guaranteed**: All commands return new trees
4. ✅ **Better Error Messages**: Clear context on what went wrong
5. ✅ **Easier Testing**: Commands are pure functions
6. ✅ **Type Safety Ready**: Command structure is well-defined
7. ✅ **Development Safety**: Fails fast on invalid operations

## Build Status

✅ **Build Successful**

- 0 errors
- 3 performance warnings (bundle size - expected)
- webpack 5.104.1 compiled in 10.5s

## No Breaking Changes

- ✅ Schema shape unchanged
- ✅ Tree structure unchanged
- ✅ Reducer signatures unchanged
- ✅ No random ID generation changes
- ✅ Backward compatible

## Future Enhancements

Potential improvements for future iterations:

1. TypeScript types for command structures
2. Command history/undo-redo at command layer
3. Command batching for multiple operations
4. Schema migration commands
5. Validation rule customization per field type
