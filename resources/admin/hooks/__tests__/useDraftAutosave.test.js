import { renderHook } from '@testing-library/react-hooks';
import { useDraftAutosave } from '../useDraftAutosave';
import { BUILDER_STATES, BUILDER_ACTIONS } from '../useBuilderReducer';
import { apiPost } from '../../utils/api';

jest.mock('../../utils/api', () => ({
  apiPost: jest.fn(),
}));

describe('useDraftAutosave', () => {
  let mockDispatch;
  let defaultProps;

  beforeEach(() => {
    jest.useFakeTimers();
    mockDispatch = jest.fn();
    apiPost.mockReset();
    apiPost.mockResolvedValue({ ok: true, body: { success: true } });

    defaultProps = {
      builderState: {
        state: BUILDER_STATES.DIRTY,
        draftSchema: { some: 'schema' },
        isDirty: true,
      },
      dispatch: mockDispatch,
      formId: 123,
      enabled: true,
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should autosave after debounce when dirty', () => {
    renderHook(() => useDraftAutosave(defaultProps));

    // Should not save immediately
    expect(apiPost).not.toHaveBeenCalled();

    // Fast-forward debounce time (30000ms matches AUTOSAVE_DEBOUNCE_MS in useDraftAutosave.js, Part B21)
    jest.advanceTimersByTime(30000);

    expect(mockDispatch).toHaveBeenCalledWith({ type: BUILDER_ACTIONS.START_AUTOSAVE });
    expect(apiPost).toHaveBeenCalledWith('/forms/123/schema', {
      schema: { some: 'schema' },
      activate: false,
    });
  });

  it('should not autosave if not dirty', () => {
    const props = {
      ...defaultProps,
      builderState: {
        ...defaultProps.builderState,
        state: BUILDER_STATES.EDITING,
        isDirty: false,
      },
    };

    renderHook(() => useDraftAutosave(props));

    jest.advanceTimersByTime(1000);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('should handle save success', async () => {
    const { waitForNextUpdate } = renderHook(() => useDraftAutosave(defaultProps));

    jest.advanceTimersByTime(30000);

    // Wait for the promise to resolve
    await Promise.resolve();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
      payload: { stillDirty: false },
    });
  });

  it('should handle save error', async () => {
    apiPost.mockResolvedValue({ ok: false, body: { message: 'Error' } });

    renderHook(() => useDraftAutosave(defaultProps));

    jest.advanceTimersByTime(30000);
    await Promise.resolve();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: BUILDER_ACTIONS.AUTOSAVE_ERROR,
      payload: { error: 'Error' },
    });
  });

  it('should retry on failure', async () => {
    apiPost.mockResolvedValue({ ok: false });

    renderHook(() => useDraftAutosave(defaultProps));

    // First attempt, debounce is AUTOSAVE_DEBOUNCE_MS = 30000ms (Part B21)
    jest.advanceTimersByTime(30000);
    await Promise.resolve();
    expect(apiPost).toHaveBeenCalledTimes(1);

    // Retry delay, AUTOSAVE_RETRY_DELAY_MS * retryCount = 5000 * 1 = 5000ms
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(apiPost).toHaveBeenCalledTimes(2);
  });
  it('uses the settings interval instead of 30 seconds', () => {
    renderHook(() => useDraftAutosave({ ...defaultProps, intervalSeconds: 3 }));
    jest.advanceTimersByTime(2999);
    expect(apiPost).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(apiPost).toHaveBeenCalled();
  });

  it('does not autosave when autosave is off', () => {
    renderHook(() => useDraftAutosave({ ...defaultProps, enabled: false }));
    jest.advanceTimersByTime(30000);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('reports a 409 as a conflict, does not retry, and stays paused until it is answered (#145)', async () => {
    apiPost.mockResolvedValue({
      ok: false,
      status: 409,
      body: { error: { code: 'version_conflict', meta: { current_etag: 'W/"theirs"' } } },
    });
    const { rerender } = renderHook((props) => useDraftAutosave(props), {
      initialProps: defaultProps,
    });

    await jest.advanceTimersByTimeAsync(30000);

    const errors = mockDispatch.mock.calls.filter(
      ([a]) => a.type === BUILDER_ACTIONS.AUTOSAVE_ERROR
    );
    expect(errors).toHaveLength(1);
    expect(errors[0][0].payload.error).toMatchObject({ isConflict: true, currentETag: 'W/"theirs"' });

    // No retry while the question is open.
    await jest.advanceTimersByTimeAsync(60000);
    expect(apiPost).toHaveBeenCalledTimes(1);

    rerender({
      ...defaultProps,
      builderState: { ...defaultProps.builderState, hasConflict: true },
    });
    await jest.advanceTimersByTimeAsync(60000);
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});
