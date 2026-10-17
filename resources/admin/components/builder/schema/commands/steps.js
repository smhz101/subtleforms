/**
 * Step (Page Break) commands.
 *
 * A multi-step form keeps every field inside a root-level `step` node. These
 * pure functions keep that invariant:
 *
 * - insertPageBreak(): adding a Page Break creates a boundary at the insertion
 *   point. On a form without steps the fields before the boundary become
 *   Step 1 and the fields after it become Step 2. With nothing before the
 *   boundary (insert at the very top) all existing fields go into Step 1 and
 *   the new break starts an empty Step 2 after them, so no field is ever left
 *   outside a step (QA-08). Inside an existing step the step is split at the
 *   insertion point.
 * - repairOrphanedFields(): a saved form with root-level fields next to steps
 *   (written by older builds) gets those fields moved into the first step,
 *   keeping their order, keys and settings.
 * - moveNodeToStep(): moves a top-level field of one step to the end of
 *   another step.
 * - unwrapSingleStep() / removeStep(): removing the last Page Break (a form
 *   left with one step) puts that step's fields back at root level in order,
 *   so the form is Standard again (2.3.2).
 *
 * Every function returns a new tree and never mutates its input, so the
 * builder applies each one as a single undoable edit.
 */

import { __, sprintf } from '@wordpress/i18n';
import { createNodeFromDefinition } from '../../utils/schemaTree';
import { collectExistingKeys } from '../../utils/idGenerator';
import { deleteNode } from './index';

const ROOT_NODE_ID = 'root';

/* translators: %d: step number */
const stepTitle = (n) => sprintf(__('Step %d', 'subtleforms'), n);

const FALLBACK_STEP_DEFINITION = {
  type: 'step',
  kind: 'structure',
  acceptsChildren: true,
  label: 'Step',
  fieldSpecificAttributes: { title: 'Step', description: '' },
};

function rootOf(tree) {
  return tree.nodes[tree.rootId || ROOT_NODE_ID];
}

/** Ids of the root-level step nodes, in order. */
export function getStepIds(tree) {
  const root = rootOf(tree);
  return (root?.children || []).filter((id) => tree.nodes[id]?.type === 'step');
}

/** True when the form has at least one step. */
export function isMultiStepTree(tree) {
  return getStepIds(tree).length > 0;
}

/**
 * The step a node lives in (walking up through containers), or null.
 */
export function getStepIdOf(tree, nodeId) {
  const seen = new Set();
  let current = tree.nodes[nodeId];
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.type === 'step') {
      return current.id;
    }
    current = current.parentId ? tree.nodes[current.parentId] : null;
  }
  return null;
}

function makeStep(definition, existingKeys, title) {
  const node = createNodeFromDefinition(definition || FALLBACK_STEP_DEFINITION, existingKeys);
  existingKeys.add(node.config.key);
  return {
    ...node,
    children: [],
    config: { ...node.config, title, description: node.config.description || '' },
  };
}

/**
 * Root-level non-step fields in a form that also has steps.
 */
export function findOrphanedFields(tree) {
  const root = rootOf(tree);
  const children = root?.children || [];
  if (!children.some((id) => tree.nodes[id]?.type === 'step')) {
    return [];
  }
  return children.filter((id) => tree.nodes[id] && tree.nodes[id].type !== 'step');
}

/**
 * Move root-level fields that sit beside steps into the first step.
 *
 * Fields before the first step go to the start of that step; fields after
 * it are appended to its end. Order within each group is kept.
 *
 * @return {{tree: Object, moved: string[]}}
 */
export function repairOrphanedFields(tree) {
  const orphans = findOrphanedFields(tree);
  if (!orphans.length) {
    return { tree, moved: [] };
  }
  const rootId = tree.rootId || ROOT_NODE_ID;
  const root = rootOf(tree);
  const stepIds = getStepIds(tree);
  const firstStepId = stepIds[0];
  const firstStepIndex = root.children.indexOf(firstStepId);

  const before = [];
  const after = [];
  root.children.forEach((id, index) => {
    if (orphans.includes(id)) {
      (index < firstStepIndex ? before : after).push(id);
    }
  });

  const firstStep = tree.nodes[firstStepId];
  const nodes = {
    ...tree.nodes,
    [rootId]: { ...root, children: stepIds },
    [firstStepId]: {
      ...firstStep,
      children: [...before, ...(firstStep.children || []), ...after],
    },
  };
  orphans.forEach((id) => {
    nodes[id] = { ...nodes[id], parentId: firstStepId };
  });

  return { tree: { ...tree, nodes }, moved: orphans };
}

/**
 * Insert a Page Break.
 *
 * @param {Object} tree
 * @param {Object} command
 * @param {Object} [command.definition] The `step` field definition.
 * @param {string} [command.parentId]   Where the break was dropped (root or a step).
 * @param {?number} [command.position] Index in that parent; null means the end.
 * @return {{tree: Object, newStepId: ?string, selectStepId: ?string}}
 */
export function insertPageBreak(tree, { definition, parentId = null, position = null } = {}) {
  const rootId = tree.rootId || ROOT_NODE_ID;
  // Never build on top of a broken shape.
  const repaired = repairOrphanedFields(tree).tree;
  const root = rootOf(repaired);
  const rootChildren = root?.children || [];
  const existingKeys = collectExistingKeys(repaired);
  const stepIds = getStepIds(repaired);

  // Form without steps: split the root list into Step 1 and Step 2.
  if (!stepIds.length) {
    const count = rootChildren.length;
    let cut;
    if (parentId && parentId !== rootId && repaired.nodes[parentId]) {
      // Dropped inside a container: break after that container.
      let top = repaired.nodes[parentId];
      const seen = new Set();
      while (top && top.parentId && top.parentId !== rootId && !seen.has(top.id)) {
        seen.add(top.id);
        top = repaired.nodes[top.parentId];
      }
      const index = top ? rootChildren.indexOf(top.id) : -1;
      cut = index === -1 ? count : index + 1;
    } else {
      cut = position === null || position === undefined ? count : Math.max(0, Math.min(position, count));
    }
    // Nothing above the break: keep every field in Step 1 and start an empty
    // Step 2 after them.
    if (cut === 0) {
      cut = count;
    }
    const step1 = makeStep(definition, existingKeys, stepTitle(1));
    const step2 = makeStep(definition, existingKeys, stepTitle(2));
    const beforeIds = rootChildren.slice(0, cut);
    const afterIds = rootChildren.slice(cut);

    const nodes = { ...repaired.nodes };
    step1.parentId = rootId;
    step2.parentId = rootId;
    step1.children = beforeIds;
    step2.children = afterIds;
    nodes[step1.id] = step1;
    nodes[step2.id] = step2;
    beforeIds.forEach((id) => {
      nodes[id] = { ...nodes[id], parentId: step1.id };
    });
    afterIds.forEach((id) => {
      nodes[id] = { ...nodes[id], parentId: step2.id };
    });
    nodes[rootId] = { ...root, children: [step1.id, step2.id] };

    return { tree: { ...repaired, nodes }, newStepId: step2.id, selectStepId: step2.id };
  }

  // Multi-step form: split the target step at the insertion point. A break
  // dropped at root level splits nothing and becomes a new empty step at that
  // position (or at the end).
  const targetStepId = parentId && repaired.nodes[parentId]?.type === 'step'
    ? parentId
    : getStepIdOf(repaired, parentId);

  const nodes = { ...repaired.nodes };
  const newStep = makeStep(definition, existingKeys, stepTitle(stepIds.length + 1));
  newStep.parentId = rootId;

  let insertAt;
  if (targetStepId && parentId === targetStepId) {
    const target = repaired.nodes[targetStepId];
    const children = target.children || [];
    const cut = position === null || position === undefined ? children.length : Math.max(0, Math.min(position, children.length));
    const moving = children.slice(cut);
    nodes[targetStepId] = { ...target, children: children.slice(0, cut) };
    newStep.children = moving;
    moving.forEach((id) => {
      nodes[id] = { ...nodes[id], parentId: newStep.id };
    });
    insertAt = rootChildren.indexOf(targetStepId) + 1;
  } else if (targetStepId) {
    // Dropped inside a container of a step: add a new step after that step.
    insertAt = rootChildren.indexOf(targetStepId) + 1;
  } else {
    insertAt = position === null || position === undefined
      ? rootChildren.length
      : Math.max(0, Math.min(position, rootChildren.length));
  }

  nodes[newStep.id] = newStep;
  const nextRootChildren = [...rootChildren];
  nextRootChildren.splice(insertAt, 0, newStep.id);
  nodes[rootId] = { ...root, children: nextRootChildren };

  return { tree: { ...repaired, nodes }, newStepId: newStep.id, selectStepId: newStep.id };
}

/**
 * Move a field (with everything inside it) to the end of another step.
 *
 * Only nodes that sit directly in a step can move; children of containers
 * move with their container. Keys, settings and logic travel with the node
 * because the node object itself is reused.
 */
export function moveNodeToStep(tree, { nodeId, stepId }) {
  const node = tree.nodes[nodeId];
  const target = tree.nodes[stepId];
  if (!node || !target || target.type !== 'step' || node.type === 'step') {
    return tree;
  }
  const source = tree.nodes[node.parentId];
  if (!source || source.type !== 'step' || source.id === stepId) {
    return tree;
  }
  const nodes = {
    ...tree.nodes,
    [source.id]: { ...source, children: (source.children || []).filter((id) => id !== nodeId) },
    [stepId]: { ...target, children: [...(target.children || []).filter((id) => id !== nodeId), nodeId] },
    [nodeId]: { ...node, parentId: stepId },
  };
  return { ...tree, nodes };
}

/**
 * Options for the inspector's Step select: "Step 2: Payment".
 */
export function stepOptions(tree) {
  return getStepIds(tree).map((id, index) => {
    const title = String(tree.nodes[id]?.config?.title || '').trim();
    const plain = !title || /^step\s*\d*$/i.test(title);
    return {
      value: id,
      label: plain
        ? stepTitle(index + 1)
        : /* translators: 1: step number, 2: step title */
          sprintf(__('Step %1$d: %2$s', 'subtleforms'), index + 1, title),
    };
  });
}

/**
 * A form with exactly one step has no Page Break left: its fields go back to
 * root level, in order, and the step goes away (2.3.2).
 *
 * @return {{tree: Object, unwrapped: boolean}}
 */
export function unwrapSingleStep(tree) {
  const stepIds = getStepIds(tree);
  if (stepIds.length !== 1) {
    return { tree, unwrapped: false };
  }
  const rootId = tree.rootId || ROOT_NODE_ID;
  const root = rootOf(tree);
  const stepId = stepIds[0];
  const step = tree.nodes[stepId];
  const children = step.children || [];
  const nodes = { ...tree.nodes };
  const rootChildren = [];
  (root.children || []).forEach((id) => {
    if (id === stepId) {
      rootChildren.push(...children);
    } else {
      rootChildren.push(id);
    }
  });
  children.forEach((id) => {
    nodes[id] = { ...nodes[id], parentId: rootId };
  });
  delete nodes[stepId];
  nodes[rootId] = { ...root, children: rootChildren };
  return { tree: { ...tree, nodes }, unwrapped: true };
}

/**
 * Remove a step. With more than two steps the step (and what is in it) is
 * deleted. Removing one of the last two steps, or the only step, removes the
 * last Page Break: the remaining fields go back to root level and the form is
 * Standard again. The only step keeps its fields.
 *
 * @return {{tree: Object, unwrapped: boolean}}
 */
export function removeStep(tree, stepId) {
  const stepIds = getStepIds(tree);
  if (!stepIds.includes(stepId)) {
    return { tree, unwrapped: false };
  }
  if (stepIds.length === 1) {
    return unwrapSingleStep(tree);
  }
  const next = deleteNode(tree, { nodeId: stepId });
  return unwrapSingleStep(next);
}
