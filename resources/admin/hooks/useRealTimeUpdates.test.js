/**
 * Tab counts: one request on load, moved at once when an entry changes,
 * replaced by the server's numbers right after, and a poll that was already
 * on its way when the change happened does not undo it.
 */
import { renderHook, act } from '@testing-library/react-hooks';
import useRealTimeUpdates from './useRealTimeUpdates';

jest.mock('../data', () => ({ apiClient: { get: jest.fn() } }));
const { apiClient } = require('../data');

const serverCounts = (over = {}) => ({
  all: 10, unread: 4, read: 6, spam: 2, starred: 3, flagged: 1, trash: 5, ...over,
});
const answer = (counts) => ({ count: counts.unread, counts, timestamp: '2026-10-21 10:00:00' });
const entry = (over = {}) => ({ status: 'completed', is_read: 0, starred: 0, ...over });

const flush = () => act(async () => { await Promise.resolve(); });

describe('useRealTimeUpdates counts', () => {
  beforeEach(() => {
    apiClient.get.mockReset();
  });

  test('loads every tab count with one request', async () => {
    apiClient.get.mockResolvedValue(answer(serverCounts()));
    const { result } = renderHook(() => useRealTimeUpdates({ pollInterval: 600000 }));
    await flush();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get.mock.calls[0][0]).toBe('/submissions/unread-count');
    expect(result.current.counts).toEqual(serverCounts());
    expect(result.current.unreadCount).toBe(4);
  });

  test('a form filter is sent with the request', async () => {
    apiClient.get.mockResolvedValue(answer(serverCounts()));
    renderHook(() => useRealTimeUpdates({ pollInterval: 600000, formId: 9 }));
    await flush();
    expect(apiClient.get.mock.calls[0][0]).toBe('/submissions/unread-count?form_id=9');
  });

  test('trashing an entry moves the counts at once, then the server answer replaces them', async () => {
    apiClient.get.mockResolvedValueOnce(answer(serverCounts()));
    const { result } = renderHook(() => useRealTimeUpdates({ pollInterval: 600000 }));
    await flush();

    let resolveRefresh;
    apiClient.get.mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    const before = entry({ starred: 1 });
    act(() => {
      result.current.adjustCounts([{ before, after: { ...before, status: 'trash' } }]);
    });
    // At once, before the server has answered.
    expect(result.current.counts).toEqual(serverCounts({ all: 9, unread: 3, starred: 2, trash: 6 }));

    await act(async () => {
      resolveRefresh(answer(serverCounts({ all: 9, unread: 3, starred: 2, trash: 6, spam: 7 })));
    });
    expect(result.current.counts.spam).toBe(7);
  });

  test('a poll started before the change is dropped, so it cannot undo the change', async () => {
    apiClient.get.mockResolvedValueOnce(answer(serverCounts()));
    const { result } = renderHook(() => useRealTimeUpdates({ pollInterval: 600000 }));
    await flush();

    let resolveStale;
    apiClient.get.mockImplementationOnce(() => new Promise((resolve) => { resolveStale = resolve; }));
    act(() => {
      result.current.forceUpdate();
    });
    // The change happens while that request is in flight.
    apiClient.get.mockResolvedValueOnce(answer(serverCounts({ unread: 3, read: 7 })));
    act(() => {
      result.current.adjustCounts([{ before: entry(), after: entry({ is_read: 1 }) }]);
    });
    await flush();
    expect(result.current.counts.unread).toBe(3);

    await act(async () => {
      resolveStale(answer(serverCounts())); // old numbers, unread 4
    });
    expect(result.current.counts.unread).toBe(3);
  });

  test('a failed action asks the server for the true numbers', async () => {
    apiClient.get.mockResolvedValue(answer(serverCounts()));
    const { result } = renderHook(() => useRealTimeUpdates({ pollInterval: 600000 }));
    await flush();
    apiClient.get.mockClear();
    act(() => {
      result.current.adjustCounts([]);
    });
    await flush();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });

  test('a change made here does not reload the list', async () => {
    apiClient.get.mockResolvedValueOnce(answer(serverCounts()));
    const onSubmissionsUpdate = jest.fn();
    const { result } = renderHook(() => useRealTimeUpdates({ pollInterval: 600000, onSubmissionsUpdate }));
    await flush();
    apiClient.get.mockResolvedValueOnce(answer(serverCounts({ unread: 3, read: 7 })));
    act(() => {
      result.current.adjustCounts([{ before: entry(), after: entry({ is_read: 1 }) }]);
    });
    await flush();
    expect(onSubmissionsUpdate).not.toHaveBeenCalled();
  });
});
