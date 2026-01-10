/**
 * Schema Invariant Validation
 *
 * Validates schema invariants to ensure data integrity.
 * Throws errors in development when invariants are violated.
 */

const ROOT_NODE_ID = 'root';

/**
 * Check if a node exists in the tree
 */
export function assertNodeExists(tree, nodeId, context = '') {
  if (!tree.nodes[nodeId]) {
    throw new Error(
      `[Schema Invariant] Node ${nodeId} does not exist${context ? `: ${context}` : ''}`
    );
  }
}

/**
 * Check if a parent node exists
 */
export function assertParentExists(tree, parentId, context = '') {
  if (parentId !== ROOT_NODE_ID && !tree.nodes[parentId]) {
    throw new Error(
      `[Schema Invariant] Parent node ${parentId} does not exist${context ? `: ${context}` : ''}`
    );
  }
}

/**
 * Check if a node is not root
 */
export function assertNotRoot(nodeId, context = '') {
  if (nodeId === ROOT_NODE_ID) {
    throw new Error(
      `[Schema Invariant] Cannot operate on root node${context ? `: ${context}` : ''}`
    );
  }
}

/**
 * Check if node is a descendant of potential parent (prevent circular refs)
 */
export function assertNotDescendant(tree, nodeId, potentialParentId, context = '') {
  if (nodeId === potentialParentId) {
    throw new Error(
      `[Schema Invariant] Node cannot be its own parent${context ? `: ${context}` : ''}`
    );
  }

  const visited = new Set();
  let currentId = potentialParentId;

  while (currentId && currentId !== ROOT_NODE_ID) {
    if (visited.has(currentId)) {
      // Circular reference detected in existing tree
      throw new Error(
        `[Schema Invariant] Circular reference detected in tree${context ? `: ${context}` : ''}`
      );
    }

    if (currentId === nodeId) {
      throw new Error(
        `[Schema Invariant] Cannot move node into its own descendant${
          context ? `: ${context}` : ''
        }`
      );
    }

    visited.add(currentId);
    const node = tree.nodes[currentId];
    currentId = node?.parentId;
  }
}

/**
 * Check if column index is valid for column container
 */
export function assertValidColumnIndex(node, columnIndex, context = '') {
  if (columnIndex !== null) {
    const columnCount = node.columns?.length || 0;
    if (columnIndex < 0 || columnIndex >= columnCount) {
      throw new Error(
        `[Schema Invariant] Invalid column index ${columnIndex} (node has ${columnCount} columns)${
          context ? `: ${context}` : ''
        }`
      );
    }
  }
}

/**
 * Check if multi-step form retains at least one step
 */
export function assertMinimumSteps(tree, nodeIdToDelete, context = '') {
  const node = tree.nodes[nodeIdToDelete];
  if (!node || node.type !== 'step') {
    return; // Not deleting a step, no check needed
  }

  const rootNode = tree.nodes[ROOT_NODE_ID];
  const stepChildren = (rootNode?.children || []).filter((id) => {
    const child = tree.nodes[id];
    return child?.type === 'step';
  });

  if (stepChildren.length <= 1) {
    throw new Error(
      `[Schema Invariant] Cannot delete the last step. Multi-step forms require at least one step${
        context ? `: ${context}` : ''
      }`
    );
  }
}

/**
 * Validate tree structure integrity
 */
export function validateTreeIntegrity(tree, context = '') {
  const { nodes, rootId } = tree;

  if (!nodes[rootId]) {
    throw new Error(`[Schema Invariant] Root node is missing${context ? `: ${context}` : ''}`);
  }

  // Check all parent references point to valid nodes
  Object.values(nodes).forEach((node) => {
    if (node.id === rootId) return;

    if (!node.parentId) {
      throw new Error(
        `[Schema Invariant] Node ${node.id} has no parent${context ? `: ${context}` : ''}`
      );
    }

    if (node.parentId !== rootId && !nodes[node.parentId]) {
      throw new Error(
        `[Schema Invariant] Node ${node.id} references non-existent parent ${node.parentId}${
          context ? `: ${context}` : ''
        }`
      );
    }
  });

  // Check all child references point to valid nodes
  Object.values(nodes).forEach((node) => {
    if (Array.isArray(node.children)) {
      node.children.forEach((childId) => {
        if (!nodes[childId]) {
          throw new Error(
            `[Schema Invariant] Node ${node.id} references non-existent child ${childId}${
              context ? `: ${context}` : ''
            }`
          );
        }
      });
    }

    if (Array.isArray(node.columns)) {
      node.columns.forEach((column, idx) => {
        if (!Array.isArray(column)) {
          throw new Error(
            `[Schema Invariant] Node ${node.id} column ${idx} is not an array${
              context ? `: ${context}` : ''
            }`
          );
        }
        column.forEach((childId) => {
          if (!nodes[childId]) {
            throw new Error(
              `[Schema Invariant] Node ${
                node.id
              } column ${idx} references non-existent child ${childId}${
                context ? `: ${context}` : ''
              }`
            );
          }
        });
      });
    }
  });
}
