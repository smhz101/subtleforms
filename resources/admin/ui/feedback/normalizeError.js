/**
 * Error Normalization
 *
 * Converts various error formats into a consistent structure.
 */

export function normalizeError(error) {
  // Already normalized
  if (error?.normalized) {
    return error;
  }

  // TanStack Query error
  if (error?.response) {
    return {
      normalized: true,
      message: error.response?.data?.message || error.message || 'An error occurred',
      code: error.response?.data?.code || error.code,
      status: error.response?.status,
      details: error.response?.data,
      original: error,
    };
  }

  // WordPress API error
  if (error?.code && error?.message) {
    return {
      normalized: true,
      message: error.message,
      code: error.code,
      details: error.data,
      original: error,
    };
  }

  // fetch Response error
  if (error instanceof Response) {
    return {
      normalized: true,
      message: `Request failed with status ${error.status}`,
      status: error.status,
      original: error,
    };
  }

  // Error object
  if (error instanceof Error) {
    return {
      normalized: true,
      message: error.message,
      stack: error.stack,
      original: error,
    };
  }

  // String error
  if (typeof error === 'string') {
    return {
      normalized: true,
      message: error,
      original: error,
    };
  }

  // Unknown format
  return {
    normalized: true,
    message: 'An unexpected error occurred',
    details: error,
    original: error,
  };
}

export function getUserFriendlyMessage(error) {
  const normalized = normalizeError(error);
  
  // Network errors
  if (normalized.code === 'NETWORK_ERROR' || normalized.status === 0) {
    return 'Network connection lost. Please check your internet connection.';
  }

  // Permission errors
  if (normalized.status === 403 || normalized.code === 'rest_forbidden') {
    return 'You do not have permission to perform this action.';
  }

  // Not found
  if (normalized.status === 404) {
    return 'The requested resource was not found.';
  }

  // Server errors
  if (normalized.status >= 500) {
    return 'Server error. Please try again later.';
  }

  // Use provided message or fallback
  return normalized.message || 'An error occurred. Please try again.';
}
