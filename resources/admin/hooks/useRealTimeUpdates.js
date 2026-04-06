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
    onUnreadCountChange,
    onSubmissionsUpdate,
  } = options;

  const [unreadCount, setUnreadCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef(null);
  const lastUnreadCountRef = useRef(0);
  
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

      const data = await apiClient.get('/submissions/unread-count');
      const newCount = data.count || 0;

      setUnreadCount(newCount);
      setLastUpdate(new Date(data.timestamp || Date.now()));

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
  }, [enabled]);

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

  return {
    unreadCount,
    lastUpdate,
    isPolling,
    forceUpdate,
    startPolling,
    stopPolling,
  };
}

export default useRealTimeUpdates;
