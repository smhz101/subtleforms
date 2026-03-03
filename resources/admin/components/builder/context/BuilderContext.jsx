/**
 * BuilderContext - Convenience Hooks
 *
 * Provides easy-to-use hooks that compose the underlying split contexts.
 * Components should prefer specific hooks (useTree, useSelection, etc.) over useBuilder()
 * to minimize re-renders.
 *
 * PERFORMANCE NOTE:
 * - useBuilder() subscribes to ALL contexts and re-renders on any change
 * - Use specific hooks (useBuilderTree, useBuilderSelection, etc.) when possible
 * - Only use useBuilder() if you truly need access to everything
 */

import { useTree } from './TreeContext';
import { useSelection } from './SelectionContext';
import { useValidation } from './ValidationContext';
import { useCommands } from './CommandsContext';
import { useConfig } from './ConfigContext';

/**
 * Hook to access ALL builder state and commands.
 * 
 * ⚠️ WARNING: This hook re-renders on ANY context change.
 * Prefer specific hooks when you only need part of the state.
 * 
 * @returns {Object} Complete builder context
 */
export function useBuilder() {
	const tree = useTree();
	const selection = useSelection();
	const validation = useValidation();
	const commands = useCommands();
	const config = useConfig();

	return {
		// Tree state
		tree,

		// Selection state & actions
		selectedId: selection.selectedId,
		setSelectedId: selection.setSelectedId,
		selectedStepId: selection.selectedStepId,
		setSelectedStepId: selection.setSelectedStepId,

		// Validation state
		validationErrors: validation.validationErrors,
		validationErrorsByFieldKey: validation.validationErrorsByFieldKey,

		// Config
		fieldDefinitions: config.fieldDefinitions,
		formType: config.formType,
		isReadOnly: config.isReadOnly,

		// Commands
		commands: commands.commands,
		actions: commands.actions,
	};
}

/**
 * Hook to access only the tree state.
 * Re-renders only when the schema tree changes.
 * 
 * @returns {Object} Schema tree
 */
export function useBuilderTree() {
	return useTree();
}

/**
 * Hook to access only the selection state.
 * Re-renders only when selection changes (frequent).
 * 
 * @returns {Object} Selection state and setters
 */
export function useBuilderSelection() {
	return useSelection();
}

/**
 * Hook to access only validation state.
 * Re-renders only when validation errors change.
 * 
 * @returns {Object} Validation errors
 */
export function useBuilderValidation() {
	return useValidation();
}

/**
 * Hook to access only command methods.
 * Never re-renders (commands are stable).
 * 
 * @returns {Object} Command functions and action handlers
 */
export function useBuilderCommands() {
	const commands = useCommands();
	return { ...commands.commands, ...commands.actions };
}

/**
 * Hook to access only config state.
 * Re-renders only when config changes (rare).
 * 
 * @returns {Object} Field definitions, form type, read-only state
 */
export function useBuilderConfig() {
	return useConfig();
}

// Legacy exports for backward compatibility
// Deprecated: Use split contexts instead
export { useBuilder as default };

