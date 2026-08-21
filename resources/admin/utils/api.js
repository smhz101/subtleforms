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

/** Duck-type a fetch Response so this also works with mocked handlers. */
const isResponse = ( value ) =>
  !! value && typeof value.status === 'number' && typeof value.text === 'function';

/**
 * Read a Response body as JSON, tolerating empty and non-JSON payloads.
 */
async function readBody( response ) {
  if ( ! response || response.status === 204 ) {
    return null;
  }
  try {
    const text = await response.text();
    if ( ! text ) {
      return null;
    }
    return JSON.parse( text );
  } catch {
    return null;
  }
}

/**
 * Perform a request and resolve to a result object instead of throwing.
 *
 * @param {string} path      Namespace-relative path, e.g. '/forms?page=2'.
 * @param {Object} [options] apiFetch options (method, data, headers).
 * @return {Promise<{ok: boolean, status: number, body: *, headers: ?Headers}>} Result.
 */
async function request( path, options = {} ) {
  const fullPath = `/${ NAMESPACE }${ path }`;

  const settle = async ( response ) => {
    const headers = response.headers ?? null;

    const etag = headers?.get?.( 'ETag' );
    if ( etag ) {
      storeETag( fullPath, etag );
    }

    return {
      ok: response.ok,
      status: response.status,
      body: await readBody( response ),
      headers,
    };
  };

  try {
    // parse:false hands back the raw Response, which is the only way to read
    // headers. The apiClient middleware deliberately passes these through.
    const response = await apiFetch( {
      path: fullPath,
      parse: false,
      ...options,
    } );

    return await settle( response );
  } catch ( error ) {
    // apiFetch rejects on any non-2xx, and with parse:false the rejection value
    // is the raw Response. Callers here branch on status and read validation
    // messages, retry-after and conflict ETags out of `body`, so the error
    // response has to be settled the same way a success is.
    if ( isResponse( error ) ) {
      return await settle( error );
    }

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
