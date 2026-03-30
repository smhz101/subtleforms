import { __ } from '@wordpress/i18n';
import {
  createNodeId,
  createFieldKey,
  ensureUniqueFieldKey,
  collectExistingKeys,
} from './idGenerator';

const ROOT_NODE_ID = 'root';

const COLUMN_CONTAINER_SUFFIX = '_column_container';

function isColumnContainerType(type) {
  return typeof type === 'string' && type.endsWith(COLUMN_CONTAINER_SUFFIX);
}

function ensureArray(value, length) {
  if (Array.isArray(value) && typeof length === 'number') {
    const slice = value.slice(0, length);
    while (slice.length < length) {
      slice.push([]);
    }
    return slice.map((col) => (Array.isArray(col) ? col : []));
  }

  if (typeof length === 'number') {
    return Array.from({ length }, () => []);
  }

  return Array.isArray(value) ? value.map((col) => (Array.isArray(col) ? col : [])) : [];
}

function extractConfig(field) {
  const {
    // Accept both 'children' (new canonical key) and 'fields' (legacy key for backward compat)
    children: childrenArray,
    fields: fieldsArray,
    columns: columnChildren,
    id,
    type,
    kind,
    parentId,
    ...config
  } = field;

  if (!config.label && typeof field.label === 'string') {
    config.label = field.label;
  }

  if (typeof config.key !== 'string' || !config.key) {
    config.key = createFieldKey(type);
  }

  return {
    id: id || field.key || null,
    config,
    // Prefer 'children' (canonical); fall back to 'fields' for schemas saved before this fix
    childFields: Array.isArray(childrenArray) ? childrenArray : (Array.isArray(fieldsArray) ? fieldsArray : []),
    columnChildren: Array.isArray(columnChildren) ? columnChildren : [],
    type,
    kind: kind || 'input',
  };
}

export function normalizeSchema(schema) {
  const nodes = {};

  nodes[ROOT_NODE_ID] = {
    id: ROOT_NODE_ID,
    type: 'root',
    kind: 'structure',
    parentId: null,
    config: {},
    children: [],
  };

  function register(field, parentId, columnIndex = null) {
    const {
      id: existingId,
      config,
      childFields,
      columnChildren,
      type,
      kind,
    } = extractConfig(field);

    const nodeId = existingId || createNodeId();

    if (nodes[nodeId]) {
      return nodeId;
    }

    const nodeKey =
      typeof config.key === 'string' && config.key.length ? config.key : createFieldKey(type);

    const node = {
      id: nodeId,
      type,
      kind,
      parentId,
      config: {
        ...config,
        id: nodeId,
        type,
        kind,
        key: nodeKey,
      },
    };

    if (isColumnContainerType(type)) {
      const columnCount = parseInt(config.columns, 10) || columnChildren.length || 1;
      const seedColumns = columnChildren.length
        ? columnChildren
        : childFields.length
        ? [childFields]
        : [];
      node.columns = ensureArray(seedColumns, columnCount).map(() => []);
    } else if (Array.isArray(childFields) && childFields.length) {
      node.children = [];
    }

    nodes[nodeId] = node;

    if (parentId) {
      const parent = nodes[parentId];
      if (!parent) {
        throw new Error(`Parent ${parentId} missing while registering ${nodeId}`);
      }

      if (isColumnContainerType(parent.type) && columnIndex !== null) {
        if (!Array.isArray(parent.columns)) {
          const parentColumnCount = parseInt(parent.config?.columns, 10) || 1;
          parent.columns = Array.from({ length: parentColumnCount }, () => []);
        }
        parent.columns[columnIndex] = parent.columns[columnIndex] || [];
        parent.columns[columnIndex].push(nodeId);
      } else {
        parent.children = parent.children || [];
        parent.children.push(nodeId);
      }
    } else {
      nodes[ROOT_NODE_ID].children.push(nodeId);
    }

    if (isColumnContainerType(type)) {
      const seedColumns = columnChildren.length
        ? columnChildren
        : childFields.length
        ? [childFields]
        : [];
      const columns = ensureArray(seedColumns, node.columns?.length || 0);
      columns.forEach((columnFields, idx) => {
        columnFields.forEach((childField) => {
          const childId = register(childField, nodeId, idx);
          node.columns[idx].push(childId);
        });
      });
    } else if (Array.isArray(childFields) && childFields.length) {
      childFields.forEach((childField) => {
        const childId = register(childField, nodeId, null);
        node.children.push(childId);
      });
    }

    return nodeId;
  }

  const initialFields = Array.isArray(schema?.fields) ? schema.fields : [];
  initialFields.forEach((field) => register(field, ROOT_NODE_ID, null));

  return {
    nodes,
    rootId: ROOT_NODE_ID,
  };
}

function buildField(nodeId, tree) {
  const node = tree.nodes[nodeId];
  if (!node) return null;

  const field = {
    ...node.config,
    id: node.id,
    type: node.type,
    kind: node.kind,
  };

  if (isColumnContainerType(node.type)) {
    const columnCount = parseInt(node.config?.columns, 10) || node.columns?.length || 1;
    field.columns = Array.from({ length: columnCount }, (_, idx) => {
      const columnChildren = node.columns?.[idx] || [];
      return columnChildren.map((childId) => buildField(childId, tree)).filter(Boolean);
    });
  } else if (Array.isArray(node.children) && node.children.length) {
    field.children = node.children.map((childId) => buildField(childId, tree)).filter(Boolean);
  }

  return field;
}

export function denormalizeTree(tree) {
  const root = tree.nodes[tree.rootId];
  if (!root) {
    return [];
  }

  return (root.children || []).map((childId) => buildField(childId, tree)).filter(Boolean);
}

export function nodeToField(tree, nodeId) {
  return buildField(nodeId, tree);
}

/**
 * Maps English word-names used by the PHP column registration to integer counts.
 * The PHP loop runs: $createColumnContainer( $name ) where $name is 'one', 'two', etc.
 * So fieldSpecificAttributes.columns is the string name, not an integer.
 */
const COLUMN_WORD_TO_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

export function createNodeFromDefinition(definition, existingKeys = new Set()) {
  const id = createNodeId();
  const key = createFieldKey(definition.type, existingKeys);

  // Merge defaults: fieldSpecificAttributes (API) takes precedence over the legacy defaultConfig key
  const defaults = {
    ...(definition.fieldSpecificAttributes || {}),
    ...(definition.defaultConfig || {}),
  };

  const node = {
    id,
    type: definition.type,
    kind: definition.kind || 'input',
    parentId: null,
    config: {
      ...defaults,
      id,
      type: definition.type,
      kind: definition.kind || 'input',
      key,
      label: defaults.label || definition.label || __('Untitled Field', 'subtleforms'),
    },
  };

  if (definition.acceptsChildren) {
    if (isColumnContainerType(definition.type)) {
      // Derive column count:
      // 1. Look up the word prefix from the type name (most reliable)
      // 2. Fall back to the numeric columns attribute if it is already an integer
      const typePrefix = definition.type.replace(COLUMN_CONTAINER_SUFFIX, '');
      const columnCount =
        COLUMN_WORD_TO_NUM[typePrefix] ||
        parseInt(defaults.columns, 10) ||
        1;
      node.columns = Array.from({ length: columnCount }, () => []);
    } else {
      node.children = [];
    }
  }

  return node;
}

const GROUP_DEFAULT_CHILDREN = {
  name_group: [
    { label: __( 'First Name', 'subtleforms' ),  placeholder: __( 'First Name', 'subtleforms' ) },
    { label: __( 'Middle Name', 'subtleforms' ), placeholder: __( 'Middle Name (optional)', 'subtleforms' ) },
    { label: __( 'Last Name', 'subtleforms' ),   placeholder: __( 'Last Name', 'subtleforms' ) },
  ],
  address_group: [
    { label: __( 'Street Address', 'subtleforms' ),        placeholder: __( 'Street Address', 'subtleforms' ) },
    { label: __( 'Street Address Line 2', 'subtleforms' ), placeholder: __( 'Apt, Suite, etc.', 'subtleforms' ) },
    { label: __( 'City', 'subtleforms' ),                  placeholder: __( 'City', 'subtleforms' ) },
    { label: __( 'State / Province', 'subtleforms' ),      placeholder: __( 'State / Province', 'subtleforms' ) },
    { label: __( 'Postal Code', 'subtleforms' ),           placeholder: __( 'Postal Code', 'subtleforms' ) },
    { label: __( 'Country', 'subtleforms' ),               placeholder: __( 'Country', 'subtleforms' ) },
  ],
};

/**
 * Create default child nodes for a group field (name_group, address_group).
 *
 * @param {string} groupType  - Field type of the parent group ('name_group' | 'address_group')
 * @param {string} parentId   - Node id of the parent group (will be corrected by addNodeToTree)
 * @param {Set}    existingKeys - Mutable set of keys already in use; new keys are added in-place
 * @returns {Array<Object>} Array of child node objects ready for addNodeToTree
 */
export function createGroupDefaultChildren( groupType, parentId, existingKeys ) {
  const specs = GROUP_DEFAULT_CHILDREN[ groupType ] || [];
  return specs.map( ( { label, placeholder } ) => {
    const id  = createNodeId();
    const key = createFieldKey( 'text', existingKeys );
    existingKeys.add( key );
    return {
      id,
      type: 'text',
      kind: 'input',
      parentId,
      config: {
        id,
        type: 'text',
        kind: 'input',
        key,
        label,
        placeholder,
        required:     false,
        defaultValue: null,
        visibility:   null,
        validation:   [],
      },
    };
  } );
}

export function addNodeToTree(tree, node, { parentId, columnIndex = null, position = null }) {
  const nodes = {
    ...tree.nodes,
    [node.id]: {
      ...node,
      parentId,
    },
  };

  const updatedTree = {
    ...tree,
    nodes,
  };

  function insertIntoList(list) {
    const next = Array.isArray(list) ? [...list] : [];
    if (position === null || position === undefined || position >= next.length) {
      next.push(node.id);
    } else {
      next.splice(position, 0, node.id);
    }
    return next;
  }

  if (!parentId || parentId === tree.rootId) {
    const root = {
      ...nodes[tree.rootId],
      children: insertIntoList(nodes[tree.rootId]?.children || []),
    };
    updatedTree.nodes[tree.rootId] = root;
    return updatedTree;
  }

  const parent = nodes[parentId];
  if (!parent) {
    throw new Error(`Parent ${parentId} not found for insertion.`);
  }

  if (isColumnContainerType(parent.type)) {
    const columnCount = parseInt(parent.config?.columns, 10) || parent.columns?.length || 1;
    const index = columnIndex ?? 0;
    const bounded = Math.max(0, Math.min(index, columnCount - 1));
    const existingColumns = Array.isArray(parent.columns)
      ? parent.columns.map((col) => [...col])
      : Array.from({ length: columnCount }, () => []);
    existingColumns[bounded] = insertIntoList(existingColumns[bounded]);
    updatedTree.nodes[parentId] = {
      ...parent,
      columns: existingColumns,
    };
  } else {
    const children = insertIntoList(parent.children || []);
    updatedTree.nodes[parentId] = {
      ...parent,
      children,
    };
  }

  return updatedTree;
}

export function removeNodeFromParent(tree, nodeId) {
  const nodes = { ...tree.nodes };
  const node = nodes[nodeId];
  if (!node) {
    return tree;
  }

  const parentId = node.parentId;
  if (!parentId) {
    return tree;
  }

  const parent = nodes[parentId];
  if (parent) {
    if (isColumnContainerType(parent.type)) {
      const columns = (parent.columns || []).map((col) => col.filter((id) => id !== nodeId));
      nodes[parentId] = {
        ...parent,
        columns,
      };
    } else {
      const children = (parent.children || []).filter((id) => id !== nodeId);
      nodes[parentId] = {
        ...parent,
        children,
      };
    }
  } else if (parentId === tree.rootId) {
    const root = nodes[tree.rootId];
    const children = (root.children || []).filter((id) => id !== nodeId);
    nodes[tree.rootId] = {
      ...root,
      children,
    };
  }

  return {
    ...tree,
    nodes,
  };
}

function collectDescendants(tree, nodeId, bucket) {
  const node = tree.nodes[nodeId];
  if (!node) return;
  (node.children || []).forEach((childId) => {
    bucket.push(childId);
    collectDescendants(tree, childId, bucket);
  });
  (node.columns || []).forEach((col) => {
    col.forEach((childId) => {
      bucket.push(childId);
      collectDescendants(tree, childId, bucket);
    });
  });
}

export function deleteNode(tree, nodeId) {
  const updated = removeNodeFromParent(tree, nodeId);
  const toDelete = [nodeId];
  collectDescendants(updated, nodeId, toDelete);

  const nodes = { ...updated.nodes };
  toDelete.forEach((id) => {
    delete nodes[id];
  });

  return {
    ...updated,
    nodes,
  };
}

export function updateNodeConfig(tree, nodeId, changes) {
  const nodes = { ...tree.nodes };
  const node = nodes[nodeId];
  if (!node) return tree;

  nodes[nodeId] = {
    ...node,
    config: {
      ...node.config,
      ...changes,
    },
  };

  return {
    ...tree,
    nodes,
  };
}

export function moveNode(tree, nodeId, { parentId, columnIndex = null, position = null }) {
  const node = tree.nodes[nodeId];
  if (!node) return tree;

  let workingTree = removeNodeFromParent(tree, nodeId);
  const updatedNode = {
    ...workingTree.nodes[nodeId],
    parentId,
  };
  workingTree.nodes[nodeId] = updatedNode;

  return addNodeToTree(workingTree, updatedNode, { parentId, columnIndex, position });
}

export function getRootNodeId() {
  return ROOT_NODE_ID;
}

export function isColumnContainer(node) {
  return !!node && isColumnContainerType(node.type);
}

export function nodeChildren(tree, nodeId, columnIndex = null) {
  const node = tree.nodes[nodeId];
  if (!node) return [];
  if (columnIndex !== null && isColumnContainer(node)) {
    return node.columns?.[columnIndex] || [];
  }
  return node.children || [];
}

export function getNodeLocation(tree, nodeId) {
  const node = tree.nodes[nodeId];
  if (!node) return null;

  const parentId = node.parentId || ROOT_NODE_ID;
  const parent = tree.nodes[parentId];
  if (!parent) {
    return {
      parentId: ROOT_NODE_ID,
      columnIndex: null,
      position: -1,
    };
  }

  if (isColumnContainer(parent)) {
    const columns = parent.columns || [];
    for (let idx = 0; idx < columns.length; idx += 1) {
      const column = columns[idx] || [];
      const position = column.indexOf(nodeId);
      if (position !== -1) {
        return {
          parentId,
          columnIndex: idx,
          position,
        };
      }
    }
    return {
      parentId,
      columnIndex: 0,
      position: -1,
    };
  }

  const siblings = parent.children || [];
  return {
    parentId,
    columnIndex: null,
    position: siblings.indexOf(nodeId),
  };
}

export function duplicateNode(tree, nodeId, destination) {
  const source = tree.nodes[nodeId];
  if (!source || !destination) {
    return {
      tree,
      newNodeId: null,
    };
  }

  const clones = {};

  const cloneRecursive = (currentId) => {
    const currentNode = tree.nodes[currentId];
    if (!currentNode) {
      return null;
    }

    const newId = createNodeId();
    const clonedKey = createFieldKey(currentNode.type);
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
            if (!clonedChildId) {
              return null;
            }
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
          if (!clonedChildId) {
            return null;
          }
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
    return {
      tree,
      newNodeId: null,
    };
  }

  clones[rootCloneId].parentId = destination.parentId;

  const treeWithClones = {
    ...tree,
    nodes: {
      ...tree.nodes,
      ...clones,
    },
  };

  const nextTree = addNodeToTree(treeWithClones, clones[rootCloneId], destination);

  return {
    tree: nextTree,
    newNodeId: rootCloneId,
  };
}
