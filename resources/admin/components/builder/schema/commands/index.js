/**
 * Schema Mutation Commands
 *
 * Single authoritative layer for all schema/tree mutations.
 * All mutations return a new immutable tree structure.
 * Validates invariants before applying changes.
 */

import {
  assertNodeExists,
  assertParentExists,
  assertNotRoot,
  assertNotDescendant,
  assertValidColumnIndex,
  assertMinimumSteps,
  validateTreeIntegrity,
} from './invariants';
import {
  createNodeId,
  createFieldKey,
  ensureUniqueFieldKey,
  collectExistingKeys,
} from '../../utils/idGenerator';
import {
  createNodeFromDefinition,
  addNodeToTree,
  removeNodeFromParent,
  isColumnContainer,
} from '../../utils/schemaTree';

const ROOT_NODE_ID = 'root';

/**
 * Insert a new node into the tree
 *
 * @param {Object} tree - Current tree structure
 * @param {Object} command - Insert command
 * @param {Object} command.definition - Field definition from fieldDefinitions
 * @param {string} command.parentId - Parent node ID
 * @param {number|null} command.columnIndex - Column index (for column containers)
 * @param {number|null} command.position - Position in children array
 * @returns {Object} New tree structure
 */
export function insertNode(tree, command) {
  const { definition, parentId, columnIndex = null, position = null } = command;

  // Validate inputs
  if (!definition) {
    throw new Error('[insertNode] definition is required');
  }

  const effectiveParentId = parentId || ROOT_NODE_ID;

  // Validate invariants
  assertParentExists(tree, effectiveParentId, 'insertNode');

  const parentNode = tree.nodes[effectiveParentId];
  if (columnIndex !== null && parentNode) {
    assertValidColumnIndex(parentNode, columnIndex, 'insertNode');
  }

  // Collect existing keys for uniqueness
  const existingKeys = collectExistingKeys(tree);

  // Create new node from definition
  const newNode = createNodeFromDefinition(definition, existingKeys);

  // Add to tree immutably
  const updatedTree = addNodeToTree(tree, newNode, {
    parentId: effectiveParentId,
    columnIndex,
    position,
  });

  // Validate tree integrity after mutation
  if (process.env.NODE_ENV === 'development') {
    validateTreeIntegrity(updatedTree, 'after insertNode');
  }

  return updatedTree;
}

/**
 * Move an existing node to a new location
 *
 * @param {Object} tree - Current tree structure
 * @param {Object} command - Move command
 * @param {string} command.nodeId - Node to move
 * @param {string} command.parentId - New parent ID
 * @param {number|null} command.columnIndex - Column index (for column containers)
 * @param {number|null} command.position - Position in children array
 * @returns {Object} New tree structure
 */
export function moveNode(tree, command) {
  const { nodeId, parentId, columnIndex = null, position = null } = command;

  // Validate inputs
  if (!nodeId) {
    throw new Error('[moveNode] nodeId is required');
  }

  const effectiveParentId = parentId || ROOT_NODE_ID;

  // Validate invariants
  assertNotRoot(nodeId, 'moveNode');
  assertNodeExists(tree, nodeId, 'moveNode');
  assertParentExists(tree, effectiveParentId, 'moveNode');
  assertNotDescendant(tree, nodeId, effectiveParentId, 'moveNode');

  const targetParent = tree.nodes[effectiveParentId];
  if (columnIndex !== null && targetParent) {
    assertValidColumnIndex(targetParent, columnIndex, 'moveNode');
  }

  // Remove from current parent
  let workingTree = removeNodeFromParent(tree, nodeId);

  // Update node's parentId
  const updatedNode = {
    ...workingTree.nodes[nodeId],
    parentId: effectiveParentId,
  };

  workingTree = {
    ...workingTree,
    nodes: {
      ...workingTree.nodes,
      [nodeId]: updatedNode,
    },
  };

  // Add to new parent
  const updatedTree = addNodeToTree(workingTree, updatedNode, {
    parentId: effectiveParentId,
    columnIndex,
    position,
  });

  // Validate tree integrity after mutation
  if (process.env.NODE_ENV === 'development') {
    validateTreeIntegrity(updatedTree, 'after moveNode');
  }

  return updatedTree;
}

/**
 * Delete a node and all its descendants
 *
 * @param {Object} tree - Current tree structure
 * @param {Object} command - Delete command
 * @param {string} command.nodeId - Node to delete
 * @returns {Object} New tree structure
 */
export function deleteNode(tree, command) {
  const { nodeId } = command;

  // Validate inputs
  if (!nodeId) {
    throw new Error('[deleteNode] nodeId is required');
  }

  // Validate invariants
  assertNotRoot(nodeId, 'deleteNode');
  assertNodeExists(tree, nodeId, 'deleteNode');
  assertMinimumSteps(tree, nodeId, 'deleteNode');

  // Collect all descendants for deletion
  const toDelete = [nodeId];
  const collectDescendants = (currentId) => {
    const node = tree.nodes[currentId];
    if (!node) return;

    (node.children || []).forEach((childId) => {
      toDelete.push(childId);
      collectDescendants(childId);
    });

    (node.columns || []).forEach((col) => {
      col.forEach((childId) => {
        toDelete.push(childId);
        collectDescendants(childId);
      });
    });
  };
  collectDescendants(nodeId);

  // Remove from parent
  const workingTree = removeNodeFromParent(tree, nodeId);

  // Delete all nodes immutably
  const nodes = { ...workingTree.nodes };
  toDelete.forEach((id) => {
    delete nodes[id];
  });

  const updatedTree = {
    ...workingTree,
    nodes,
  };

  // Validate tree integrity after mutation
  if (process.env.NODE_ENV === 'development') {
    validateTreeIntegrity(updatedTree, 'after deleteNode');
  }

  return updatedTree;
}

/**
 * Duplicate a node and all its descendants
 *
 * @param {Object} tree - Current tree structure
 * @param {Object} command - Duplicate command
 * @param {string} command.nodeId - Node to duplicate
 * @param {Object} command.destination - Where to place the duplicate
 * @param {string} command.destination.parentId - Parent for the duplicate
 * @param {number|null} command.destination.columnIndex - Column index
 * @param {number|null} command.destination.position - Position
 * @returns {Object} { tree, newNodeId }
 */
export function duplicateNode(tree, command) {
  const { nodeId, destination } = command;

  // Validate inputs
  if (!nodeId) {
    throw new Error('[duplicateNode] nodeId is required');
  }

  // If destination is not provided, default to the original node's parent
  const originalNode = tree.nodes[nodeId];
  const effectiveDestination = destination || {
    parentId: originalNode?.parentId || ROOT_NODE_ID,
    columnIndex: originalNode?.columnIndex ?? null,
    position: null,
  };

  // Validate invariants
  assertNodeExists(tree, nodeId, 'duplicateNode');
  assertParentExists(tree, effectiveDestination.parentId, 'duplicateNode');

  const destParent = tree.nodes[effectiveDestination.parentId];
  if (effectiveDestination.columnIndex !== null && destParent) {
    assertValidColumnIndex(destParent, effectiveDestination.columnIndex, 'duplicateNode');
  }

  // Clone the node and all descendants
  const clones = {};
  const existingKeys = collectExistingKeys(tree);

  const cloneRecursive = (currentId) => {
    const currentNode = tree.nodes[currentId];
    if (!currentNode) return null;

    const newId = createNodeId();
    const clonedKey = createFieldKey(currentNode.type, existingKeys);
    existingKeys.add(clonedKey); // Track for collision detection
    const cloned = {
      ...currentNode,
      id: newId,
      parentId: null,
      config: {
        ...currentNode.config,
        id: newId,
        key: clonedKey,
      },
    };

    if (isColumnContainer(currentNode)) {
      const columns = (currentNode.columns || []).map((col) => {
        return (col || [])
          .map((childId) => {
            const clonedChildId = cloneRecursive(childId);
            if (!clonedChildId) return null;
            clones[clonedChildId].parentId = newId;
            return clonedChildId;
          })
          .filter(Boolean);
      });
      cloned.columns = columns;
    } else if (Array.isArray(currentNode.children)) {
      const children = currentNode.children
        .map((childId) => {
          const clonedChildId = cloneRecursive(childId);
          if (!clonedChildId) return null;
          clones[clonedChildId].parentId = newId;
          return clonedChildId;
        })
        .filter(Boolean);
      cloned.children = children;
    }

    clones[newId] = cloned;
    return newId;
  };

  const rootCloneId = cloneRecursive(nodeId);
  if (!rootCloneId) {
    return { tree, newNodeId: null };
  }

  clones[rootCloneId].parentId = effectiveDestination.parentId;

  // Add clones to tree
  const treeWithClones = {
    ...tree,
    nodes: {
      ...tree.nodes,
      ...clones,
    },
  };

  // Insert cloned subtree at destination
  const updatedTree = addNodeToTree(treeWithClones, clones[rootCloneId], effectiveDestination);

  // Validate tree integrity after mutation
  if (process.env.NODE_ENV === 'development') {
    validateTreeIntegrity(updatedTree, 'after duplicateNode');
  }

  return {
    tree: updatedTree,
    newNodeId: rootCloneId,
  };
}

/**
 * Update node configuration (non-structural changes)
 *
 * @param {Object} tree - Current tree structure
 * @param {Object} command - Update command
 * @param {string} command.nodeId - Node to update
 * @param {Object} command.changes - Config changes to apply
 * @returns {Object} New tree structure
 */
export function updateNodeConfig(tree, command) {
  const { nodeId, changes } = command;

  // Validate inputs
  if (!nodeId) {
    throw new Error('[updateNodeConfig] nodeId is required');
  }
  if (!changes || typeof changes !== 'object') {
    throw new Error('[updateNodeConfig] changes must be an object');
  }

  // Validate invariants
  assertNodeExists(tree, nodeId, 'updateNodeConfig');

  const node = tree.nodes[nodeId];

  // If updating the field key, ensure uniqueness
  let finalChanges = { ...changes };
  if (changes.key && changes.key !== node.config?.key) {
    const uniqueKey = ensureUniqueFieldKey(changes.key, tree, nodeId);
    finalChanges.key = uniqueKey;
  }

  const updatedNode = {
    ...node,
    config: {
      ...node.config,
      ...finalChanges,
    },
  };

  const updatedTree = {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: updatedNode,
    },
  };

  // No structural changes, so tree integrity should be maintained
  // But validate in development anyway
  if (process.env.NODE_ENV === 'development') {
    validateTreeIntegrity(updatedTree, 'after updateNodeConfig');
  }

  return updatedTree;
}
