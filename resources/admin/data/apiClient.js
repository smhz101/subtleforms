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
 * Nonce handling
 *
 * WordPress core's `wp-api-fetch` script already registers a nonce middleware
 * (`wp.apiFetch.nonceMiddleware`) and refreshes it from the heartbeat API, so a
 * long-lived admin session keeps working. Registering a second middleware here
 * from a module-scope constant would shadow that with a nonce captured at page
 * load and never refreshed. We therefore rely on core's, and only install our
 * own as a fallback when core's is absent (e.g. Storybook, Jest).
 */
if ( typeof window !== 'undefined' && ! window.wp?.apiFetch?.nonceMiddleware ) {
  const fallbackNonce = () => window.subtleformsAdmin?.restNonce || '';
  apiFetch.use((options, next) => {
    const value = fallbackNonce();
    if (!value) {
      return next(options);
    }
    return next({
      ...options,
      headers: { 'X-WP-Nonce': value, ...(options.headers || {}) },
    });
  });
}

/**
 * Unwrap the standardized `{ data, meta }` response envelope.
 *
 * Legacy responses that do not use the envelope are passed through untouched.
 */
const unwrapResponse = (response) => {
  if (!response || typeof response !== 'object' || !('data' in response)) {
    return response;
  }

  const { data, meta } = response;

  if (meta?.pagination) {
    if (Array.isArray(data)) {
      return Object.assign(data, { _meta: meta, _pagination: meta.pagination });
    }
    return { ...data, _meta: meta, _pagination: meta.pagination };
  }

  return data;
};

/**
 * Turn an error body into a normalized Error with code/meta/status attached.
 */
const normalizeError = (body, status) => {
  const errorData = body?.error || body || {};
  const errorMeta = errorData?.meta || {};

  const normalizedError = new Error(
    errorData?.message || 'An unknown error occurred'
  );
  normalizedError.code = errorData?.code || 'unknown_error';
  normalizedError.meta = errorMeta;
  normalizedError.status = status;

  if (status === 422 && errorMeta?.fields) {
    normalizedError.fields = errorMeta.fields;
    normalizedError.isValidationError = true;
  }

  if (status === 429) {
    normalizedError.retryAfter = errorMeta?.retry_after || 60;
    normalizedError.isRateLimited = true;
  }

  if (status === 409) {
    normalizedError.currentETag = errorMeta?.current_etag;
    normalizedError.providedIfMatch = errorMeta?.provided_if_match;
    normalizedError.isConflict = true;
  }

  return normalizedError;
};

/**
 * Response middleware: capture ETags, unwrap envelopes, normalize errors.
 *
 * Response headers are only reachable by asking apiFetch NOT to parse the body
 * (`parse: false`) and handling the raw `Response` ourselves. A `.then()`
 * callback receives exactly one argument, so the headers cannot arrive as a
 * second parameter, reading them that way silently yields `undefined` and
 * disables optimistic locking entirely.
 */
/**
 * Read a Response body as JSON, tolerating empty and non-JSON payloads.
 */
const readBody = async (response) => {
  if (!response || response.status === 204) {
    return null;
  }
  try {
    const text = await response.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** Duck-type a fetch Response so this also works with mocked handlers. */
const isResponse = (value) =>
  !!value && typeof value.status === 'number' && typeof value.text === 'function';

apiFetch.use((options, next) => {
  // Caller explicitly wants the raw Response, don't interfere.
  if (options.parse === false) {
    return next(options);
  }

  return next({ ...options, parse: false }).then(
    async (response) => {
      // Not a Response (a middleware short-circuited): fall back to the old path.
      if (!isResponse(response)) {
        return unwrapResponse(response);
      }

      const etag = response.headers?.get?.('ETag');
      if (etag && options.path) {
        storeETag(options.path, etag);
      }

      return unwrapResponse(await readBody(response));
    },
    // With parse:false, apiFetch rejects on any non-2xx and hands back the raw
    // Response rather than a parsed error, so the error body has to be read
    // here. Without this, callers lose `code`, `meta`, validation fields,
    // retry-after and conflict ETags, everything normalizeError attaches.
    async (error) => {
      if (!isResponse(error)) {
        throw error;
      }
      throw normalizeError(await readBody(error), error.status);
    }
  );
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
