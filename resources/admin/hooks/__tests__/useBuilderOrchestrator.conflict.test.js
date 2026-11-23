/**
 * Free #145: a save refused with 409 opens the conflict state, and "Replace
 * with my changes" sends the same save again without the version check.
 */
import { renderHook, act } from '@testing-library/react-hooks';
import useBuilderOrchestrator from '../useBuilderOrchestrator';
import { BUILDER_ACTIONS } from '../useBuilderReducer';
import { apiPost, apiPut } from '../../utils/api';

jest.mock('../../utils/api', () => ({
  apiPost: jest.fn(),
  apiPut: jest.fn(),
  apiDelete: jest.fn(),
  isValidationError: (e) => e?.status === 422,
  isRateLimitError: (e) => e?.status === 429,
  isConflictError: (e) => e?.status === 409,
  getFieldErrors: () => ({}),
}));

const conflictBody = {
  error: {
    code: 'version_conflict',
    meta: { current_etag: 'W/"theirs"', provided_if_match: 'W/"mine"' },
  },
};

const schema = { metadata: { title: 'Contact', name: 'form_schema' }, fields: [{ id: 'a', type: 'text' }] };

function setup(stateOverrides = {}) {
  const dispatch = jest.fn();
  const loadForm = jest.fn();
  const notices = {
    createSuccessNotice: jest.fn(),
    createErrorNotice: jest.fn(),
    removeNotice: jest.fn(),
    SUCCESS_NOTICE_ID: 'ok',
    ERROR_NOTICE_ID: 'err',
  };
  const initial = {
    builderState: {
      draftSchema: schema,
      formTitle: 'Contact',
      saving: false,
      autoSaving: false,
      formStatus: 'published',
      isDirty: true,
      hasUnpublishedChanges: false,
      conflictData: null,
      ...stateOverrides,
    },
    dispatch,
    formId: 5,
    currentFormId: 5,
    setCurrentFormId: jest.fn(),
    notices,
    onSaved: jest.fn(),
    navigate: jest.fn(),
    hasValidationErrors: false,
    loadForm,
  };
  const hook = renderHook((props) => useBuilderOrchestrator(props), { initialProps: initial });
  return { hook, dispatch, loadForm, notices, initial };
}

describe('builder save conflict', () => {
  beforeEach(() => {
    apiPost.mockReset();
    apiPut.mockReset();
  });

  it('turns a 409 into a conflict state instead of a snackbar', async () => {
    apiPost.mockResolvedValue({ ok: false, status: 409, body: conflictBody });
    const { hook, dispatch, notices } = setup();

    await act(async () => {
      await hook.result.current.performSave({ targetStatus: 'published' });
    });

    const call = dispatch.mock.calls.find(([a]) => a.type === BUILDER_ACTIONS.PUBLISH_ERROR);
    expect(call[0].payload.error).toMatchObject({
      isConflict: true,
      currentETag: 'W/"theirs"',
      providedIfMatch: 'W/"mine"',
    });
    expect(notices.createErrorNotice).not.toHaveBeenCalled();
  });

  it('reports an autosave 409 the same way', async () => {
    apiPost.mockResolvedValue({ ok: false, status: 409, body: conflictBody });
    const { hook, dispatch } = setup();

    await act(async () => {
      await hook.result.current.performSave({ auto: true });
    });

    const call = dispatch.mock.calls.find(([a]) => a.type === BUILDER_ACTIONS.AUTOSAVE_ERROR);
    expect(call[0].payload.error.isConflict).toBe(true);
  });

  it('opens the modal while a conflict is held and closes it on request', () => {
    const { hook, initial } = setup();
    expect(hook.result.current.showConflict).toBe(false);

    hook.rerender({
      ...initial,
      builderState: { ...initial.builderState, conflictData: { currentETag: 'x', auto: false } },
    });
    expect(hook.result.current.showConflict).toBe(true);

    act(() => hook.result.current.closeConflict());
    expect(hook.result.current.showConflict).toBe(false);
  });

  it('replace with my changes resends the save without the version check', async () => {
    apiPost.mockResolvedValue({ ok: true, status: 201, body: { data: { active: true } } });
    apiPut.mockResolvedValue({ ok: true, status: 200, body: {} });
    const { hook } = setup({
      formStatus: 'draft',
      conflictData: { currentETag: 'x', auto: false },
    });

    // The refused save was an Update that publishes.
    apiPost.mockResolvedValueOnce({ ok: false, status: 409, body: conflictBody });
    await act(async () => {
      await hook.result.current.performSave({ targetStatus: 'published' });
    });
    apiPost.mockClear();

    await act(async () => {
      await hook.result.current.replaceWithMine();
    });

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost.mock.calls[0][0]).toBe('/forms/5/schema');
    expect(apiPost.mock.calls[0][2]).toEqual({ ifMatch: false });
    expect(apiPut.mock.calls[0][0]).toBe('/forms/5');
    expect(apiPut.mock.calls[0][2]).toEqual({ ifMatch: false });
    expect(hook.result.current.showConflict).toBe(false);
  });

  it('reload latest version asks the server again and drops the modal', () => {
    const { hook, loadForm, initial } = setup();
    hook.rerender({
      ...initial,
      builderState: { ...initial.builderState, conflictData: { auto: false } },
    });

    act(() => hook.result.current.reloadLatest());

    expect(loadForm).toHaveBeenCalledWith(true);
    expect(hook.result.current.showConflict).toBe(false);
  });

  it('an ordinary save sends the version check', async () => {
    apiPost.mockResolvedValue({ ok: true, status: 200, body: {} });
    const { hook } = setup();

    await act(async () => {
      await hook.result.current.performSave({ auto: true });
    });

    expect(apiPost.mock.calls[0][2]).toEqual({});
  });
});
