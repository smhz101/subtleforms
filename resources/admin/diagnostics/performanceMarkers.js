/**
 * Performance Markers - Measure operation timing
 * 
 * Lightweight performance tracking using Performance API.
 * Helps identify slow operations without heavy profiling.
 */

const isEnabled = () => window.subtleformsAdmin?.diagnostics !== false;

class PerformanceMarkers {
  constructor() {
    this.marks = new Map();
  }

  /**
   * Start timing an operation
   */
  start(name) {
    if (!isEnabled() || !window.performance) return;

    const markName = `sf-${name}-start`;
    try {
      performance.mark(markName);
      this.marks.set(name, Date.now());
    } catch (e) {
      // Performance API not available
    }
  }

  /**
   * End timing and return duration
   */
  end(name) {
    if (!isEnabled() || !window.performance) return 0;

    const startTime = this.marks.get(name);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.marks.delete(name);

    const markName = `sf-${name}`;
    try {
      performance.mark(`${markName}-end`);
      performance.measure(markName, `${markName}-start`, `${markName}-end`);
    } catch (e) {
      // Ignore
    }

    return duration;
  }

  /**
   * Measure a function execution
   */
  async measure(name, fn) {
    this.start(name);
    try {
      const result = await fn();
      return result;
    } finally {
      const duration = this.end(name);
      if (duration > 1000) {
        console.warn(`[SubtleForms] Slow operation: ${name} took ${duration}ms`);
      }
    }
  }

  /**
   * Get performance entries
   */
  getEntries() {
    if (!window.performance) return [];
    
    try {
      return performance.getEntriesByName('sf-*');
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear all markers
   */
  clear() {
    this.marks.clear();
    if (window.performance && performance.clearMarks) {
      try {
        performance.clearMarks('sf-*');
        performance.clearMeasures('sf-*');
      } catch (e) {
        // Ignore
      }
    }
  }
}

export const perfMarkers = new PerformanceMarkers();
