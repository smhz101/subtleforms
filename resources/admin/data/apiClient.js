/**
 * API Client
 *
 * Centralized HTTP client for all API interactions.
 * Wraps WordPress apiFetch with consistent error handling.
 * 
 * Phase A1: Normalizes standardized REST API response contract
 * - Success responses: { data: {...}, meta: {...} }
 * - Error responses: { error: { code, message, meta } }
 * 
 * Phase A3: Optimistic locking & Rate limiting
 * - Stores ETags from responses
 * - Sends If-Match headers on mutations
 * - Handles HTTP 409 (conflict) and HTTP 429 (rate limit)
 */

import apiFetch from '@wordpress/api-fetch';

// WordPress apiFetch handles the /wp-json prefix automatically
// We only need the namespace
const namespace = 'subtleforms/v1';
const nonce = window.subtleformsAdmin?.restNonce || '';

/**
 * ETag storage for optimistic locking
 * Maps resource paths to their ETags
 */
const etagCache = new Map();

/**
 * Store ETag for a resource
 */
export const storeETag = (path, etag) => {
  if (etag) {
    etagCache.set(path, etag);
  }
};

/**
 * Get stored ETag for a resource
 */
export const getETag = (path) => {
  return etagCache.get(path);
};

/**
 * Clear ETag for a resource
 */
export const clearETag = (path) => {
  etagCache.delete(path);
};

/**
 * Configure apiFetch defaults
 */
if (nonce) {
  apiFetch.use(apiFetch.createNonceMiddleware(nonce));
}

/**
 * Response normalizer middleware
 * 
 * Unwraps standardized API responses for backward compatibility:
 * - Success: Returns response.data directly
 * - Pagination: Returns response.data with meta.pagination injected
 * - Preserves legacy responses that don't use new format
 * - Extracts and stores ETags for optimistic locking
 */
apiFetch.use((options, next) => {
  return next(options).then((response, responseHeaders) => {
    // Extract ETag from headers if present
    const etag = responseHeaders?.get?.('ETag') || responseHeaders?.etag;
    if (etag && options.path) {
      storeETag(options.path, etag);
    }

    // If response has { data, meta } shape, unwrap it
    if (response && typeof response === 'object' && 'data' in response) {
      const { data, meta } = response;
      
      // Inject pagination metadata into result if present
      if (meta?.pagination) {
        // If data is array (list endpoints), return enhanced array
        if (Array.isArray(data)) {
          return Object.assign(data, { 
            _meta: meta,
            _pagination: meta.pagination 
          });
        }
        // If data is object, inject meta
        return { ...data, _meta: meta, _pagination: meta.pagination };
      }
      
      // Return unwrapped data
      return data;
    }
    
    // Pass through non-standard responses (legacy)
    return response;
  }).catch((error) => {
    // Normalize error responses to consistent shape
    const status = error?.status || error?.data?.status || 0;
    
    // Extract error from standardized format
    const errorData = error?.data?.error || error?.data || {};
    const errorCode = errorData?.code || error?.code || 'unknown_error';
    const errorMessage = errorData?.message || error?.message || 'An unknown error occurred';
    const errorMeta = errorData?.meta || {};
    
    // Create enhanced error object
    const normalizedError = new Error(errorMessage);
    normalizedError.code = errorCode;
    normalizedError.meta = errorMeta;
    normalizedError.status = status;
    
    // Attach field-level validation errors if present (HTTP 422)
    if (status === 422 && errorMeta?.fields) {
      normalizedError.fields = errorMeta.fields;
      normalizedError.isValidationError = true;
    }
    
    // Attach rate limit info if present (HTTP 429)
    if (status === 429) {
      normalizedError.retryAfter = errorMeta?.retry_after || 60;
      normalizedError.isRateLimited = true;
    }
    
    // Attach conflict info if present (HTTP 409)
    if (status === 409) {
      normalizedError.currentETag = errorMeta?.current_etag;
      normalizedError.providedIfMatch = errorMeta?.provided_if_match;
      normalizedError.isConflict = true;
    }
    
    throw normalizedError;
  });
});

/**
 * HTTP client methods with ETag support
 */
export const apiClient = {
  get: (path, options = {}) => {
    return apiFetch({
      path: `/${namespace}${path}`,
      method: 'GET',
      ...options,
    });
  },

  post: (path, data, options = {}) => {
    return apiFetch({
      path: `/${namespace}${path}`,
      method: 'POST',
      data,
      ...options,
    });
  },

  put: (path, data, options = {}) => {
    const headers = { ...options.headers };
    
    // Add If-Match header for optimistic locking if ETag exists
    const etag = getETag(`/${namespace}${path}`);
    if (etag && !headers['If-Match']) {
      headers['If-Match'] = etag;
    }
    
    return apiFetch({
      path: `/${namespace}${path}`,
      method: 'PUT',
      data,
      ...options,
      headers,
    });
  },

  patch: (path, data, options = {}) => {
    const headers = { ...options.headers };
    
    // Add If-Match header for optimistic locking if ETag exists
    const etag = getETag(`/${namespace}${path}`);
    if (etag && !headers['If-Match']) {
      headers['If-Match'] = etag;
    }
    
    return apiFetch({
      path: `/${namespace}${path}`,
      method: 'PATCH',
      data,
      ...options,
      headers,
    });
  },

  delete: (path, options = {}) => {
    return apiFetch({
      path: `/${namespace}${path}`,
      method: 'DELETE',
      ...options,
    });
  },
};

/**
 * Retry a request after rate limit delay
 */
export const retryAfterRateLimit = (requestFn, retryAfter) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      requestFn().then(resolve).catch(reject);
    }, retryAfter * 1000);
  });
};

/**
 * Check if error is a validation error
 */
export const isValidationError = (error) => {
  return error?.isValidationError === true || error?.status === 422;
};

/**
 * Check if error is a rate limit error
 */
export const isRateLimitError = (error) => {
  return error?.isRateLimited === true || error?.status === 429;
};

/**
 * Check if error is a conflict error
 */
export const isConflictError = (error) => {
  return error?.isConflict === true || error?.status === 409;
};

/**
 * Extract field errors from validation error
 */
export const getFieldErrors = (error) => {
  if (isValidationError(error)) {
    return error?.fields || error?.meta?.fields || {};
  }
  return {};
};

/**
 * Legacy fetch wrapper for gradual migration
 * @deprecated Use apiClient methods instead
 */
export const legacyFetch = (path, options = {}) => {
  const restUrl = window.subtleformsAdmin?.restUrl || '/wp-json/subtleforms/v1';
  return fetch(restUrl + path, {
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': nonce,
    },
    ...options,
  });
};
