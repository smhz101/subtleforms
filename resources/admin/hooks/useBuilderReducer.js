/**
 * Builder State Machine Reducer
 *
 * Enforces FSM transitions defined in docs/builder-state-machine.md
 *
 * States: INIT, EMPTY_DRAFT, EDITING, DIRTY, AUTOSAVING, SAVED,
 *         PREVIEWING, PUBLISHING, PUBLISHED, ERROR
 *
 * @package SubtleForms
 * @version 1.3.0
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

const ALLOWED_TRANSITIONS = {
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
      console.error(errorMsg);
      console.trace('Stack trace:');
      throw new Error(errorMsg);
    } else {
      console.warn(errorMsg);
    }

    return false;
  }

  return true;
}

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

  // Task 5.5: Structured schema validation errors
  validationErrors: [],

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

  // Metadata
  lastSaveTime: null,
  lastAutoSaveTime: null,
};

// ============================================================================
// Reducer
// ============================================================================

function builderReducer(state, action) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[FSM] Action: ${action.type}`, {
      currentState: state.state,
      payload: action.payload,
    });
  }

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

      const MAX_HISTORY = 50;
      const past = Array.isArray(state.schemaHistoryPast) ? state.schemaHistoryPast : [];

      const nextPast = state.draftSchema ? [...past, state.draftSchema].slice(-MAX_HISTORY) : past;

      return {
        ...state,
        state: nextState,
        draftSchema: nextSchema,
        isDirty: true,
        schemaHistoryPast: nextPast,
        schemaHistoryFuture: [],
        // Clear previous validation results; they may be stale after edits
        validationErrors: [],
        autoSaveError: null,
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
      const MAX_HISTORY = 50;
      const nextPast = state.draftSchema ? [...past, state.draftSchema].slice(-MAX_HISTORY) : past;

      return {
        ...state,
        state: nextState,
        draftSchema: nextSchema,
        isDirty: true,
        schemaHistoryPast: nextPast,
        schemaHistoryFuture: nextFuture,
        validationErrors: [],
        autoSaveError: null,
      };
    }

    // ------------------------------------------------------------------------
    // SET_VALIDATION_ERRORS (TASK 5.5)
    // Does not change FSM state; used to show validation issues while keeping
    // autosave and editing flow intact.
    // ------------------------------------------------------------------------
    case BUILDER_ACTIONS.SET_VALIDATION_ERRORS: {
      const nextErrors = Array.isArray(action.payload?.validationErrors)
        ? action.payload.validationErrors
        : [];

      return {
        ...state,
        validationErrors: nextErrors,
        saveError: null,
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

      return {
        ...state,
        state: nextState,
        autoSaving: false,
        autoSaveError: action.payload.error,
        isDirty: true,
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
        saveError: hasValidationErrors ? null : action.payload.error,
        validationErrors: hasValidationErrors
          ? action.payload.validationErrors
          : state.validationErrors,
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
        console.warn(`[FSM] Unknown action type: ${action.type}`);
      }
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
