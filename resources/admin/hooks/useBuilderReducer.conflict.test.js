import { builderReducer, BUILDER_ACTIONS } from './useBuilderReducer';

describe('conflict state (#145)', () => {
  const conflict = { message: 'Changed elsewhere', isConflict: true, currentETag: 'W/"x"' };

  it('keeps the conflict details apart from the text the header prints', () => {
    const next = builderReducer(
      { state: 'DIRTY', isDirty: true, validationErrors: [] },
      { type: BUILDER_ACTIONS.PUBLISH_ERROR, payload: { error: conflict } }
    );
    expect(next.saveError).toBe('Changed elsewhere');
    expect(next.hasConflict).toBe(true);
    expect(next.conflictData.currentETag).toBe('W/"x"');
  });

  it('an autosave conflict does the same and is marked as an autosave', () => {
    const next = builderReducer(
      { state: 'AUTOSAVING', isDirty: true, validationErrors: [], fieldErrors: {} },
      { type: BUILDER_ACTIONS.AUTOSAVE_ERROR, payload: { error: conflict } }
    );
    expect(next.autoSaveError).toBe('Changed elsewhere');
    expect(next.hasConflict).toBe(true);
    expect(next.conflictData.auto).toBe(true);
  });
});
