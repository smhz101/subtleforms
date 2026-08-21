/**
 * Non-throwing REST helpers.
 *
 * This is a thin adapter over the same `@wordpress/api-fetch` transport that
 * `data/apiClient.js` uses, so the whole admin shares one nonce, one URL
 * builder and one ETag cache. It exists because two response contracts are
 * genuinely useful:
 *
 *   - `apiClient.*`  throws on error and unwraps the `{ data, meta }` envelope.
 *     Suited to the react-query layer, which expects rejected promises.
 *   - `apiGet` and friends (here) never throw and return the *raw* body.
 *     Suited to the builder and list views, which branch on `ok`/`status` and
 *     unwrap `.data` themselves.
 *
 * Both go through apiFetch, so neither hand-rolls nonce handling and both work
 * when pretty permalinks are disabled — apiFetch's root-URL middleware rewrites
 * `?rest_route=…` paths for us.
 */

import apiFetch from '@wordpress/api-fetch';
import { storeETag } from '../data/apiClient';

const NAMESPACE = 'subtleforms/v1';

/**
 * Build an absolute REST URL.
 *
 * @deprecated Prefer the request helpers below, which go through apiFetch.
 * Retained for callers that still need a URL string.
 */
export const buildApiUrl = ( path ) => {
  const base =
    window.subtleformsAdmin?.restUrl?.replace( /\/$/, '' ) ||
    '/wp-json/subtleforms/v1';

  if ( ! base.includes( '?rest_route=' ) ) {
    return base + path;
  }

  // Fallback mode: a second "?" would fold the query into the rest_route value.
  const sepIdx = path.indexOf( '?' );
  if ( sepIdx === -1 ) {
    return base + path;
  }
  return `${ base }${ path.slice( 0, sepIdx ) }&${ path.slice( sepIdx + 1 ) }`;
};

/**
 * Perform a request and resolve to a result object instead of throwing.
 *
 * @param {string} path             Namespace-relative path, e.g. '/forms?page=2'.
 * @param {Object} [options]        apiFetch options (method, data, headers).
 * @return {Promise<{ok: boolean, status: number, body: *, headers: ?Headers}>} Result.
 */
async function request( path, options = {} ) {
  const fullPath = `/${ NAMESPACE }${ path }`;

  try {
    // parse:false hands back the raw Response, which is the only way to read
    // headers. The apiClient middleware deliberately passes these through.
    const response = await apiFetch( {
      path: fullPath,
      parse: false,
      ...options,
    } );

    const headers = response?.headers ?? null;

    const etag = headers?.get?.( 'ETag' );
    if ( etag ) {
      storeETag( fullPath, etag );
    }

    let body = null;
    if ( response.status !== 204 ) {
      const text = await response.text();
      if ( text ) {
        try {
          body = JSON.parse( text );
        } catch {
          body = null;
        }
      }
    }

    return { ok: response.ok, status: response.status, body, headers };
  } catch ( error ) {
    // Network failure, or a middleware rejected before the request went out.
    return {
      ok: false,
      status: error?.status ?? 0,
      body: error?.data ?? ( error?.message ? { message: error.message } : null ),
      headers: null,
    };
  }
}

export const apiGet = ( path ) => request( path );

export const apiPost = ( path, payload ) =>
  request( path, { method: 'POST', data: payload } );

export const apiPut = ( path, payload ) =>
  request( path, { method: 'PUT', data: payload } );

export const apiDelete = ( path ) => request( path, { method: 'DELETE' } );

// Error predicates live in apiClient; re-exported so callers of either surface
// can use one set rather than two subtly different copies.
export {
  isValidationError,
  isRateLimitError,
  isConflictError,
  getFieldErrors,
} from '../data/apiClient';
