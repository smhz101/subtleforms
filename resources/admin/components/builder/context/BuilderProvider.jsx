/**
 * BuilderProvider
 *
 * Wraps builder components and provides shared state/commands via context.
 * External API (schema/onChange props) remains unchanged.
 */

import { useMemo } from '@wordpress/element';
import { BuilderContext } from './BuilderContext';
import {
  insertNode,
  deleteNode,
  updateNodeConfig,
  moveNode,
  duplicateNode,
} from '../schema/commands';

export function BuilderProvider({
  children,
  tree,
  selectedId,
  setSelectedId,
  selectedStepId,
  setSelectedStepId,
  validationErrors = [],
  fieldDefinitions = {},
  onInsert,
  onDelete,
  onUpdate,
  onMove,
  onDuplicate,
  onRequestInsert,
  isReadOnly = false,
}) {
  const contextValue = useMemo(
    () => ({
      // State
      tree,
      selectedId,
      selectedStepId,
      validationErrors,
      fieldDefinitions,
      isReadOnly,

      // Selection actions
      setSelectedId,
      setSelectedStepId,

      // Command functions (pure)
      commands: {
        insertNode,
        deleteNode,
        updateNodeConfig,
        moveNode,
        duplicateNode,
      },

      // Action handlers (side effects)
      actions: {
        onInsert,
        onDelete,
        onUpdate,
        onMove,
        onDuplicate,
        onRequestInsert,
      },
    }),
    [
      tree,
      selectedId,
      setSelectedId,
      selectedStepId,
      setSelectedStepId,
      validationErrors,
      fieldDefinitions,
      isReadOnly,
      onInsert,
      onDelete,
      onUpdate,
      onMove,
      onDuplicate,
      onRequestInsert,
    ]
  );

  return (
    <BuilderContext.Provider value={contextValue}>
      {children}
    </BuilderContext.Provider>
  );
}
