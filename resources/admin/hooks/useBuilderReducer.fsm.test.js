/**
 * FSM Transition Tests
 *
 * Tests the Builder State Machine's transition rules to ensure:
 * - Development mode throws errors on invalid transitions
 * - Production mode fails safely on invalid transitions
 * - Key transition validation works correctly
 *
 * @package SubtleForms
 * @version 1.5.0
 */

import {
  BUILDER_ACTIONS,
  BUILDER_STATES,
  ALLOWED_TRANSITIONS,
  initialBuilderState,
  builderReducer,
} from './useBuilderReducer';

// Helper to create a minimal state for testing
function createTestState(currentState) {
  return {
    ...initialBuilderState,
    state: currentState,
    loading: false,
  };
}

describe('FSM Transition Validation', () => {
  describe('Development Mode - Should Throw', () => {
    test('throws on invalid transition INIT → AUTOSAVING', () => {
      const state = createTestState(BUILDER_STATES.INIT);

      if (process.env.NODE_ENV === 'development') {
        expect(() => {
          builderReducer(state, {
            type: BUILDER_ACTIONS.START_AUTOSAVE,
          });
        }).toThrow('Illegal transition: INIT → AUTOSAVING');
      } else {
        // In production, should not throw
        const nextState = builderReducer(state, {
          type: BUILDER_ACTIONS.START_AUTOSAVE,
        });
        expect(nextState.state).toBe(BUILDER_STATES.INIT); // Unchanged
      }
    });

    test('throws on invalid transition EDITING → PUBLISHING', () => {
      const state = createTestState(BUILDER_STATES.EDITING);

      if (process.env.NODE_ENV === 'development') {
        expect(() => {
          builderReducer(state, {
            type: BUILDER_ACTIONS.START_PUBLISH,
          });
        }).toThrow('Illegal transition: EDITING → PUBLISHING');
      }
    });

    test('throws on unknown action', () => {
      const state = createTestState(BUILDER_STATES.EDITING);

      if (process.env.NODE_ENV === 'development') {
        expect(() => {
          builderReducer(state, { type: 'UNKNOWN_ACTION' });
        }).toThrow('Unknown action type: UNKNOWN_ACTION');
      }
    });
  });

  describe('Valid Transitions', () => {
    test('allows INIT → EMPTY_DRAFT via LOAD_SUCCESS', () => {
      const state = createTestState(BUILDER_STATES.INIT);

      const nextState = builderReducer(state, {
        type: BUILDER_ACTIONS.LOAD_SUCCESS,
        payload: { form: { id: 1, status: 'draft' }, schema: [] },
      });

      expect(nextState.state).toBe(BUILDER_STATES.EMPTY_DRAFT);
    });

    test('allows EMPTY_DRAFT → DIRTY via EDIT_SCHEMA', () => {
      const state = createTestState(BUILDER_STATES.EMPTY_DRAFT);

      const nextState = builderReducer(state, {
        type: BUILDER_ACTIONS.EDIT_SCHEMA,
        payload: { schema: { fields: [] }, skipBatching: true },
      });

      expect(nextState.state).toBe(BUILDER_STATES.DIRTY);
    });

    test('allows DIRTY → AUTOSAVING via START_AUTOSAVE', () => {
      const state = createTestState(BUILDER_STATES.DIRTY);

      const nextState = builderReducer(state, {
        type: BUILDER_ACTIONS.START_AUTOSAVE,
      });

      expect(nextState.state).toBe(BUILDER_STATES.AUTOSAVING);
    });
  });

  describe('Special Cases', () => {
    test('INIT_BUILDER works from any state (reset mechanism)', () => {
      const states = [
        BUILDER_STATES.EDITING,
        BUILDER_STATES.DIRTY,
        BUILDER_STATES.ERROR,
        BUILDER_STATES.AUTOSAVING,
      ];

      states.forEach((startState) => {
        const state = createTestState(startState);
        const nextState = builderReducer(state, {
          type: BUILDER_ACTIONS.INIT_BUILDER,
          payload: { formId: 123 },
        });

        expect(nextState.state).toBe(BUILDER_STATES.INIT);
        expect(nextState.formId).toBe(123);
      });
    });

    test('CLOSE_BUILDER works from any state', () => {
      const state = createTestState(BUILDER_STATES.AUTOSAVING);
      const nextState = builderReducer(state, {
        type: BUILDER_ACTIONS.CLOSE_BUILDER,
      });

      // CLOSE_BUILDER returns the same state (exit action)
      expect(nextState).toBe(state);
    });
  });

  describe('Transition Table Coverage', () => {
    test('all states have defined allowed transitions', () => {
      const allStates = Object.values(BUILDER_STATES);

      allStates.forEach((state) => {
        expect(ALLOWED_TRANSITIONS[state]).toBeDefined();
        expect(Array.isArray(ALLOWED_TRANSITIONS[state])).toBe(true);
        expect(ALLOWED_TRANSITIONS[state].length).toBeGreaterThan(0);
      });
    });

    test('ERROR state has recovery transitions', () => {
      const errorTransitions = ALLOWED_TRANSITIONS[BUILDER_STATES.ERROR];

      expect(errorTransitions).toContain(BUILDER_STATES.EDITING);
      expect(errorTransitions).toContain(BUILDER_STATES.DIRTY);
      expect(errorTransitions).toContain(BUILDER_STATES.SAVED);
    });

    test('most states can transition to ERROR', () => {
      const allStates = Object.values(BUILDER_STATES);
      const statesWithErrorTransition = allStates.filter((state) =>
        ALLOWED_TRANSITIONS[state].includes(BUILDER_STATES.ERROR)
      );

      // Most states should be able to reach ERROR (for error handling)
      expect(statesWithErrorTransition.length).toBeGreaterThan(7);
    });
  });

  describe('Common Workflows', () => {
    test('new form creation flow works', () => {
      let state = createTestState(BUILDER_STATES.INIT);

      // Load empty form
      state = builderReducer(state, {
        type: BUILDER_ACTIONS.LOAD_SUCCESS,
        payload: { form: { id: 1, status: 'draft' }, schema: [] },
      });
      expect(state.state).toBe(BUILDER_STATES.EMPTY_DRAFT);

      // User adds first field
      state = builderReducer(state, {
        type: BUILDER_ACTIONS.EDIT_SCHEMA,
        payload: { schema: { fields: [{ type: 'text' }] }, skipBatching: true },
      });
      expect(state.state).toBe(BUILDER_STATES.DIRTY);

      // Autosave
      state = builderReducer(state, {
        type: BUILDER_ACTIONS.START_AUTOSAVE,
      });
      expect(state.state).toBe(BUILDER_STATES.AUTOSAVING);
    });

    test('edit existing form flow works', () => {
      let state = createTestState(BUILDER_STATES.INIT);

      // Load existing form
      state = builderReducer(state, {
        type: BUILDER_ACTIONS.LOAD_SUCCESS,
        payload: {
          form: { id: 1, status: 'draft' },
          schema: [{ type: 'text' }],
        },
      });
      expect(state.state).toBe(BUILDER_STATES.EDITING);

      // User makes changes
      state = builderReducer(state, {
        type: BUILDER_ACTIONS.EDIT_SCHEMA,
        payload: { schema: { fields: [] }, skipBatching: true },
      });
      expect(state.state).toBe(BUILDER_STATES.DIRTY);
    });
  });

  describe('No Console Logs', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    test('reducer does not log in production or development', () => {
      const state = createTestState(BUILDER_STATES.EDITING);

      builderReducer(state, {
        type: BUILDER_ACTIONS.EDIT_SCHEMA,
        payload: { schema: { fields: [] }, skipBatching: true },
      });

      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
