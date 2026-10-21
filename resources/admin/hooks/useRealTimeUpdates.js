import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { apiClient } from '../data';
import { applyChanges, normalizeCounts, emptyCounts } from '../utils/tabCounts';

/**
 * Custom hook for real-time updates of submission counts and data
 *
 * @param {Object} options - Configuration options
 * @param {number} options.pollInterval - Polling interval in milliseconds (default: 30000 = 30s)
 * @param {boolean} options.enabled - Whether polling is enabled (default: true)
 * @param {Function} options.onUnreadCountChange - Callback when unread count changes
 * @param {Function} options.onSubmissionsUpdate - Callback for submissions list updates
 */
export function useRealTimeUpdates(options = {}) {
  const {
    pollInterval = 30000, // 30 seconds default
    enabled = true,
    formId = null,
    onUnreadCountChange,
    onSubmissionsUpdate,
  } = options;

  const [counts, setCounts] = useState(emptyCounts);
  const unreadCount = counts.unread;
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef(null);
  const lastUnreadCountRef = useRef(null);
  // Counts change in the browser (an entry is trashed) while a poll is on its
  // way. The poll's answer is older than the change, so it is dropped.
  const changeVersionRef = useRef(0);
  const countsRef = useRef(counts);
  countsRef.current = counts;

  // Store callbacks in refs to prevent dependency changes
  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  const onSubmissionsUpdateRef = useRef(onSubmissionsUpdate);

  // Update refs when callbacks change
  useEffect(() => {
    onUnreadCountChangeRef.current = onUnreadCountChange;
    onSubmissionsUpdateRef.current = onSubmissionsUpdate;
  }, [onUnreadCountChange, onSubmissionsUpdate]);

  // A different form is a different baseline.
  useEffect(() => {
    lastUnreadCountRef.current = null;
  }, [formId]);

  /**
   * Fetch the count of every tab (one request). `silent` is for a refresh
   * after a change made in this browser: the list already shows it, so the
   * list is not loaded again.
   */
  const fetchUnreadCount = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return;

    try {
      setIsPolling(true);

      const version = changeVersionRef.current;
      const formQuery = formId ? `?form_id=${encodeURIComponent(formId)}` : '';
      const data = await apiClient.get(`/submissions/unread-count${formQuery}`);
      if (version !== changeVersionRef.current) {
        return;
      }
      const nextCounts = normalizeCounts(
        data.counts || { unread: data.count || 0 }
      );
      const newCount = nextCounts.unread;

      setCounts(nextCounts);
      setLastUpdate(new Date(data.timestamp || Date.now()));

      if (silent) {
        lastUnreadCountRef.current = newCount;
        return;
      }

      // The first answer only sets the baseline: the list has just loaded
      // itself, and a second load could undo a change made meanwhile (2.3.3).
      if (lastUnreadCountRef.current === null) {
        lastUnreadCountRef.current = newCount;
        return;
      }

      // Trigger callback if count changed
      if (newCount !== lastUnreadCountRef.current) {
        const previousCount = lastUnreadCountRef.current;
        lastUnreadCountRef.current = newCount;

        if (onUnreadCountChangeRef.current) {
          onUnreadCountChangeRef.current(newCount, previousCount);
        }

        // Refresh submissions list on any count change:
        // increase = new submission arrived, decrease = submission was read/deleted
        if (onSubmissionsUpdateRef.current) {
          onSubmissionsUpdateRef.current();
        }
      }
    } catch (error) {
      console.warn('Failed to fetch unread count:', error);
    } finally {
      setIsPolling(false);
    }
  }, [enabled, formId]);

  const startPolling = useCallback(() => {
    if (!enabled || intervalRef.current) return;

    // Fetch immediately
    fetchUnreadCount();

    // Start interval
    intervalRef.current = setInterval(() => {
      fetchUnreadCount();
    }, pollInterval);
  }, [enabled, pollInterval, fetchUnreadCount]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const forceUpdate = useCallback(() => {
    fetchUnreadCount({ silent: true });
  }, [fetchUnreadCount]);

  // Setup and cleanup polling
  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling]);

  // Handle visibility change to pause/resume polling
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, startPolling, stopPolling]);

  /**
   * Move the tab counts at once for entries changed in this browser, then
   * ask the server for the true numbers.
   *
   * @param {Array<{before: Object|null, after: Object|null}>} changes Entry
   *   states before and after each change.
   */
  const adjustCounts = useCallback(
    (changes) => {
      if (!Array.isArray(changes)) {
        return;
      }
      if (changes.length === 0) {
        // Nothing to estimate (a failed action): ask for the true numbers.
        fetchUnreadCount({ silent: true });
        return;
      }
      changeVersionRef.current += 1;
      const next = applyChanges(countsRef.current, changes);
      countsRef.current = next;
      lastUnreadCountRef.current = next.unread;
      setCounts(next);
      fetchUnreadCount({ silent: true });
    },
    [fetchUnreadCount]
  );

  return {
    unreadCount,
    counts,
    adjustCounts,
    lastUpdate,
    isPolling,
    forceUpdate,
    startPolling,
    stopPolling,
  };
}

export default useRealTimeUpdates;
