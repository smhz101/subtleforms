/**
 * Event Logger - Internal diagnostics
 * 
 * Lightweight event logging for debugging and UX improvement.
 * NO external analytics - respects user privacy and WordPress.org guidelines.
 * 
 * Usage Examples:
 *   import { logger } from '../diagnostics';
 *   logger.log('forms', 'fetch_start', { filter: 'published' });
 *   logger.slow('api-call', duration, 2000);
 *   logger.error('Save failed', error, { formId: 123 });
 *   logger.feature('conditional-logic', 'enabled');
 * 
 * Configuration:
 * - Can be disabled: window.subtleformsAdmin.diagnostics = false
 * - Console output only in dev mode
 * - Max 100 events in memory (prevents leaks)
 * - Exposed as window.subtleformsLogger in dev for debugging
 * 
 * @see performanceMarkers.js for timing measurements
 * @see errorContext.js for error enrichment
 */

const isDev = process.env.NODE_ENV === 'development';
const isEnabled = () => window.subtleformsAdmin?.diagnostics !== false;

/**
 * EventLogger class - Singleton pattern
 * @private - Use exported `logger` instance instead
 */
class EventLogger {
  constructor() {
    this.events = [];
    this.maxEvents = 100; // Prevent memory leaks
  }

  /**
   * Log an event (internal only)
   */
  log(category, action, meta = {}) {
    if (!isEnabled()) return;

    const event = {
      timestamp: Date.now(),
      category,
      action,
      meta,
    };

    this.events.push(event);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Console in dev mode
    if (isDev) {
      console.log(`[SubtleForms] ${category}:${action}`, meta);
    }
  }

  /**
   * Log error with context
   */
  error(message, error, context = {}) {
    this.log('error', message, {
      message: error?.message,
      stack: error?.stack,
      ...context,
    });
  }

  /**
   * Log slow operation
   */
  slow(operation, duration, threshold = 1000) {
    if (duration > threshold) {
      this.log('performance', 'slow_operation', {
        operation,
        duration,
        threshold,
      });
    }
  }

  /**
   * Log feature usage
   */
  feature(featureName, action = 'used') {
    this.log('feature', action, { feature: featureName });
  }

  /**
   * Get recent events (for debugging)
   */
  getEvents(category = null) {
    if (!isEnabled()) return [];
    
    if (category) {
      return this.events.filter(e => e.category === category);
    }
    return [...this.events];
  }

  /**
   * Clear events
   */
  clear() {
    this.events = [];
  }
}

// Singleton instance
export const logger = new EventLogger();

// Expose to window for debugging (dev only)
if (isDev && typeof window !== 'undefined') {
  window.subtleformsLogger = logger;
}
