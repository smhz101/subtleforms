/**
 * Draft Autosave Hook
 *
 * Handles automatic saving of draft schemas when the builder is in DIRTY state.
 * This hook is isolated from UI concerns and publishing logic.
 *
 * @package SubtleForms
 * @version 1.3.1
 */

import { useEffect, useRef } from '@wordpress/element';
import { BUILDER_STATES, BUILDER_ACTIONS } from './useBuilderReducer';
import { apiPost } from '../utils/api';

/**
 * Autosave configuration
 */
const AUTOSAVE_DEBOUNCE_MS = 500;
const AUTOSAVE_RETRY_DELAY_MS = 2000;
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Hook to handle automatic draft saving
 *
 * @param {Object} options Configuration options
 * @param {Object} options.builderState - Current builder state from useBuilderReducer
 * @param {Function} options.dispatch - Dispatch function from useBuilderReducer
 * @param {string|number|null} options.formId - Current form ID
 * @param {boolean} options.enabled - Whether autosave is enabled (default: true)
 *
 * @returns {Object} Autosave status and control functions
 */
export function useDraftAutosave({ builderState, dispatch, formId, enabled = true }) {
  const timeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const lastSchemaRef = useRef(null);
  const latestBuilderStateRef = useRef(builderState);

  useEffect(() => {
    latestBuilderStateRef.current = builderState;
  }, [builderState]);

  const { state, draftSchema, isDirty } = builderState;

  useEffect(() => {
    // Don't autosave if disabled
    if (!enabled) {
      return;
    }

    // Only autosave when in DIRTY state
    if (state !== BUILDER_STATES.DIRTY) {
      return;
    }

    // Must have schema and form ID
    if (!draftSchema || !formId) {
      return;
    }

    // Don't autosave if not dirty
    if (!isDirty) {
      return;
    }

    // Clear any pending autosave
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce autosave
    timeoutRef.current = setTimeout(() => {
      performAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [state, draftSchema, isDirty, formId, enabled]);

  /**
   * Perform the actual autosave operation
   */
  const performAutosave = async () => {
    if (!draftSchema || !formId) {
      return;
    }

    // Store current schema for retry comparison
    lastSchemaRef.current = draftSchema;

    // Dispatch start action
    dispatch({ type: BUILDER_ACTIONS.START_AUTOSAVE });

    try {
      const { ok, body } = await apiPost(`/forms/${formId}/schema`, {
        schema: draftSchema,
        activate: false, // Autosave NEVER activates schema
      });

      if (!ok) {
        const message = body?.message || body?.data?.message || 'Failed to autosave';
        throw new Error(message);
      }

      // Reset retry count on success
      retryCountRef.current = 0;

      // Check if user made changes during autosave
      const stillDirty = lastSchemaRef.current !== builderState.draftSchema;

      dispatch({
        type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
        payload: { stillDirty },
      });
    } catch (error) {
      console.error('[useDraftAutosave] Save failed:', error);

      // Increment retry count
      retryCountRef.current += 1;

      // Dispatch error
      dispatch({
        type: BUILDER_ACTIONS.AUTOSAVE_ERROR,
        payload: { error: error.message },
      });

      // Retry if under max attempts
      if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        console.log(
          `[useDraftAutosave] Retrying in ${AUTOSAVE_RETRY_DELAY_MS}ms (attempt ${
            retryCountRef.current + 1
          }/${MAX_RETRY_ATTEMPTS})`
        );

        setTimeout(() => {
          const latest = latestBuilderStateRef.current;

          // Only retry if still in dirty state
          if (latest?.state === BUILDER_STATES.DIRTY) {
            performAutosave();
          }
        }, AUTOSAVE_RETRY_DELAY_MS);
      } else {
        console.error('[useDraftAutosave] Max retry attempts reached');
        retryCountRef.current = 0; // Reset for next time
      }
    }
  };

  /**
   * Force an immediate autosave (skips debounce)
   */
  const forceAutosave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    performAutosave();
  };

  /**
   * Cancel any pending autosave
   */
  const cancelAutosave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return {
    isAutosaving: state === BUILDER_STATES.AUTOSAVING,
    forceAutosave,
    cancelAutosave,
  };
}

export default useDraftAutosave;
