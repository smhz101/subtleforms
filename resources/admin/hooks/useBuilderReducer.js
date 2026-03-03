/**
 * Builder State Machine Reducer
 *
 * Enforces FSM transitions defined in docs/builder-state-machine.md
 *
 * States: INIT, EMPTY_DRAFT, EDITING, DIRTY, AUTOSAVING, SAVED,
 *         PREVIEWING, PUBLISHING, PUBLISHED, ERROR
 *
 * ===========================================================================
 * HISTORY BATCHING STRATEGY (v1.5.0)
 * ===========================================================================
 *
 * PROBLEM:
 * High-frequency operations (drag, reorder) can create dozens of history
 * entries per second, making undo/redo unusable and consuming memory.
 *
 * SOLUTION:
 * Implement commit-on-quiet batching:
 *
 * 1. IMMEDIATE UI UPDATE:
 *    - draftSchema updates instantly for smooth UX
 *    - User sees real-time changes during drag
 *
 * 2. DEFERRED HISTORY COMMIT:
 *    - During rapid edits, track:
 *      * historyBatchStartSchema: Schema before batch started
 *      * historyBatchPendingSchema: Latest schema (same as draftSchema)
 *    - Do NOT add to schemaHistoryPast yet
 *
 * 3. COMMIT ON QUIET:
 *    - After HISTORY_BATCH_WINDOW_MS (300ms) of no edits
 *    - Commit the START schema to history as a single undo point
 *    - User can undo the entire drag sequence in one step
 *
 * 4. CONFIGURATION:
 *    - MAX_HISTORY_LENGTH: Limits memory (default 50)
 *    - HISTORY_BATCH_WINDOW_MS: Time window for batching (default 300ms)
 *
 * BENEFITS:
 * - Clean history: Drag sequences = 1 undo point
 * - Smooth UX: No lag during drag
 * - Memory safe: Configurable limits
 * - Backward compatible: Undo/redo UX unchanged
 *
 * IMPLEMENTATION NOTES:
 * - Manual edits (typing) naturally have pauses, so they commit normally
 * - Batch timer managed in BuilderPage useEffect
 * - Undo/redo clear pending batches to stay consistent
 * - skipBatching flag available for operations that should commit immediately
 *
 * @package SubtleForms
 * @version 1.5.0
 */

import { useReducer } from '@wordpress/element';

// ============================================================================
// FSM States
// ============================================================================

export const BUILDER_STATES = {
  INIT: 'INIT',
  EMPTY_DRAFT: 'EMPTY_DRAFT',
  EDITING: 'EDITING',
  DIRTY: 'DIRTY',
  AUTOSAVING: 'AUTOSAVING',
  SAVED: 'SAVED',
  PREVIEWING: 'PREVIEWING',
  PUBLISHING: 'PUBLISHING',
  PUBLISHED: 'PUBLISHED',
  ERROR: 'ERROR',
};

// ============================================================================
// Action Types
// ============================================================================

export const BUILDER_ACTIONS = {
  INIT_BUILDER: 'INIT_BUILDER',
  LOAD_SUCCESS: 'LOAD_SUCCESS',
  EDIT_SCHEMA: 'EDIT_SCHEMA',
  COMMIT_HISTORY_BATCH: 'COMMIT_HISTORY_BATCH',
  UNDO_SCHEMA: 'UNDO_SCHEMA',
  REDO_SCHEMA: 'REDO_SCHEMA',
  SET_VALIDATION_ERRORS: 'SET_VALIDATION_ERRORS',
  START_AUTOSAVE: 'START_AUTOSAVE',
  AUTOSAVE_SUCCESS: 'AUTOSAVE_SUCCESS',
  AUTOSAVE_ERROR: 'AUTOSAVE_ERROR',
  START_PUBLISH: 'START_PUBLISH',
  PUBLISH_SUCCESS: 'PUBLISH_SUCCESS',
  PUBLISH_ERROR: 'PUBLISH_ERROR',
  OPEN_PREVIEW: 'OPEN_PREVIEW',
  CLOSE_PREVIEW: 'CLOSE_PREVIEW',
  CLOSE_BUILDER: 'CLOSE_BUILDER',
  DISMISS_ERROR: 'DISMISS_ERROR',
};

// ============================================================================
// Allowed Transitions Map
// ============================================================================

export const ALLOWED_TRANSITIONS = {
  [BUILDER_STATES.INIT]: [
    BUILDER_STATES.EMPTY_DRAFT,
    BUILDER_STATES.EDITING,
    BUILDER_STATES.PUBLISHED,
    BUILDER_STATES.ERROR,
  ],
  [BUILDER_STATES.EMPTY_DRAFT]: [BUILDER_STATES.DIRTY, BUILDER_STATES.ERROR],
  [BUILDER_STATES.EDITING]: [BUILDER_STATES.DIRTY, BUILDER_STATES.PREVIEWING, BUILDER_STATES.ERROR],
  [BUILDER_STATES.DIRTY]: [
    BUILDER_STATES.AUTOSAVING,
    BUILDER_STATES.PUBLISHING,
    BUILDER_STATES.PREVIEWING,
    BUILDER_STATES.ERROR,
  ],
  [BUILDER_STATES.AUTOSAVING]: [BUILDER_STATES.SAVED, BUILDER_STATES.DIRTY, BUILDER_STATES.ERROR],
  [BUILDER_STATES.SAVED]: [
    BUILDER_STATES.DIRTY,
    BUILDER_STATES.EDITING,
    BUILDER_STATES.PREVIEWING,
    BUILDER_STATES.PUBLISHING,
    BUILDER_STATES.ERROR,
  ],
  [BUILDER_STATES.PREVIEWING]: [BUILDER_STATES.EDITING, BUILDER_STATES.DIRTY, BUILDER_STATES.ERROR],
  // Task 5.5/5.6: Publish can fail and return to a stable state (e.g. validation)
  [BUILDER_STATES.PUBLISHING]: [
    BUILDER_STATES.PUBLISHED,
    BUILDER_STATES.SAVED,
    BUILDER_STATES.DIRTY,
    BUILDER_STATES.ERROR,
  ],
  [BUILDER_STATES.PUBLISHED]: [
    BUILDER_STATES.EDITING,
    BUILDER_STATES.DIRTY,
    BUILDER_STATES.PREVIEWING,
    BUILDER_STATES.ERROR,
  ],
  [BUILDER_STATES.ERROR]: [BUILDER_STATES.EDITING, BUILDER_STATES.DIRTY, BUILDER_STATES.SAVED],
};

// ============================================================================
// Transition Validation
// ============================================================================

function validateTransition(currentState, nextState, actionType) {
  // Self-transition is always safe (no state change).
  if (currentState === nextState) {
    return true;
  }

  const allowedStates = ALLOWED_TRANSITIONS[currentState] || [];

  if (!allowedStates.includes(nextState)) {
    const errorMsg = `[FSM] Illegal transition: ${currentState} → ${nextState} (action: ${actionType})`;

    if (process.env.NODE_ENV === 'development') {
      // Development: Throw to catch bugs early
      throw new Error(errorMsg);
    }
    // Production: Fail safely by returning false
    return false;
  }

  return true;
}

// ============================================================================
// History Configuration
// ============================================================================

/**
 * Maximum number of undo history entries to retain.
 * Configurable to prevent memory bloat during high-frequency edits.
 * @type {number}
 */
export const MAX_HISTORY_LENGTH = 50;

/**
 * Time window (ms) for batching rapid schema changes.
 * Operations within this window are treated as a single history entry.
 * Prevents history spam during drag operations.
 * @type {number}
 */
export const HISTORY_BATCH_WINDOW_MS = 300;

// ============================================================================
// Initial State
// ============================================================================

export const initialBuilderState = {
  // FSM state
  state: BUILDER_STATES.INIT,

  // Form metadata
  formId: null,
  formTitle: '',
  formStatus: 'draft', // 'draft' | 'published'

  // Schema state
  draftSchema: null,
  isDirty: false,

  // Task 6.4: Undo/Redo history for schema edits
  schemaHistoryPast: [],
  schemaHistoryFuture: [],

  // History batching state (prevents spam during drag operations)
  // When non-null, indicates a batch is in progress
  historyBatchTimer: null,
  // Stores the schema that will be committed when the batch window closes
  historyBatchPendingSchema: null,
  // Stores the schema that existed before the batch started (for undo)
  historyBatchStartSchema: null,

  // Task 5.5: Structured schema validation errors
  validationErrors: [],
  // Field-level validation errors: { fieldId: 'error message' }
  fieldErrors: {},

  // Operation flags
  loading: true,
  saving: false,
  autoSaving: false,
  publishing: false,
  previewing: false,

  // Error state
  error: null,
  saveError: null,
  autoSaveError: null,
  
  // Rate limiting state
  isRateLimited: false,
  rateLimitRetryAfter: null,
  
  // Conflict state (optimistic locking)
  hasConflict: false,
  conflictData: null,

  // Metadata
  lastSaveTime: null,
  lastAutoSaveTime: null,
};

// ============================================================================
// Reducer
// ============================================================================

function builderReducer(state, action) {
  switch (action.type) {
    // ------------------------------------------------------------------------
    // INIT_BUILDER
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.INIT_BUILDER: {
      return {
        ...state,
        state: BUILDER_STATES.INIT,
        loading: true,
        formId: action.payload?.formId || null,
        schemaHistoryPast: [],
        schemaHistoryFuture: [],
      };
    }

    // ------------------------------------------------------------------------
    // LOAD_SUCCESS
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.LOAD_SUCCESS: {
      const { form, schema } = action.payload;

      let nextState;
      if (!schema || (Array.isArray(schema) && schema.length === 0)) {
        nextState = BUILDER_STATES.EMPTY_DRAFT;
      } else if (form.status === 'published') {
        nextState = BUILDER_STATES.PUBLISHED;
      } else {
        nextState = BUILDER_STATES.EDITING;
      }

      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      return {
        ...state,
        state: nextState,
        loading: false,
        formId: form.id,
        formTitle: form.title || '',
        formStatus: form.status || 'draft',
        draftSchema: schema || [],
        isDirty: false,
        schemaHistoryPast: [],
        schemaHistoryFuture: [],
        validationErrors: [],
        error: null,
      };
    }

    // ------------------------------------------------------------------------
    // EDIT_SCHEMA
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.EDIT_SCHEMA: {
      const nextState = BUILDER_STATES.DIRTY;

      const nextSchema = action.payload?.schema;
      if (!nextSchema) {
        return state;
      }

      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      // If the schema reference is unchanged, treat this as a "mark dirty" and
      // avoid polluting history (e.g. markDirty dispatches existing draftSchema).
      if (nextSchema === state.draftSchema) {
        return {
          ...state,
          state: nextState,
          isDirty: true,
          validationErrors: [],
          autoSaveError: null,
        };
      }

      /**
       * HISTORY BATCHING STRATEGY:
       *
       * High-frequency operations (drag/reorder) can create dozens of history
       * entries in seconds. To prevent history spam while preserving undo/redo UX:
       *
       * 1. IMMEDIATE UPDATE: Always update draftSchema immediately for real-time UI
       * 2. BATCHING: Defer committing to history during rapid changes
       * 3. COMMIT-ON-QUIET: After HISTORY_BATCH_WINDOW_MS of quiet, commit the
       *    final state as a single history entry
       *
       * This gives users smooth drag experience while keeping history clean.
       * Manual edits (typing, etc.) naturally have pauses, so they commit normally.
       */

      const past = Array.isArray(state.schemaHistoryPast) ? state.schemaHistoryPast : [];
      const isFirstEdit = past.length === 0 && !state.draftSchema;

      // For first edit or if batching is disabled, commit immediately to history
      if (isFirstEdit || action.payload?.skipBatching) {
        const nextPast = state.draftSchema
          ? [...past, state.draftSchema].slice(-MAX_HISTORY_LENGTH)
          : past;

        return {
          ...state,
          state: nextState,
          draftSchema: nextSchema,
          isDirty: true,
          schemaHistoryPast: nextPast,
          schemaHistoryFuture: [],
          validationErrors: [],
          autoSaveError: null,
          historyBatchTimer: null,
          historyBatchPendingSchema: null,
        };
      }

      // BATCHING ACTIVE: Update current schema but defer history commit
      // The pending schema will be committed when the batch window expires
      return {
        ...state,
        state: nextState,
        draftSchema: nextSchema,
        isDirty: true,
        historyBatchPendingSchema: nextSchema,
        // Track the schema before the batch started (for undo point)
        // Only set this on the FIRST edit in a batch
        historyBatchStartSchema: state.historyBatchStartSchema || state.draftSchema,
        // Keep existing history unchanged during batch
        // Clear validation errors as schema changed
        validationErrors: [],
        autoSaveError: null,
      };
    }

    // ------------------------------------------------------------------------
    // COMMIT_HISTORY_BATCH
    // Commits the pending batched schema to history.
    // Called after HISTORY_BATCH_WINDOW_MS of no edits.
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.COMMIT_HISTORY_BATCH: {
      // If there's no pending schema or no start schema tracked, nothing to commit
      if (!state.historyBatchStartSchema) {
        return {
          ...state,
          historyBatchTimer: null,
          historyBatchPendingSchema: null,
        };
      }

      const past = Array.isArray(state.schemaHistoryPast) ? state.schemaHistoryPast : [];

      /**
       * BATCH COMMIT LOGIC:
       * During a batch (e.g., dragging), we tracked:
       * - historyBatchStartSchema: The schema before the batch started
       * - draftSchema: Updated in real-time as user dragged
       *
       * Now we commit: Add the START schema to history as a single undo point.
       * This lets users undo the entire drag sequence in one step.
       */
      const nextPast = [...past, state.historyBatchStartSchema].slice(-MAX_HISTORY_LENGTH);

      return {
        ...state,
        schemaHistoryPast: nextPast,
        schemaHistoryFuture: [], // Clear redo on new commit
        historyBatchTimer: null,
        historyBatchPendingSchema: null,
        historyBatchStartSchema: null,
      };
    }

    // ------------------------------------------------------------------------
    // UNDO_SCHEMA (TASK 6.4)
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.UNDO_SCHEMA: {
      const past = Array.isArray(state.schemaHistoryPast) ? state.schemaHistoryPast : [];

      if (past.length === 0) {
        return state;
      }

      const nextState = BUILDER_STATES.DIRTY;
      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      const previousSchema = past[past.length - 1];
      const nextPast = past.slice(0, -1);
      const future = Array.isArray(state.schemaHistoryFuture) ? state.schemaHistoryFuture : [];
      const nextFuture = state.draftSchema ? [state.draftSchema, ...future] : future;

      return {
        ...state,
        state: nextState,
        draftSchema: previousSchema,
        isDirty: true,
        schemaHistoryPast: nextPast,
        schemaHistoryFuture: nextFuture,
        validationErrors: [],
        autoSaveError: null,
        // Clear any pending batch on undo
        historyBatchTimer: null,
        historyBatchPendingSchema: null,
        historyBatchStartSchema: null,
      };
    }

    // ------------------------------------------------------------------------
    // REDO_SCHEMA (TASK 6.4)
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.REDO_SCHEMA: {
      const future = Array.isArray(state.schemaHistoryFuture) ? state.schemaHistoryFuture : [];

      if (future.length === 0) {
        return state;
      }

      const nextState = BUILDER_STATES.DIRTY;
      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      const nextSchema = future[0];
      const nextFuture = future.slice(1);
      const past = Array.isArray(state.schemaHistoryPast) ? state.schemaHistoryPast : [];
      const nextPast = state.draftSchema
        ? [...past, state.draftSchema].slice(-MAX_HISTORY_LENGTH)
        : past;

      return {
        ...state,
        state: nextState,
        draftSchema: nextSchema,
        isDirty: true,
        schemaHistoryPast: nextPast,
        schemaHistoryFuture: nextFuture,
        validationErrors: [],
        autoSaveError: null,
        // Clear any pending batch on redo
        historyBatchTimer: null,
        historyBatchPendingSchema: null,
        historyBatchStartSchema: null,
      };
    }

    // ------------------------------------------------------------------------
    // SET_VALIDATION_ERRORS (TASK 5.5)
    // Does not change FSM state; used to show validation issues while keeping
    // autosave and editing flow intact.
    // Supports both form-level errors and field-level errors.
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.SET_VALIDATION_ERRORS: {
      const nextErrors = Array.isArray(action.payload?.validationErrors)
        ? action.payload.validationErrors
        : [];
      
      // Extract field-level errors from payload
      const nextFieldErrors = action.payload?.fieldErrors || {};

      return {
        ...state,
        validationErrors: nextErrors,
        fieldErrors: nextFieldErrors,
        saveError: null,
        isRateLimited: false,
        hasConflict: false,
      };
    }

    // ------------------------------------------------------------------------
    // START_AUTOSAVE
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.START_AUTOSAVE: {
      const nextState = BUILDER_STATES.AUTOSAVING;

      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      return {
        ...state,
        state: nextState,
        autoSaving: true,
        autoSaveError: null,
      };
    }

    // ------------------------------------------------------------------------
    // AUTOSAVE_SUCCESS
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.AUTOSAVE_SUCCESS: {
      // If user edited during autosave, stay DIRTY
      const nextState = action.payload?.stillDirty ? BUILDER_STATES.DIRTY : BUILDER_STATES.SAVED;

      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      return {
        ...state,
        state: nextState,
        autoSaving: false,
        isDirty: action.payload?.stillDirty || false,
        lastAutoSaveTime: Date.now(),
        autoSaveError: null,
      };
    }

    // ------------------------------------------------------------------------
    // AUTOSAVE_ERROR
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.AUTOSAVE_ERROR: {
      // Task 5.6: Autosave failure must keep builder recoverable and DIRTY.
      // If we were autosaving, return to DIRTY; otherwise keep current state.
      const nextState =
        state.state === BUILDER_STATES.AUTOSAVING ? BUILDER_STATES.DIRTY : state.state;

      if (nextState !== state.state) {
        if (!validateTransition(state.state, nextState, action.type)) {
          return state;
        }
      }
      
      const error = action.payload.error;

      return {
        ...state,
        state: nextState,
        autoSaving: false,
        autoSaveError: error,
        isDirty: true,
        // Set rate limit state if error is rate limited
        isRateLimited: error?.isRateLimited || false,
        rateLimitRetryAfter: error?.retryAfter || null,
        // Set field errors if validation error
        fieldErrors: error?.fields || state.fieldErrors,
        validationErrors: error?.isValidationError ? [error.message] : state.validationErrors,
      };
    }

    // ------------------------------------------------------------------------
    // START_PUBLISH
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.START_PUBLISH: {
      const nextState = BUILDER_STATES.PUBLISHING;

      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      return {
        ...state,
        state: nextState,
        publishing: true,
        saving: true,
        saveError: null,
        validationErrors: [],
      };
    }

    // ------------------------------------------------------------------------
    // PUBLISH_SUCCESS
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.PUBLISH_SUCCESS: {
      const nextState = BUILDER_STATES.PUBLISHED;

      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      return {
        ...state,
        state: nextState,
        publishing: false,
        saving: false,
        formStatus: 'published',
        isDirty: false,
        lastSaveTime: Date.now(),
        saveError: null,
        validationErrors: [],
      };
    }

    // ------------------------------------------------------------------------
    // PUBLISH_ERROR
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.PUBLISH_ERROR: {
      const error = action.payload?.error;
      const hasValidationErrors =
        Array.isArray(action.payload?.validationErrors) &&
        action.payload.validationErrors.length > 0;

      // Task 5.6: Publish/save failures should return to a stable state.
      // Only adjust state if we were in PUBLISHING; otherwise keep current.
      const stableState = state.isDirty ? BUILDER_STATES.DIRTY : BUILDER_STATES.SAVED;
      const nextState = state.state === BUILDER_STATES.PUBLISHING ? stableState : state.state;

      if (nextState !== state.state) {
        if (!validateTransition(state.state, nextState, action.type)) {
          return state;
        }
      }

      return {
        ...state,
        state: nextState,
        publishing: false,
        saving: false,
        saveError: hasValidationErrors ? null : error,
        validationErrors: hasValidationErrors
          ? action.payload.validationErrors
          : state.validationErrors,
        // Set field errors from validation error
        fieldErrors: error?.fields || {},
        // Set rate limit state
        isRateLimited: error?.isRateLimited || false,
        rateLimitRetryAfter: error?.retryAfter || null,
        // Set conflict state for optimistic locking
        hasConflict: error?.isConflict || false,
        conflictData: error?.isConflict ? {
          currentETag: error.currentETag,
          providedIfMatch: error.providedIfMatch,
        } : null,
      };
    }

    // ------------------------------------------------------------------------
    // OPEN_PREVIEW (TASK 5.4)
    // Preview uses draft schema from state, never fetches active schema
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.OPEN_PREVIEW: {
      const nextState = BUILDER_STATES.PREVIEWING;

      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      return {
        ...state,
        state: nextState,
        previewing: true,
      };
    }

    // ------------------------------------------------------------------------
    // CLOSE_PREVIEW (TASK 5.4)
    // Returns to DIRTY if unsaved changes, otherwise EDITING
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.CLOSE_PREVIEW: {
      // Return to previous state (EDITING or DIRTY)
      const nextState = state.isDirty ? BUILDER_STATES.DIRTY : BUILDER_STATES.EDITING;

      if (!validateTransition(state.state, nextState, action.type)) {
        return state;
      }

      return {
        ...state,
        state: nextState,
        previewing: false,
      };
    }

    // ------------------------------------------------------------------------
    // DISMISS_ERROR
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.DISMISS_ERROR: {
      // Task 5.6: Dismissing should never corrupt state.
      // If we're already in a stable state, keep it and just clear errors.
      const nextState =
        state.state === BUILDER_STATES.ERROR
          ? state.isDirty
            ? BUILDER_STATES.DIRTY
            : state.autoSaveError
            ? BUILDER_STATES.EDITING
            : BUILDER_STATES.SAVED
          : state.state;

      if (nextState !== state.state) {
        if (!validateTransition(state.state, nextState, action.type)) {
          return state;
        }
      }

      return {
        ...state,
        state: nextState,
        error: null,
        saveError: null,
        autoSaveError: null,
        validationErrors: [],
        fieldErrors: {},
        isRateLimited: false,
        rateLimitRetryAfter: null,
        hasConflict: false,
        conflictData: null,
      };
    }

    // ------------------------------------------------------------------------
    // CLOSE_BUILDER
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.CLOSE_BUILDER: {
      // Special case: doesn't enforce FSM transitions (exit state)
      return state;
    }

    // ------------------------------------------------------------------------
    // Unknown action
    // ------------------------------------------------------------------------
    default: {
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`[FSM] Unknown action type: ${action.type}`);
      }
      // Production: Silently ignore unknown actions
      return state;
    }
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useBuilderReducer(initialFormId = null) {
  const [state, dispatch] = useReducer(builderReducer, {
    ...initialBuilderState,
    formId: initialFormId,
    loading: !!initialFormId,
  });

  return [state, dispatch];
}

// Named export for unit tests
export { builderReducer };

export default useBuilderReducer;
