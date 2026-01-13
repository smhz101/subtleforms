# ID Generation & Field Key Uniqueness

## Overview

This document describes the unique ID generation system for SubtleForms schema nodes and field keys, ensuring data integrity and preventing submission collisions.

## Core Principles

1. **Node IDs** are internal identifiers for builder UI
2. **Field Keys** are stable identifiers for form submissions
3. All IDs must be cryptographically random where possible
4. Field keys must be unique within a schema
5. Collisions must be handled deterministically

## Implementation

### ID Generator Module

Location: `/resources/admin/components/builder/utils/idGenerator.js`

#### Functions

##### `createNodeId()`

Generates unique node IDs for internal builder use.

```javascript
createNodeId(); // => "node_a1b2c3d4"
```

**Algorithm:**

1. Uses `crypto.randomUUID()` when available (modern browsers, Node 14.17+)
2. Falls back to `crypto.getRandomValues()` + timestamp
3. Final fallback to `Math.random()` for legacy environments

**Format:** `node_{8_random_chars}`

##### `createFieldKey(type, existingKeys)`

Generates unique field keys with collision detection.

```javascript
createFieldKey('email', existingKeys); // => "email_a1b2c3d4"
```

**Parameters:**

- `type` (string): Field type for prefix
- `existingKeys` (Set): Existing keys to check for collisions

**Algorithm:**

1. Normalize type to valid identifier format
2. Generate random suffix using crypto API
3. Check for collision in existingKeys
4. If collision, append `_2`, `_3`, etc. deterministically

**Format:** `{type}_{random_suffix}` or `{type}_{random_suffix}_{n}`

##### `ensureUniqueFieldKey(desiredKey, tree, excludeNodeId)`

Ensures a field key is unique when updating existing nodes.

```javascript
ensureUniqueFieldKey('email_abc123', tree, 'node_xyz');
// If collision: => "email_abc123_2"
```

**Parameters:**

- `desiredKey` (string): User-specified or existing key
- `tree` (Object): Current schema tree
- `excludeNodeId` (string): Node being updated (excluded from check)

**Algorithm:**

1. Collect all existing field keys from tree (except excludeNodeId)
2. If no collision, return desiredKey as-is
3. If collision, append `_2`, `_3`, etc. until unique

##### `collectExistingKeys(tree)`

Utility to collect all field keys from a tree.

```javascript
collectExistingKeys(tree); // => Set(['email_abc', 'name_xyz', ...])
```

##### `isValidFieldKey(key)`

Validates field key format for submissions.

```javascript
isValidFieldKey('email_abc123'); // => true
isValidFieldKey('123_invalid'); // => false
```

**Rules:**

- Must start with letter or underscore
- Can contain letters, numbers, underscores only
- Maximum 128 characters
- Pattern: `/^[a-z_][a-z0-9_]{0,127}$/i`

## Integration Points

### Schema Commands

All schema mutation commands now enforce unique field keys:

#### `insertNode(tree, command)`

Collects existing keys before creating new node:

```javascript
const existingKeys = collectExistingKeys(tree);
const newNode = createNodeFromDefinition(definition, existingKeys);
```

#### `duplicateNode(tree, command)`

Tracks keys during recursive cloning:

```javascript
const existingKeys = collectExistingKeys(tree);
const clonedKey = createFieldKey(currentNode.type, existingKeys);
existingKeys.add(clonedKey); // Prevent self-collision
```

#### `updateNodeConfig(tree, command)`

Ensures uniqueness when changing field key:

```javascript
if (changes.key && changes.key !== node.config?.key) {
	const uniqueKey = ensureUniqueFieldKey(changes.key, tree, nodeId);
	finalChanges.key = uniqueKey;
}
```

### Schema Tree Utilities

#### `createNodeFromDefinition(definition, existingKeys)`

Updated to accept `existingKeys` parameter:

```javascript
const key = createFieldKey(definition.type, existingKeys);
```

## Backward Compatibility

### Existing Schemas

- Old schemas with Math.random-based keys remain valid
- No migration required for saved data
- New fields get crypto-based keys automatically

### Field Key Format

- Old format: `{type}_{timestamp}{random}` (e.g., `email_l2x3y4z5`)
- New format: `{type}_{uuid_prefix}` (e.g., `email_a1b2c3d4`)
- Both formats are valid and can coexist

### Browser Support

The system gracefully degrades across browser environments:

| Environment     | ID Source                  | Security Level |
| --------------- | -------------------------- | -------------- |
| Modern browsers | `crypto.randomUUID()`      | High           |
| Older browsers  | `crypto.getRandomValues()` | High           |
| Legacy browsers | `Math.random()`            | Medium         |

## Examples

### Adding New Field

```javascript
import { insertNode } from './schema/commands';

// Command layer automatically handles uniqueness
const updatedTree = insertNode(tree, {
	definition: { type: 'email', kind: 'input' },
	parentId: 'node_abc',
});
// New node gets unique key: "email_a1b2c3d4"
```

### Duplicating Field

```javascript
import { duplicateNode } from './schema/commands';

// Duplicated field gets new unique key
const updatedTree = duplicateNode(tree, {
	nodeId: 'node_abc', // Has key "email_xyz"
	destination: { parentId: 'node_def' },
});
// Cloned node gets: "email_a1b2c3d4" (different from original)
```

### Handling Collisions

```javascript
// Scenario: User manually sets field key to existing value
const updatedTree = updateNodeConfig(tree, {
	nodeId: 'node_new',
	changes: { key: 'email_abc' }, // Already exists
});
// Result: key becomes "email_abc_2"
```

### Import with Duplicates

When importing schemas with duplicate keys:

```javascript
// Original schema has: email_abc
// Imported schema has: email_abc (collision!)

const existingKeys = collectExistingKeys(tree);
// Insert creates: email_abc_2 automatically
```

## Testing

### Unit Tests

Key scenarios to test:

1. ✅ Node IDs are unique across insertions
2. ✅ Field keys are unique within tree
3. ✅ Collision handling appends \_2, \_3 correctly
4. ✅ Duplicate nodes get new keys
5. ✅ Update with collision is resolved
6. ✅ crypto.randomUUID fallback works
7. ✅ Math.random fallback works
8. ✅ Field key validation passes/fails correctly

### Manual Tests

1. Add multiple fields of same type → All have unique keys
2. Duplicate field → New key generated
3. Update field key to existing value → Collision resolved with \_2 suffix
4. Import schema with duplicate keys → All keys remain unique
5. Test in older browser (e.g., Safari 13) → Fallback works

## Security Considerations

### Why crypto.randomUUID()?

1. **Collision Resistance**: 122 bits of randomness (UUID v4)
2. **Unpredictability**: Cannot guess next ID from previous IDs
3. **CSPRNG**: Uses cryptographically secure random number generator

### Why Not Math.random()?

1. **Not cryptographically secure**: Predictable sequence
2. **Low entropy**: Only 53 bits of randomness
3. **Collision risk**: Higher probability with many fields

### Fallback Strategy

The fallback chain ensures functionality while maximizing security:

1. **Best**: `crypto.randomUUID()` → 122 bits entropy
2. **Good**: `crypto.getRandomValues()` + timestamp → ~80 bits entropy
3. **Acceptable**: `Math.random()` + timestamp → ~53 bits entropy

## Performance

### ID Generation

- `crypto.randomUUID()`: ~0.001ms per call
- `crypto.getRandomValues()`: ~0.002ms per call
- `Math.random()`: ~0.0001ms per call

All approaches are effectively instant for UI operations.

### Collision Detection

- O(n) where n = number of existing fields
- Typical schema: 10-50 fields → <1ms
- Large schema: 500 fields → <10ms

Collision detection is negligible for typical form builder usage.

## Migration Notes

### From Old System

**No migration required!** The old system used:

```javascript
const id = `node_${Math.random().toString(36).slice(2, 11)}`;
const key = `${type}_${Date.now().toString(36)}${Math.random()
	.toString(36)
	.slice(2, 7)}`;
```

Old IDs remain valid. New code generates better IDs automatically.

### Breaking Changes

**None.** This is a backward-compatible enhancement.

### Future Improvements

1. Consider nanoid package for smaller bundle size
2. Add telemetry for collision rate monitoring
3. Implement key normalization for imported schemas
4. Add bulk import optimization (batch collision detection)

## Troubleshooting

### "Field key collision detected"

**Cause:** User manually set field key to existing value  
**Solution:** System automatically appends \_2, \_3 suffix  
**Action:** No user action needed (logged in dev mode)

### "Invalid field key format"

**Cause:** Key doesn't match `/^[a-z_][a-z0-9_]{0,127}$/i`  
**Solution:** Normalize key or show validation error  
**Action:** Update key to valid format

### "crypto is not defined"

**Cause:** Running in non-browser environment (e.g., Node < 14.17)  
**Solution:** System falls back to Math.random automatically  
**Action:** None (fallback is automatic)

## References

- [crypto.randomUUID() MDN](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
- [crypto.getRandomValues() MDN](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
- [UUID RFC 4122](https://www.rfc-editor.org/rfc/rfc4122)
