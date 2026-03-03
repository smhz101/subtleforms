/**
 * useSchemaCommands.js
 * 
 * Schema mutation command handlers
 * Extracted from FormEditor.jsx to separate business logic from UI
 */

import { useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
  insertNode,
  deleteNode,
  updateNodeConfig,
  moveNode,
  duplicateNode,
} from '../schema/commands';
import { denormalizeTree } from '../utils/schemaTree';

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

      // Guardrail: Prevent nesting steps inside steps
      if (type === 'step' && context.parentId) {
        const parentNode = tree.nodes[context.parentId];
        if (parentNode?.type === 'step') {
          // eslint-disable-next-line no-alert
          alert(
            __(
              'Cannot add a step inside another step. Steps can only be added at the root level.',
              'subtleforms'
            )
          );
          return;
        }
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

        // DEBUG: Log field creation
        if (newNodeId) {
          const node = newTree.nodes[newNodeId];
          console.log('[SubtleForms] Creating field:', {
            fieldType: type,
            fieldId: node.id,
            fieldLabel: node.config?.label,
            targetParentId: context.parentId,
            selectedStepId: selectedStepId,
            columnIndex: context.columnIndex,
            position: context.position,
          });
          setSelectedId(node.id);
        }

        return newTree;
      });
    },
    [definitionMap, updateTree, tree, selectedStepId, isReadOnly, setSelectedId]
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

      // DEBUG: Log dock add
      console.log('[SubtleForms] Dock Add:', {
        fieldType: type,
        selectedStepId: selectedStepId,
        targetParentId: targetParentId,
        isStep: targetParentId !== rootId,
      });

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

        // Guardrail: Prevent moving fields across steps
        if (node.parentId !== destination.parentId) {
          console.warn(
            '[SubtleForms] Moving fields between different parents (steps) is not supported'
          );
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
    const definition = definitionMap['step'];
    if (!definition) {
      console.warn('Step field definition not found');
      return;
    }

    const rootNode = tree.nodes[rootId];
    const steps = (rootNode?.children || [])
      .map((id) => tree.nodes[id])
      .filter((node) => node && node.type === 'step');
    const stepNumber = steps.length + 1;

    updateTree((currentTree) => {
      const result = insertNode(currentTree, {
        definition,
        parentId: rootId,
        columnIndex: null,
        position: null,
      });

      // Find the newly inserted node
      const newNodeId = Object.keys(result.nodes).find(
        (id) => !currentTree.nodes[id]
      );

      if (newNodeId) {
        return updateNodeConfig(result, {
          nodeId: newNodeId,
          changes: {
            title: `Step ${stepNumber}`,
            description: '',
          },
        });
      }

      return result;
    });
  }, [definitionMap, tree, updateTree, rootId]);

  const handleDeleteStep = useCallback(
    (stepId) => {
      const rootNode = tree.nodes[rootId];
      const steps = (rootNode?.children || [])
        .map((id) => tree.nodes[id])
        .filter((node) => node && node.type === 'step');

      if (steps.length <= 1) return;

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
  };
}
