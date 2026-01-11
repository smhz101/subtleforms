/**
 * Builder Validation Hook
 *
 * Handles validation error states and retry logic.
 */

import { useCallback, useMemo } from '@wordpress/element';
import { BUILDER_ACTIONS } from '../useBuilderReducer';

export default function useBuilderValidation({
  builderState,
  dispatch,
  forceAutosave,
  lastManualSaveRef,
  performSave,
}) {
  const { autoSaveError, saveError, validationErrors } = builderState;

  const hasValidationErrors = Array.isArray(validationErrors) && validationErrors.length > 0;

  const dismissRecoverableErrors = useCallback(() => {
    dispatch({ type: BUILDER_ACTIONS.DISMISS_ERROR });
  }, [dispatch]);

  const retryAutosave = useCallback(() => {
    if (typeof forceAutosave === 'function') {
      forceAutosave();
    }
  }, [forceAutosave]);

  const retryLastManualSave = useCallback(() => {
    if (performSave && lastManualSaveRef?.current) {
      performSave({
        auto: false,
        targetStatus: lastManualSaveRef.current.targetStatus,
      });
    }
  }, [performSave, lastManualSaveRef]);

  return {
    hasValidationErrors,
    autoSaveError,
    saveError,
    validationErrors,
    dismissRecoverableErrors,
    retryAutosave,
    retryLastManualSave,
  };
}
