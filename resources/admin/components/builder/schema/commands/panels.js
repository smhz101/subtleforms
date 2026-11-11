/**
 * Tabs and Accordion panel commands (2.9.0).
 *
 * A Tabs or Accordion container holds panel nodes (`tab_panel`,
 * `accordion_panel`); each panel holds fields. These pure functions keep the
 * rules the builder and the server share:
 *
 * - a new container starts with two panels;
 * - a container never has fewer than one panel;
 * - deleting a panel moves its fields to the previous panel (the next one
 *   when it was the first), so no field is lost silently.
 *
 * Every function returns a new tree and never mutates its input.
 */

import { __, sprintf } from '@wordpress/i18n';
import { createPanelNode, addNodeToTree, removeNodeFromParent } from '../../utils/schemaTree';
import { collectExistingKeys } from '../../utils/idGenerator';
import { PANEL_OF, isPanelContainerType } from '../../../../../shared/panels';

/** Title of the nth panel (1-based). */
export function panelTitle(containerType, n) {
  return containerType === 'tabs_container'
    ? /* translators: %d: tab number */ sprintf(__('Tab %d', 'subtleforms'), n)
    : /* translators: %d: section number */ sprintf(__('Section %d', 'subtleforms'), n);
}

/** Ids of a container's panels, in order. */
export function panelIds(tree, containerId) {
  const container = tree.nodes[containerId];
  if (!container || !isPanelContainerType(container.type)) return [];
  return (container.children || []).filter((id) => tree.nodes[id]?.type === PANEL_OF[container.type]);
}

/**
 * Add a panel at the end (or at `position`) of a container.
 *
 * @param {Object} tree
 * @param {{containerId: string, position?: ?number}} command
 * @return {{tree: Object, panelId: ?string}}
 */
export function addPanel(tree, { containerId, position = null }) {
  const container = tree.nodes[containerId];
  if (!container || !isPanelContainerType(container.type)) {
    return { tree, panelId: null };
  }
  const existing = panelIds(tree, containerId);
  const panel = createPanelNode(
    container.type,
    panelTitle(container.type, existing.length + 1),
    collectExistingKeys(tree)
  );
  return {
    tree: addNodeToTree(tree, panel, { parentId: containerId, position }),
    panelId: panel.id,
  };
}

/**
 * Whether a panel may be deleted: not the last one of its container.
 */
export function canRemovePanel(tree, panelId) {
  const panel = tree.nodes[panelId];
  const container = panel && tree.nodes[panel.parentId];
  return !!container && isPanelContainerType(container.type) && panelIds(tree, container.id).length > 1;
}

/**
 * Delete a panel. Its fields move to the end of the previous panel (the next
 * one for the first panel). The container's `active` index follows.
 *
 * @param {Object} tree
 * @param {{panelId: string}} command
 * @return {{tree: Object, movedTo: ?string, count: number}} `count` is how many fields moved.
 */
export function removePanel(tree, { panelId }) {
  if (!canRemovePanel(tree, panelId)) {
    return { tree, movedTo: null, count: 0 };
  }
  const panel = tree.nodes[panelId];
  const containerId = panel.parentId;
  const ids = panelIds(tree, containerId);
  const index = ids.indexOf(panelId);
  const targetId = ids[index > 0 ? index - 1 : index + 1];

  const moving = panel.children || [];
  let working = removeNodeFromParent(tree, panelId);
  const nodes = { ...working.nodes };
  delete nodes[panelId];
  moving.forEach((childId) => {
    nodes[childId] = { ...nodes[childId], parentId: targetId };
  });
  const target = nodes[targetId];
  nodes[targetId] = { ...target, children: [...(target.children || []), ...moving] };

  const container = nodes[containerId];
  const remaining = ids.length - 1;
  const active = parseInt(container.config?.active, 10) || 0;
  let nextActive = active;
  if (index < active) nextActive = active - 1;
  nextActive = Math.max(0, Math.min(nextActive, remaining - 1));
  if (nextActive !== active) {
    nodes[containerId] = { ...container, config: { ...container.config, active: nextActive } };
  }

  working = { ...working, nodes };
  return { tree: working, movedTo: targetId, count: moving.length };
}

/**
 * Give a new Tabs or Accordion container its two starting panels.
 *
 * @param {Object} tree
 * @param {string} containerId
 * @return {Object} Tree.
 */
export function seedPanels(tree, containerId) {
  let working = tree;
  for (let i = 0; i < 2; i += 1) {
    working = addPanel(working, { containerId }).tree;
  }
  return working;
}
