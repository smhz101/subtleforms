/**
 * Mock for @wordpress/api-fetch
 * Returns a resolved promise with empty object by default.
 */
export default function apiFetch(options) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[mock] apiFetch:', options);
  }
  return Promise.resolve({});
}
