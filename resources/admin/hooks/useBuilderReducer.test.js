import {
  BUILDER_ACTIONS,
  BUILDER_STATES,
  initialBuilderState,
  builderReducer,
} from './useBuilderReducer';

describe('useBuilderReducer undo/redo', () => {
  test('EDIT_SCHEMA records past and clears future', () => {
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
      payload: { schema: s2 },
    });

    expect(next.draftSchema).toBe(s2);
    expect(next.schemaHistoryPast).toEqual([s1]);
    expect(next.schemaHistoryFuture).toEqual([]);
    expect(next.isDirty).toBe(true);
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
