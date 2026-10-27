/**
 * Drag and drop rules for the builder canvas (2.3.1).
 *
 * Pure functions, shared by the pointer drag (dnd-kit), the keyboard
 * "Move to" menu and the Jest tests:
 *
 * - canDropInto(): may this node (or a new field of this type) go into that
 *   parent? Containers (Repeater, Group, Columns) accept fields into their
 *   drop zone; nothing moves into itself; steps only live at root level;
 *   fixed groups (Name, Address) keep their parts; a Repeater cannot hold
 *   another Repeater, uploads, CAPTCHAs or an add-on type that says so.
 * - resolveDrop(): turns "active dropped over target" into one command.
 * - moveTargets(): every place a field can move to in its step, for the
 *   keyboard menu.
 */

import { typeHasFlag } from '../../../utils/fieldTypeFlags';

const ROOT_NODE_ID = 'root';

/** Types that cannot sit inside a Repeater (no per-group meaning or storage). */
export const REPEATER_BLOCKED_TYPES = new Set([
  'repeat_container',
  'repeat_field',
  'step',
  'form_step',
  'file_upload',
  'image_upload',
  'recaptcha',
  'hcaptcha',
  'turnstile',
  'save_resume',
]);

const COLUMN_SUFFIX = '_column_container';

export function isContainerNode(node) {
  if (!node || node.kind === 'group' || node.type === 'step' || node.type === 'root') {
    return false;
  }
  return (
    (typeof node.type === 'string' && node.type.endsWith(COLUMN_SUFFIX)) ||
    node.type === 'repeat_container' ||
    node.type === 'group_container' ||
    Array.isArray(node.children)
  );
}

function acceptsChildren(node) {
  if (!node) return false;
  if (node.type === 'root' || node.type === 'step') return true;
  return isContainerNode(node);
}

function isAncestor(tree, maybeAncestorId, nodeId) {
  const seen = new Set();
  let current = tree.nodes[nodeId];
  while (current && current.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parentId === maybeAncestorId) return true;
    current = tree.nodes[current.parentId];
  }
  return false;
}

function insideRepeater(tree, parentId) {
  const seen = new Set();
  let current = tree.nodes[parentId];
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.type === 'repeat_container') return true;
    current = current.parentId ? tree.nodes[current.parentId] : null;
  }
  return false;
}

/** Types contained in a subtree (the node and all descendants). */
function subtreeTypes(tree, nodeId, bucket = new Set()) {
  const node = tree.nodes[nodeId];
  if (!node) return bucket;
  bucket.add(node.type);
  (node.children || []).forEach((id) => subtreeTypes(tree, id, bucket));
  (node.columns || []).forEach((col) => (col || []).forEach((id) => subtreeTypes(tree, id, bucket)));
  return bucket;
}

/**
 * @param {Object} tree
 * @param {{nodeId?: string, fieldType?: string, parentId: string}} args
 * @return {boolean}
 */
export function canDropInto(tree, { nodeId = null, fieldType = null, parentId }) {
  const parent = tree.nodes[parentId || ROOT_NODE_ID];
  if (!acceptsChildren(parent)) return false;

  const types = nodeId ? subtreeTypes(tree, nodeId) : new Set([fieldType]);
  if (nodeId) {
    const node = tree.nodes[nodeId];
    if (!node) return false;
    if (nodeId === parent.id || isAncestor(tree, nodeId, parent.id)) return false;
    // Steps are reordered with the step tabs, never dropped into things.
    if (node.type === 'step') return false;
  }
  if (types.has('step') && parent.type !== 'root') {
    return false;
  }
  // A multi-step form keeps every field inside a step.
  if (parent.type === 'root' && !types.has('step')) {
    const rootHasSteps = (parent.children || []).some((id) => tree.nodes[id]?.type === 'step');
    if (rootHasSteps) return false;
  }
  if (insideRepeater(tree, parent.id)) {
    for (const type of types) {
      if (REPEATER_BLOCKED_TYPES.has(type) || typeHasFlag(type, 'notInRepeater')) return false;
    }
  }
  return true;
}

/**
 * Turn a drop into a command.
 *
 * @param {Object} tree
 * @param {Object} active { kind: 'library', fieldType } | { kind: 'node', nodeId }
 * @param {Object} over   { kind: 'zone', parentId, columnIndex }
 *                        | { kind: 'node', nodeId, parentId, columnIndex, position }
 *                        | { kind: 'steptab', stepId }
 * @param {Object} [opts] { placeAfter: boolean } pointer is in the lower half of `over`.
 * @return {?Object} { type: 'insert', fieldType, parentId, columnIndex, position }
 *                   | { type: 'move', nodeId, parentId, columnIndex, position }
 *                   | { type: 'moveToStep', nodeId, stepId }
 */
export function resolveDrop(tree, active, over, { placeAfter = false } = {}) {
  if (!active || !over) return null;

  if (over.kind === 'steptab') {
    if (!tree.nodes[over.stepId]) return null;
    if (active.kind === 'library') {
      return {
        type: 'insert',
        fieldType: active.fieldType,
        parentId: over.stepId,
        columnIndex: null,
        position: null,
      };
    }
    if (active.kind === 'node' && tree.nodes[active.nodeId] && tree.nodes[active.nodeId].type !== 'step') {
      return { type: 'moveToStep', nodeId: active.nodeId, stepId: over.stepId };
    }
    return null;
  }

  let parentId;
  let columnIndex;
  let position;
  if (over.kind === 'zone') {
    parentId = over.parentId;
    columnIndex = over.columnIndex ?? null;
    position = null;
  } else if (over.kind === 'node') {
    if (active.kind === 'node' && over.nodeId === active.nodeId) return null;
    // A fixed group's parts are not drop targets: use the group itself.
    let target = over;
    const overParent = tree.nodes[over.parentId];
    if (overParent && overParent.kind === 'group') {
      const groupParent = tree.nodes[overParent.parentId];
      const list = groupParent?.children || [];
      target = { nodeId: overParent.id, parentId: overParent.parentId, columnIndex: null, position: list.indexOf(overParent.id) };
    }
    parentId = target.parentId;
    columnIndex = target.columnIndex ?? null;
    position = target.position;
    if (active.kind === 'node') {
      const activeNode = tree.nodes[active.nodeId];
      const sameList =
        activeNode &&
        activeNode.parentId === parentId &&
        (columnIndex === null || locateColumn(tree, active.nodeId) === columnIndex);
      if (sameList) {
        // Same list: dnd-kit sorting semantics (arrayMove to the over index).
        position = target.position;
      } else {
        position = target.position + (placeAfter ? 1 : 0);
      }
    } else {
      position = target.position + (placeAfter ? 1 : 0);
    }
  } else {
    return null;
  }

  if (active.kind === 'library') {
    // A Page Break dropped inside a container breaks the step after it.
    if (active.fieldType === 'step') {
      return { type: 'insert', fieldType: 'step', parentId, columnIndex, position };
    }
    if (!canDropInto(tree, { fieldType: active.fieldType, parentId })) return null;
    return { type: 'insert', fieldType: active.fieldType, parentId, columnIndex, position };
  }

  if (active.kind === 'node') {
    if (!canDropInto(tree, { nodeId: active.nodeId, parentId })) return null;
    return { type: 'move', nodeId: active.nodeId, parentId, columnIndex, position };
  }
  return null;
}

function locateColumn(tree, nodeId) {
  const node = tree.nodes[nodeId];
  const parent = node && tree.nodes[node.parentId];
  if (!parent || !Array.isArray(parent.columns)) return null;
  for (let i = 0; i < parent.columns.length; i += 1) {
    if ((parent.columns[i] || []).includes(nodeId)) return i;
  }
  return null;
}

function nodeLabel(node) {
  return String(node?.config?.label || node?.config?.title || '').trim();
}

/**
 * Destinations for the keyboard "Move to" menu: the top level of the
 * field's step (or form) and every container column in it, except where the
 * field already is.
 *
 * @return {Array<{parentId: string, columnIndex: ?number, label: string, depth: number}>}
 */
export function moveTargets(tree, nodeId, labels = {}) {
  const node = tree.nodes[nodeId];
  if (!node || node.type === 'step') return [];
  const rootId = tree.rootId || ROOT_NODE_ID;

  // The top of this field's step, or the form root.
  let top = node.parentId;
  const seen = new Set();
  while (top && tree.nodes[top] && tree.nodes[top].type !== 'step' && top !== rootId && !seen.has(top)) {
    seen.add(top);
    top = tree.nodes[top].parentId;
  }
  if (!top || !tree.nodes[top]) top = rootId;

  const currentColumn = locateColumn(tree, nodeId);
  const results = [];
  const visit = (id, depth) => {
    const current = tree.nodes[id];
    if (!current || id === nodeId) return;
    const lists = Array.isArray(current.columns)
      ? current.columns.map((col, i) => ({ items: col || [], columnIndex: i }))
      : [{ items: current.children || [], columnIndex: null }];
    if (acceptsChildren(current)) {
      lists.forEach(({ columnIndex }) => {
        const here = node.parentId === id && (columnIndex === null || columnIndex === currentColumn);
        if (!here && canDropInto(tree, { nodeId, parentId: id })) {
          let label;
          if (id === top) {
            label = labels.top || 'Top level';
          } else {
            const name = nodeLabel(current) || labels[current.type] || current.type;
            label = Array.isArray(current.columns) && current.columns.length > 1
              ? `${name}: ${(labels.column || 'column %d').replace('%d', columnIndex + 1)}`
              : name;
          }
          results.push({ parentId: id, columnIndex, label, depth });
        }
      });
    }
    lists.forEach(({ items }) => items.forEach((childId) => {
      const child = tree.nodes[childId];
      if (child && isContainerNode(child)) visit(childId, depth + 1);
    }));
  };
  visit(top, 0);
  return results;
}
