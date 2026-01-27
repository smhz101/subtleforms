/**
 * API Client
 *
 * Centralized HTTP client for all API interactions.
 * Wraps WordPress apiFetch with consistent error handling.
 */

import apiFetch from '@wordpress/api-fetch';

// WordPress apiFetch handles the /wp-json prefix automatically
// We only need the namespace
const namespace = 'subtleforms/v1';
const nonce = window.subtleformsAdmin?.restNonce || '';

/**
 * Configure apiFetch defaults
 */
if (nonce) {
  apiFetch.use(apiFetch.createNonceMiddleware(nonce));
}

/**
 * HTTP client methods
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
    return apiFetch({
      path: `/${namespace}${path}`,
      method: 'PUT',
      data,
      ...options,
    });
  },

  patch: (path, data, options = {}) => {
    return apiFetch({
      path: `/${namespace}${path}`,
      method: 'PATCH',
      data,
      ...options,
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
