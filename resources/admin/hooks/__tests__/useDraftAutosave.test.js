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

    // Fast-forward debounce time (500ms)
    jest.advanceTimersByTime(500);

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

    jest.advanceTimersByTime(500);

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

    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: BUILDER_ACTIONS.AUTOSAVE_ERROR,
      payload: { error: 'Error' },
    });
  });

  it('should retry on failure', async () => {
    apiPost.mockResolvedValue({ ok: false });

    renderHook(() => useDraftAutosave(defaultProps));

    // First attempt
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(apiPost).toHaveBeenCalledTimes(1);

    // Retry delay (2000ms)
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(apiPost).toHaveBeenCalledTimes(2);
  });
});
