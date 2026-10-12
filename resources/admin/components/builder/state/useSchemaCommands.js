/**
 * useSchemaCommands.js
 * 
 * Schema mutation command handlers
 * Extracted from FormEditor.jsx to separate business logic from UI
 */

import { useCallback } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
  insertNode,
  deleteNode,
  updateNodeConfig,
  moveNode,
  duplicateNode,
} from '../schema/commands';
import { denormalizeTree } from '../utils/schemaTree';
import { insertPageBreak, moveNodeToStep, getStepIdOf } from '../schema/commands/steps';
import { canDropInto } from '../dnd/resolveDrop';
import { debug } from '../../../../shared/debug';

/**
 * Custom hook for schema command handlers
 * 
 * @param {Object} params
 * @param {Object} params.tree - Current schema tree
 * @param {Function} params.updateTree - Tree update function
 * @param {Function} params.setTree - Direct tree setter (for duplicate)
 * @param {Function} params.setSelectedId - Selection setter
 * @param {string} params.selectedStepId - Currently selected step ID
 * @param {string} params.rootId - Root node ID
 * @param {Object} params.definitionMap - Field definitions map
 * @param {boolean} params.isReadOnly - Read-only mode flag
 * @param {Function} params.onChange - Schema change callback
 * @param {Object} params.schemaRef - Schema ref for direct updates
 * @returns {Object} Command handlers
 */
export function useSchemaCommands({
  tree,
  updateTree,
  setTree,
  setSelectedId,
  selectedStepId,
  setSelectedStepId,
  rootId,
  definitionMap,
  isReadOnly,
  onChange,
  schemaRef,
}) {
  const handleInsert = useCallback(
    (type, context) => {
      // Block inserts in read-only mode
      if (isReadOnly) {
        return;
      }

      const definition = definitionMap[type];
      if (!definition) {
        console.warn('Missing field definition for', type);
        return;
      }

      // A Page Break splits the form (or the step) at the insertion point in
      // one undoable edit, so no field is left outside a step (QA-08).
      if (type === 'step') {
        // Computed from the current tree (not inside the state updater) so
        // the new step can be selected right away.
        const result = insertPageBreak(tree, {
          definition,
          parentId: context?.parentId || rootId,
          position: context?.position ?? null,
        });
        updateTree(() => result.tree);
        if (result.selectStepId) {
          setSelectedStepId?.(result.selectStepId);
          setSelectedId(result.selectStepId);
        }
        return;
      }

      // Use command layer for insertion
      updateTree((currentTree) => {
        const newTree = insertNode(currentTree, {
          definition,
          parentId: context.parentId,
          columnIndex: context.columnIndex,
          position: context.position,
        });

        // Find the new node ID by comparing trees
        const newNodeId = Object.keys(newTree.nodes).find(
          (id) => !currentTree.nodes[id]
        );

        if (newNodeId) {
          if (process.env.NODE_ENV !== 'production') {
            const node = newTree.nodes[newNodeId];
            debug('[SubtleForms] Creating field:', {
              fieldType: type,
              fieldId: node.id,
              fieldLabel: node.config?.label,
              targetParentId: context.parentId,
              selectedStepId: selectedStepId,
              columnIndex: context.columnIndex,
              position: context.position,
            });
          }
          setSelectedId(newNodeId);
        }

        return newTree;
      });
    },
    [definitionMap, updateTree, tree, rootId, selectedStepId, isReadOnly, setSelectedId, setSelectedStepId]
  );

  const handleDockAdd = useCallback(
    (type) => {
      // Check for multiple CAPTCHA fields (warning, non-blocking)
      if (type === 'captcha') {
        const captchaCount = Object.values(tree.nodes).filter(
          (node) => node?.type === 'captcha'
        ).length;
        if (captchaCount >= 1) {
          const message = __(
            'Warning: Adding multiple CAPTCHA fields may cause conflicts. Most forms should only use one CAPTCHA field.',
            'subtleforms'
          );
          // eslint-disable-next-line no-alert
          if (
            !confirm(message + '\n\n' + __('Continue anyway?', 'subtleforms'))
          ) {
            return;
          }
        }
      }

      // If a step is selected, add to that step; otherwise add to root
      const targetParentId = selectedStepId || rootId;

      if (process.env.NODE_ENV !== 'production') {
        debug('[SubtleForms] Dock Add:', {
          fieldType: type,
          selectedStepId: selectedStepId,
          targetParentId: targetParentId,
          isStep: targetParentId !== rootId,
        });
      }

      handleInsert(type, {
        parentId: targetParentId,
        columnIndex: null,
        position: null,
      });
    },
    [handleInsert, rootId, selectedStepId, tree.nodes]
  );

  const handleDelete = useCallback(
    (nodeId) => {
      // Block deletes in read-only mode
      if (isReadOnly) {
        return;
      }

      const node = tree.nodes[nodeId];

      // Guardrail: Prevent deleting the last step in a multi-step form
      if (node?.type === 'step') {
        const rootNode = tree.nodes[rootId];
        const stepCount = (rootNode?.children || []).filter(
          (id) => tree.nodes[id]?.type === 'step'
        ).length;

        if (stepCount <= 1) {
          // eslint-disable-next-line no-alert
          alert(
            __(
              'Cannot delete the last step. Multi-step forms require at least one step.',
              'subtleforms'
            )
          );
          return;
        }
      }

      updateTree((currentTree) => deleteNode(currentTree, { nodeId }));
      setSelectedId((prev) => (prev === nodeId ? null : prev));
    },
    [updateTree, tree, rootId, isReadOnly, setSelectedId]
  );

  const handleUpdate = useCallback(
    (nodeId, changes) => {
      // Block updates in read-only mode
      if (isReadOnly) {
        return;
      }

      updateTree((currentTree) =>
        updateNodeConfig(currentTree, { nodeId, changes })
      );
    },
    [updateTree, isReadOnly]
  );

  const handleMove = useCallback(
    (nodeId, destination) => {
      // Block moves in read-only mode
      if (isReadOnly) {
        return;
      }

      updateTree((currentTree) => {
        const node = currentTree.nodes[nodeId];
        if (!node) {
          return currentTree;
        }

        // Containers accept drops into their drop zone; a node never moves
        // into itself, a step never nests and fixed groups keep their parts.
        if (!canDropInto(currentTree, { nodeId, parentId: destination.parentId || rootId })) {
          return currentTree;
        }

        return moveNode(currentTree, {
          nodeId,
          parentId: destination.parentId,
          columnIndex: destination.columnIndex,
          position: destination.position,
        });
      });
    },
    [updateTree, isReadOnly]
  );

  const handleDuplicate = useCallback(
    (nodeId, destination) => {
      // Block duplicates in read-only mode
      if (isReadOnly) {
        return;
      }

      if (!destination) {
        return;
      }

      // Warn when duplicating CAPTCHA fields (non-blocking)
      const node = tree.nodes[nodeId];
      if (node?.type === 'captcha') {
        const message = __(
          'Warning: Duplicating CAPTCHA fields may cause conflicts. Most forms should only use one CAPTCHA field.',
          'subtleforms'
        );
        // eslint-disable-next-line no-alert
        if (
          !confirm(message + '\n\n' + __('Continue anyway?', 'subtleforms'))
        ) {
          return;
        }
      }

      setTree((currentTree) => {
        const { tree: nextTree, newNodeId } = duplicateNode(currentTree, {
          nodeId,
          destination,
        });

        if (!newNodeId || nextTree === currentTree) {
          return currentTree;
        }

        const fields = denormalizeTree(nextTree);
        const updatedSchema = {
          ...schemaRef.current,
          fields,
        };

        schemaRef.current = updatedSchema;
        onChange(updatedSchema);
        setSelectedId(newNodeId);

        return nextTree;
      });
    },
    [onChange, tree.nodes, setTree, setSelectedId, schemaRef, isReadOnly]
  );

  const handleAddStep = useCallback(() => {
    handleInsert('step', { parentId: rootId, columnIndex: null, position: null });
  }, [handleInsert, rootId]);

  /**
   * Move a field to the end of another step, switch the canvas to that step
   * and keep the field selected (owner request, 2.3.1). One undoable edit.
   */
  const handleMoveToStep = useCallback(
    (nodeId, stepId) => {
      if (isReadOnly) {
        return;
      }
      const node = tree.nodes[nodeId];
      if (!node || !tree.nodes[stepId] || getStepIdOf(tree, nodeId) === stepId) {
        return;
      }
      updateTree((currentTree) => {
        const current = currentTree.nodes[nodeId];
        if (!current) return currentTree;
        if (currentTree.nodes[current.parentId]?.type === 'step') {
          return moveNodeToStep(currentTree, { nodeId, stepId });
        }
        // A field inside a container leaves the container for the new step.
        return moveNode(currentTree, { nodeId, parentId: stepId, columnIndex: null, position: null });
      });
      setSelectedStepId?.(stepId);
      setSelectedId(nodeId);
    },
    [isReadOnly, tree, updateTree, setSelectedStepId, setSelectedId]
  );

  const handleDeleteStep = useCallback(
    (stepId) => {
      const rootNode = tree.nodes[rootId];
      const steps = (rootNode?.children || [])
        .map((id) => tree.nodes[id])
        .filter((node) => node && node.type === 'step');

      if (steps.length <= 1) return;

      // A step with fields takes them with it: ask first.
      const count = (tree.nodes[stepId]?.children || []).length;
      if (
        count > 0 &&
        // eslint-disable-next-line no-alert
        !window.confirm(
          sprintf(
            /* translators: %d: number of fields */
            _n(
              'Delete this step and the %d field in it? You can undo this.',
              'Delete this step and the %d fields in it? You can undo this.',
              count,
              'subtleforms'
            ),
            count
          )
        )
      ) {
        return;
      }

      updateTree((currentTree) => deleteNode(currentTree, { nodeId: stepId }));
    },
    [tree, updateTree, rootId]
  );

  return {
    handleInsert,
    handleDockAdd,
    handleDelete,
    handleUpdate,
    handleMove,
    handleDuplicate,
    handleAddStep,
    handleDeleteStep,
    handleMoveToStep,
  };
}
