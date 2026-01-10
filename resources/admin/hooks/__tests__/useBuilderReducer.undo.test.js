import {
  builderReducer,
  BUILDER_ACTIONS,
  BUILDER_STATES,
  initialBuilderState,
} from '../useBuilderReducer';

describe('useBuilderReducer Undo/Redo Edge Cases', () => {
  const createSchema = (id) => ({ metadata: { title: `Schema ${id}` }, fields: [] });

  it('should respect MAX_HISTORY_LENGTH', () => {
    // Create state with max history
    const history = Array.from({ length: 60 }, (_, i) => createSchema(i));
    const currentSchema = createSchema('current');

    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.EDITING,
      draftSchema: currentSchema,
      schemaHistoryPast: history,
      schemaHistoryFuture: [],
    };

    // Perform one more edit
    const newSchema = createSchema('new');
    const nextState = builderReducer(state, {
      type: BUILDER_ACTIONS.EDIT_SCHEMA,
      payload: { schema: newSchema, skipBatching: true },
    });

    // Should have capped history at 50 (default)
    expect(nextState.schemaHistoryPast.length).toBe(50);
    // The oldest should be removed (index 10 from original 60, since we added one more, so 61 total, keep last 50)
    // Actually, if we start with 60, and add 1, we have 61. We keep 50.
    // The one we just added is now current, so the previous current is at end of history.
    expect(nextState.schemaHistoryPast[49]).toEqual(currentSchema);
  });

  it('should clear redo stack on new edit', () => {
    const past = [createSchema(1)];
    const future = [createSchema(3)];
    const current = createSchema(2);

    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.EDITING,
      draftSchema: current,
      schemaHistoryPast: past,
      schemaHistoryFuture: future,
    };

    const nextState = builderReducer(state, {
      type: BUILDER_ACTIONS.EDIT_SCHEMA,
      payload: { schema: createSchema(4), skipBatching: true },
    });

    expect(nextState.schemaHistoryFuture).toHaveLength(0);
    expect(nextState.schemaHistoryPast).toHaveLength(2); // 1 and 2
  });

  it('should handle undo when history is empty', () => {
    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.EDITING,
      draftSchema: createSchema(1),
      schemaHistoryPast: [],
    };

    const nextState = builderReducer(state, {
      type: BUILDER_ACTIONS.UNDO_SCHEMA,
    });

    // Should remain unchanged or just not crash
    expect(nextState.draftSchema).toEqual(createSchema(1));
    expect(nextState.schemaHistoryPast).toHaveLength(0);
  });

  it('should handle redo when future is empty', () => {
    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.EDITING,
      draftSchema: createSchema(1),
      schemaHistoryFuture: [],
    };

    const nextState = builderReducer(state, {
      type: BUILDER_ACTIONS.REDO_SCHEMA,
    });

    expect(nextState.draftSchema).toEqual(createSchema(1));
  });

  describe('History Batching', () => {
    it('should commit pending batch on COMMIT_HISTORY_BATCH', () => {
      const startSchema = createSchema('start');
      const pendingSchema = createSchema('pending');

      const state = {
        ...initialBuilderState,
        state: BUILDER_STATES.EDITING,
        draftSchema: pendingSchema,
        historyBatchStartSchema: startSchema,
        historyBatchPendingSchema: pendingSchema,
        schemaHistoryPast: [],
      };

      const nextState = builderReducer(state, {
        type: BUILDER_ACTIONS.COMMIT_HISTORY_BATCH,
      });

      expect(nextState.historyBatchStartSchema).toBeNull();
      expect(nextState.historyBatchPendingSchema).toBeNull();
      expect(nextState.schemaHistoryPast).toHaveLength(1);
      expect(nextState.schemaHistoryPast[0]).toEqual(startSchema);
    });

    it('should not commit if no batch is pending', () => {
      const state = {
        ...initialBuilderState,
        historyBatchStartSchema: null,
        schemaHistoryPast: [],
      };

      const nextState = builderReducer(state, {
        type: BUILDER_ACTIONS.COMMIT_HISTORY_BATCH,
      });

      expect(nextState.schemaHistoryPast).toHaveLength(0);
    });
  });
});
