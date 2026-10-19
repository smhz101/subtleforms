/**
 * Draft Autosave Hook
 *
 * Handles automatic saving of draft schemas when the builder is in DIRTY state.
 * This hook is isolated from UI concerns and publishing logic.
 *
 * @package SubtleForms
 * @version 1.4.0
 */

import { useEffect, useRef } from '@wordpress/element';
import { BUILDER_STATES, BUILDER_ACTIONS } from './useBuilderReducer';
import { apiPost } from '../utils/api';
import { schemaEquals } from '../utils/schemaEquals';
import { debug } from '../../shared/debug';
import { describeSaveError } from '../utils/saveErrors';

/**
 * Autosave configuration
 */
const AUTOSAVE_DEBOUNCE_MS = 30000;      // Wait 30s after last change before saving (Part B21)
const AUTOSAVE_RETRY_DELAY_MS = 5000;    // 5s between retries
const MAX_RETRY_ATTEMPTS = 2;            // Max 2 retries (not counting the first attempt)

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
  // The last schema the server accepted. Undo/redo can walk the draft back to
  // exactly this state, which is dirty by the reducer's reckoning but has
  // nothing left to send.
  const savedSchemaRef = useRef(null);
  const latestBuilderStateRef = useRef(builderState);

  // Track when we're rate-limited and should pause all save attempts
  const rateLimitedUntilRef = useRef(0);
  // Track if a save is already in flight to prevent concurrent saves
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    latestBuilderStateRef.current = builderState;
  }, [builderState]);

  const { state, draftSchema, isDirty } = builderState;

  // A clean builder means the draft is what the server holds, true on load,
  // after a manual save and after a publish. Recording it here means the first
  // autosave after a load can also be skipped when nothing really changed.
  useEffect(() => {
    if (!isDirty && draftSchema) {
      savedSchemaRef.current = draftSchema;
    }
  }, [isDirty, draftSchema]);

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

    // Clear any pending autosave (reset debounce timer on each change)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce autosave - delay is extended if we're currently rate-limited
    const now = Date.now();
    const rateLimitedFor = rateLimitedUntilRef.current - now;
    const delay = rateLimitedFor > 0
      ? rateLimitedFor + 500  // Wait until rate limit clears + small buffer
      : AUTOSAVE_DEBOUNCE_MS;

    timeoutRef.current = setTimeout(() => {
      performAutosave();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [state, draftSchema, isDirty, formId, enabled]);

  // Save on blur and when the tab is hidden: with a 30s debounce, an
  // in-progress edit could be lost if the user switches away mid-edit, so
  // flush immediately on window blur and on visibilitychange → hidden
  // (Part B21). Uses refs so the listener can read the latest state without
  // re-registering on every keystroke.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const flushIfDirty = () => {
      const latest = latestBuilderStateRef.current;
      if (
        latest?.state === BUILDER_STATES.DIRTY &&
        latest?.isDirty &&
        !saveInFlightRef.current
      ) {
        forceAutosave();
      }
    };

    const onBlur = () => flushIfDirty();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushIfDirty();
      }
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // forceAutosave is stable enough (closes over refs); enabled toggles
    // listener registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  /**
   * Perform the actual autosave operation
   */
  const performAutosave = async () => {
    const latest = latestBuilderStateRef.current;

    if (!latest?.draftSchema || !formId) {
      return;
    }

    // Prevent concurrent saves
    if (saveInFlightRef.current) {
      return;
    }

    // Check if still rate-limited
    if (Date.now() < rateLimitedUntilRef.current) {
      return;
    }

    // Nothing to save: the draft matches what the server already holds. This
    // happens when an edit is undone back to the saved state, and when a
    // control re-emits a value that changed nothing.
    //
    // The state machine still walks DIRTY → AUTOSAVING → SAVED, because SAVED
    // is not reachable from DIRTY directly and because the builder has to stop
    // reporting unsaved work either way. Only the request is skipped.
    if (
      savedSchemaRef.current !== null &&
      schemaEquals(latest.draftSchema, savedSchemaRef.current)
    ) {
      dispatch({ type: BUILDER_ACTIONS.START_AUTOSAVE });
      dispatch({
        type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
        payload: { stillDirty: false },
      });
      return;
    }

    // Store current schema snapshot for dirty comparison after save
    lastSchemaRef.current = latest.draftSchema;
    saveInFlightRef.current = true;

    // Dispatch start action
    dispatch({ type: BUILDER_ACTIONS.START_AUTOSAVE });

    try {
      const { ok, status, body } = await apiPost(`/forms/${formId}/schema`, {
        schema: latest.draftSchema,
        activate: false, // Autosave NEVER activates schema
      });

      saveInFlightRef.current = false;

      // Handle rate limiting (429) specifically
      if (status === 429) {
        const retryAfterSeconds = body?.error?.meta?.retry_after || body?.data?.error?.meta?.retry_after || 30;
        const waitMs = (retryAfterSeconds + 2) * 1000; // Add 2s buffer

        rateLimitedUntilRef.current = Date.now() + waitMs;

        console.warn(`[useDraftAutosave] Rate limited. Pausing autosave for ${retryAfterSeconds + 2}s.`);

        // Dispatch error so UI can show a gentle notice
        dispatch({
          type: BUILDER_ACTIONS.AUTOSAVE_ERROR,
          payload: { error: 'Autosave paused briefly. Your changes are safe.' },
        });

        // Schedule a single retry after the rate limit clears
        timeoutRef.current = setTimeout(() => {
          const current = latestBuilderStateRef.current;
          if (current?.state === BUILDER_STATES.DIRTY && !saveInFlightRef.current) {
            performAutosave();
          }
        }, waitMs + 500);

        return;
      }

      if (!ok) {
        // Say which setting stopped the save (QA-03).
        throw new Error(describeSaveError(body, status));
      }

      // Success - reset counters
      retryCountRef.current = 0;
      rateLimitedUntilRef.current = 0;
      savedSchemaRef.current = lastSchemaRef.current;

      // Check if user made changes during the save
      const currentLatest = latestBuilderStateRef.current;
      const stillDirty = currentLatest?.draftSchema !== lastSchemaRef.current;

      dispatch({
        type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
        payload: { stillDirty },
      });

    } catch (error) {
      saveInFlightRef.current = false;
      console.error('[useDraftAutosave] Save failed:', error);

      retryCountRef.current += 1;

      dispatch({
        type: BUILDER_ACTIONS.AUTOSAVE_ERROR,
        payload: { error: error.message },
      });

      // Exponential backoff retry (only for non-rate-limit errors)
      if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        const backoffMs = AUTOSAVE_RETRY_DELAY_MS * retryCountRef.current;
        debug(
          `[useDraftAutosave] Retrying in ${backoffMs}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRY_ATTEMPTS})`
        );

        timeoutRef.current = setTimeout(() => {
          const current = latestBuilderStateRef.current;
          if (current?.state === BUILDER_STATES.DIRTY && !saveInFlightRef.current) {
            performAutosave();
          }
        }, backoffMs);
      } else {
        console.error('[useDraftAutosave] Max retry attempts reached. Will retry on next change.');
        retryCountRef.current = 0; // Reset so the next user change can trigger autosave again
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
    // Reset rate limit block for forced saves
    rateLimitedUntilRef.current = 0;
    retryCountRef.current = 0;
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
