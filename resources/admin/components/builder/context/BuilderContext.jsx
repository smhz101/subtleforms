/**
 * BuilderContext
 *
 * Internal context for builder components to access shared state and commands.
 * This eliminates prop drilling within the builder while keeping external APIs unchanged.
 *
 * IMPORTANT: This context is INTERNAL to builder components only.
 * External pages/APIs must continue using FormEditor's props interface.
 */

import { createContext, useContext } from '@wordpress/element';

/**
 * BuilderContext provides:
 * - tree: Current schema tree structure
 * - selectedId: Currently selected node ID
 * - selectedStepId: Currently selected step ID (for multi-step forms)
 * - validationErrors: Array of validation errors
 * - fieldDefinitions: Map of field type definitions
 * - commands: Object containing all mutation commands
 *   - insertNode(tree, command)
 *   - deleteNode(tree, command)
 *   - updateNodeConfig(tree, command)
 *   - moveNode(tree, command)
 *   - duplicateNode(tree, command)
 * - actions: Object containing UI state actions
 *   - setSelectedId(id)
 *   - setSelectedStepId(id)
 *   - onInsert(type, context)
 *   - onDelete(nodeId)
 *   - onUpdate(nodeId, changes)
 *   - onMove(nodeId, destination)
 *   - onDuplicate(nodeId, destination)
 */
export const BuilderContext = createContext(null);

/**
 * Hook to access BuilderContext
 * @throws {Error} if used outside BuilderProvider
 */
export function useBuilder() {
  const context = useContext(BuilderContext);

  if (!context) {
    throw new Error(
      'useBuilder must be used within BuilderProvider. ' +
        'This is an internal builder hook and should only be used in builder components.'
    );
  }

  return context;
}

/**
 * Hook to access only the tree state
 * Useful for read-only components
 */
export function useBuilderTree() {
  const { tree } = useBuilder();
  return tree;
}

/**
 * Hook to access only the selection state
 */
export function useBuilderSelection() {
  const { selectedId, selectedStepId, setSelectedId, setSelectedStepId } =
    useBuilder();
  return { selectedId, selectedStepId, setSelectedId, setSelectedStepId };
}

/**
 * Hook to access only the command methods
 */
export function useBuilderCommands() {
  const { commands, actions } = useBuilder();
  return { ...commands, ...actions };
}

/**
 * Hook to access only validation state
 */
export function useBuilderValidation() {
  const { validationErrors } = useBuilder();
  return validationErrors;
}
