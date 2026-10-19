import {
  BUILDER_ACTIONS,
  BUILDER_STATES,
  initialBuilderState,
  builderReducer,
} from './useBuilderReducer';

describe('useBuilderReducer undo/redo', () => {
  test('EDIT_SCHEMA with skipBatching records past and clears future', () => {
    const s1 = { metadata: { title: 'One' }, fields: [] };
    const s2 = { metadata: { title: 'Two' }, fields: [] };

    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.EDITING,
      loading: false,
      draftSchema: s1,
      schemaHistoryPast: [],
      schemaHistoryFuture: [s2],
    };

    const next = builderReducer(state, {
      type: BUILDER_ACTIONS.EDIT_SCHEMA,
      payload: { schema: s2, skipBatching: true },
    });

    expect(next.draftSchema).toBe(s2);
    expect(next.schemaHistoryPast).toEqual([s1]);
    expect(next.schemaHistoryFuture).toEqual([]);
    expect(next.isDirty).toBe(true);
  });

  test('EDIT_SCHEMA with batching defers history commit', () => {
    const s1 = { metadata: { title: 'One' }, fields: [] };
    const s2 = { metadata: { title: 'Two' }, fields: [] };

    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.EDITING,
      loading: false,
      draftSchema: s1,
      schemaHistoryPast: [],
      schemaHistoryFuture: [],
    };

    const next = builderReducer(state, {
      type: BUILDER_ACTIONS.EDIT_SCHEMA,
      payload: { schema: s2 },
    });

    expect(next.draftSchema).toBe(s2);
    // History should NOT be updated yet (batching)
    expect(next.schemaHistoryPast).toEqual([]);
    expect(next.schemaHistoryFuture).toEqual([]);
    // Batch tracking should be active
    expect(next.historyBatchPendingSchema).toBe(s2);
    expect(next.historyBatchStartSchema).toBe(s1);
    expect(next.isDirty).toBe(true);
  });

  test('COMMIT_HISTORY_BATCH adds start schema to history', () => {
    const s1 = { metadata: { title: 'One' }, fields: [] };
    const s2 = { metadata: { title: 'Two' }, fields: [] };

    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.DIRTY,
      loading: false,
      draftSchema: s2,
      schemaHistoryPast: [],
      schemaHistoryFuture: [],
      historyBatchPendingSchema: s2,
      historyBatchStartSchema: s1,
    };

    const next = builderReducer(state, {
      type: BUILDER_ACTIONS.COMMIT_HISTORY_BATCH,
    });

    expect(next.draftSchema).toBe(s2);
    expect(next.schemaHistoryPast).toEqual([s1]);
    expect(next.schemaHistoryFuture).toEqual([]);
    expect(next.historyBatchPendingSchema).toBeNull();
    expect(next.historyBatchStartSchema).toBeNull();
  });

  test('EDIT_SCHEMA with same schema reference does not affect history', () => {
    const s1 = { metadata: { title: 'One' }, fields: [] };

    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.EDITING,
      loading: false,
      draftSchema: s1,
      schemaHistoryPast: [1, 2, 3],
      schemaHistoryFuture: [4, 5],
    };

    const next = builderReducer(state, {
      type: BUILDER_ACTIONS.EDIT_SCHEMA,
      payload: { schema: s1 },
    });

    expect(next.draftSchema).toBe(s1);
    expect(next.schemaHistoryPast).toEqual([1, 2, 3]);
    expect(next.schemaHistoryFuture).toEqual([4, 5]);
    expect(next.isDirty).toBe(true);
  });

  test('UNDO_SCHEMA moves current to future and restores previous', () => {
    const s1 = { metadata: { title: 'One' }, fields: [] };
    const s2 = { metadata: { title: 'Two' }, fields: [] };

    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.EDITING,
      loading: false,
      draftSchema: s2,
      schemaHistoryPast: [s1],
      schemaHistoryFuture: [],
    };

    const next = builderReducer(state, { type: BUILDER_ACTIONS.UNDO_SCHEMA });

    expect(next.draftSchema).toBe(s1);
    expect(next.schemaHistoryPast).toEqual([]);
    expect(next.schemaHistoryFuture).toEqual([s2]);
    expect(next.isDirty).toBe(true);
  });

  test('REDO_SCHEMA moves current to past and restores next', () => {
    const s1 = { metadata: { title: 'One' }, fields: [] };
    const s2 = { metadata: { title: 'Two' }, fields: [] };

    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.DIRTY,
      loading: false,
      draftSchema: s1,
      schemaHistoryPast: [],
      schemaHistoryFuture: [s2],
    };

    const next = builderReducer(state, { type: BUILDER_ACTIONS.REDO_SCHEMA });

    expect(next.draftSchema).toBe(s2);
    expect(next.schemaHistoryPast).toEqual([s1]);
    expect(next.schemaHistoryFuture).toEqual([]);
    expect(next.isDirty).toBe(true);
  });

  test('LOAD_SUCCESS clears history', () => {
    const state = {
      ...initialBuilderState,
      state: BUILDER_STATES.INIT,
      loading: true,
      schemaHistoryPast: [1],
      schemaHistoryFuture: [2],
    };

    const schema = { metadata: { title: 'Loaded' }, fields: [] };

    const next = builderReducer(state, {
      type: BUILDER_ACTIONS.LOAD_SUCCESS,
      payload: {
        form: { id: 123, title: 'Loaded', status: 'draft' },
        schema,
      },
    });

    expect(next.schemaHistoryPast).toEqual([]);
    expect(next.schemaHistoryFuture).toEqual([]);
  });
});

test('autosave of a published form keeps the changes off the live form', () => {
  const state = {
    ...initialBuilderState,
    state: BUILDER_STATES.AUTOSAVING,
    formStatus: 'published',
    hasUnpublishedChanges: false,
    saveError: 'The save failed.',
  };
  const next = builderReducer(state, {
    type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
    payload: { stillDirty: false },
  });
  expect(next.hasUnpublishedChanges).toBe(true);
  expect(next.saveError).toBeNull();
  expect(next.autoSaveError).toBeNull();
});

test('autosave of a draft does not mark unpublished changes', () => {
  const state = {
    ...initialBuilderState,
    state: BUILDER_STATES.AUTOSAVING,
    formStatus: 'draft',
    hasUnpublishedChanges: false,
  };
  const next = builderReducer(state, {
    type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
    payload: { stillDirty: false },
  });
  expect(next.hasUnpublishedChanges).toBe(false);
});

test('a failed load leaves the loading state with an error', () => {
  const state = { ...initialBuilderState, state: BUILDER_STATES.INIT, loading: true };
  const next = builderReducer(state, {
    type: BUILDER_ACTIONS.LOAD_ERROR,
    payload: { error: 'The form could not be loaded.' },
  });
  expect(next.loading).toBe(false);
  expect(next.state).toBe(BUILDER_STATES.ERROR);
  expect(next.error).toBe('The form could not be loaded.');
});
