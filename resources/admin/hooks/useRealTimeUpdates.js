import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { apiClient } from '../data';

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

  const [unreadCount, setUnreadCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef(null);
  const lastUnreadCountRef = useRef(null);

  // Store callbacks in refs to prevent dependency changes
  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  const onSubmissionsUpdateRef = useRef(onSubmissionsUpdate);

  // Update refs when callbacks change
  useEffect(() => {
    onUnreadCountChangeRef.current = onUnreadCountChange;
    onSubmissionsUpdateRef.current = onSubmissionsUpdate;
  }, [onUnreadCountChange, onSubmissionsUpdate]);

  const fetchUnreadCount = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsPolling(true);

      const formQuery = formId ? `?form_id=${encodeURIComponent(formId)}` : '';
      const data = await apiClient.get(`/submissions/unread-count${formQuery}`);
      const newCount = data.count || 0;

      setUnreadCount(newCount);
      setLastUpdate(new Date(data.timestamp || Date.now()));

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
    fetchUnreadCount();
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

  const adjustUnread = useCallback((delta) => {
    setUnreadCount((count) => Math.max(0, Number(count) + Number(delta)));
  }, []);

  return {
    unreadCount,
    adjustUnread,
    lastUpdate,
    isPolling,
    forceUpdate,
    startPolling,
    stopPolling,
  };
}

export default useRealTimeUpdates;
