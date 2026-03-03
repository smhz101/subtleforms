import { useCallback, useRef } from '@wordpress/element';

/**
 * useLiveAnnounce Hook
 *
 * Provides a function to announce messages to screen readers.
 * Uses ARIA live regions for dynamic content announcements.
 *
 * @param {Object} options
 * @param {number} options.debounce - Debounce announcements (ms, default: 100)
 * @returns {Function} announce - Announce message to screen readers
 *
 * @example
 * const announce = useLiveAnnounce();
 * announce('Form saved successfully', 'polite');
 * announce('Error: Required field missing', 'assertive');
 */
export function useLiveAnnounce({ debounce = 100 } = {}) {
  const timerRef = useRef(null);
  const regionRef = useRef(null);

  const announce = useCallback(
    (message, level = 'polite') => {
      if (!message) return;

      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Debounce rapid announcements
      timerRef.current = setTimeout(() => {
        // Get or create live region
        let region = regionRef.current;

        if (!region || !document.body.contains(region)) {
          region = document.createElement('div');
          region.className = 'sf-sr-only';
          region.setAttribute('role', level === 'assertive' ? 'alert' : 'status');
          region.setAttribute('aria-live', level);
          region.setAttribute('aria-atomic', 'true');
          document.body.appendChild(region);
          regionRef.current = region;
        }

        // Clear existing content first to ensure announcement
        region.textContent = '';

        // Small delay to ensure screen readers detect the change
        setTimeout(() => {
          region.textContent = message;
        }, 50);

        // Clean up after announcement
        setTimeout(() => {
          if (region && document.body.contains(region)) {
            region.textContent = '';
          }
        }, 3000);
      }, debounce);
    },
    [debounce]
  );

  return announce;
}

/**
 * useAnnouncementQueue Hook
 *
 * Manages a queue of announcements to prevent overlapping.
 * Useful for rapid updates like validation errors.
 *
 * @param {Object} options
 * @param {number} options.delay - Delay between announcements (ms, default: 500)
 * @returns {Object} { announce, clear }
 *
 * @example
 * const { announce, clear } = useAnnouncementQueue();
 * announce('Field 1 error', 'assertive');
 * announce('Field 2 error', 'assertive');
 * // Announcements queue and play sequentially
 */
export function useAnnouncementQueue({ delay = 500 } = {}) {
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const announce = useLiveAnnounce();

  const processQueue = useCallback(() => {
    if (processingRef.current || queueRef.current.length === 0) {
      return;
    }

    processingRef.current = true;
    const { message, level } = queueRef.current.shift();

    announce(message, level);

    setTimeout(() => {
      processingRef.current = false;
      processQueue();
    }, delay);
  }, [announce, delay]);

  const queueAnnouncement = useCallback(
    (message, level = 'polite') => {
      queueRef.current.push({ message, level });
      processQueue();
    },
    [processQueue]
  );

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    processingRef.current = false;
  }, []);

  return {
    announce: queueAnnouncement,
    clear: clearQueue,
  };
}

/**
 * Helper function to announce page navigation
 * Announces route changes for single-page applications
 */
export function announceNavigation(pageName, announce) {
  if (announce && typeof announce === 'function') {
    announce(`Navigated to ${pageName}`, 'polite');
  }
}

/**
 * Helper function to announce form validation errors
 * Groups multiple errors into a single announcement
 */
export function announceValidationErrors(errors, announce) {
  if (!announce || !errors || errors.length === 0) return;

  const count = errors.length;
  const message =
    count === 1
      ? `${errors[0]}`
      : `Form has ${count} errors: ${errors.slice(0, 3).join(', ')}${
          count > 3 ? `, and ${count - 3} more` : ''
        }`;

  announce(message, 'assertive');
}

/**
 * Helper function to announce loading states
 */
export function announceLoading(isLoading, loadingText, announce) {
  if (!announce) return;

  if (isLoading) {
    announce(loadingText || 'Loading, please wait', 'polite');
  } else {
    announce('Loading complete', 'polite');
  }
}
