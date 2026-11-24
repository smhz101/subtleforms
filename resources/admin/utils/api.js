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
 * when pretty permalinks are disabled, apiFetch's root-URL middleware rewrites
 * `?rest_route=…` paths for us.
 */

import apiFetch from '@wordpress/api-fetch';
import { storeETag, storeFormETag, getFormETag } from '../data/apiClient';

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
/**
 * A write to a form: a schema save, or an update of the form itself.
 *
 * @param {string} path   Namespace-relative path.
 * @param {string} method HTTP method.
 * @return {?string} The form ID, or null when the request is not a form write.
 */
function formWriteId( path, method ) {
  const match = /^\/forms\/(\d+)(\/schema)?(?:\?.*)?$/.exec( path );
  if ( ! match ) {
    return null;
  }
  const isSchema = !! match[ 2 ];
  const writes =
    ( method === 'POST' && isSchema ) ||
    ( ( method === 'PUT' || method === 'PATCH' ) && ! isSchema );
  return writes ? match[ 1 ] : null;
}

/**
 * Pass `ifMatch: false` to send a write without the version check, which is
 * how the builder replaces a newer save on purpose.
 */
async function request( path, options = {} ) {
  const fullPath = `/${ NAMESPACE }${ path }`;
  const { ifMatch, ...fetchOptions } = options;
  const method = ( fetchOptions.method || 'GET' ).toUpperCase();
  const writtenFormId = formWriteId( path, method );

  if ( writtenFormId && ifMatch !== false ) {
    const known = getFormETag( writtenFormId );
    if ( known && ! fetchOptions.headers?.[ 'If-Match' ] ) {
      fetchOptions.headers = { ...fetchOptions.headers, 'If-Match': known };
    }
  }

  const settle = async ( response ) => {
    const headers = response.headers ?? null;

    const etag = headers?.get?.( 'ETag' );
    if ( etag ) {
      storeETag( fullPath, etag );
    }

    const body = await readBody( response );

    // The tab's own save moved the form on: keep the new version so its next
    // save is not mistaken for a stale one.
    if ( writtenFormId && response.ok ) {
      storeFormETag( writtenFormId, etag || body?.data?.etag );
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
      headers,
    };
  };

  try {
    // parse:false hands back the raw Response, which is the only way to read
    // headers. The apiClient middleware deliberately passes these through.
    const response = await apiFetch( {
      path: fullPath,
      parse: false,
      ...fetchOptions,
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

export const apiPost = ( path, payload, options = {} ) =>
  request( path, { ...options, method: 'POST', data: payload } );

export const apiPut = ( path, payload, options = {} ) =>
  request( path, { ...options, method: 'PUT', data: payload } );

export const apiDelete = ( path ) => request( path, { method: 'DELETE' } );

// Error predicates live in apiClient; re-exported so callers of either surface
// can use one set rather than two subtly different copies.
export {
  isValidationError,
  isRateLimitError,
  isConflictError,
  getFieldErrors,
} from '../data/apiClient';
