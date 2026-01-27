/**
 * Error Context - Enrich errors with diagnostic info
 * 
 * Adds context to errors for better debugging.
 * Helps identify root causes in production.
 */

/**
 * Enrich error with context
 */
export function enrichError(error, context = {}) {
  if (!error) return error;

  // Create new error to preserve stack
  const enriched = new Error(error.message);
  enriched.name = error.name;
  enriched.stack = error.stack;
  enriched.originalError = error;
  enriched.context = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    ...context,
  };

  return enriched;
}

/**
 * Capture component error boundary context
 */
export function captureComponentError(error, errorInfo, componentStack) {
  return enrichError(error, {
    type: 'component_error',
    componentStack,
    errorInfo,
  });
}

/**
 * Capture API error context
 */
export function captureApiError(error, endpoint, method = 'GET') {
  return enrichError(error, {
    type: 'api_error',
    endpoint,
    method,
  });
}

/**
 * Capture query error context
 */
export function captureQueryError(error, queryKey) {
  return enrichError(error, {
    type: 'query_error',
    queryKey: JSON.stringify(queryKey),
  });
}

/**
 * Format error for display
 */
export function formatErrorForDisplay(error) {
  if (!error) return 'An unknown error occurred';

  // Use context-aware message if available
  if (error.context?.type === 'api_error') {
    return `Failed to ${error.context.method} ${error.context.endpoint}: ${error.message}`;
  }

  if (error.context?.type === 'query_error') {
    return `Query failed: ${error.message}`;
  }

  return error.message || 'An error occurred';
}
