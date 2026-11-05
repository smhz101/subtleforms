/**
 * REST preloading for the admin app.
 *
 * The server sends the answers of a few first requests with the page
 * (`window.subtleformsAdmin.preloaded`, built from the
 * `subtleforms/admin/preload_paths` filter). They are registered with apiFetch's
 * preloading middleware, so the request is answered at once and never reaches
 * the network. This file must be imported before `apiClient`: a middleware
 * registered first sits inside the one that unwraps the `{ data, meta }`
 * envelope, so every caller still gets the shape it expects.
 *
 * A screen that wants its data in the very first render can also take it
 * synchronously with `takePreloaded()`. Either way an answer is used once; a
 * later request for the same path goes to the server.
 */
import apiFetch from '@wordpress/api-fetch';
import { normalizePath } from '@wordpress/url';

const PREFIX = '/subtleforms/v1/';

let middleware = null;
const entries = new Map();

/**
 * Register preloaded answers with apiFetch.
 *
 * @param {Object} preloaded Map of REST path to `{ body, headers }`.
 * @param {Object} api       apiFetch (a test can pass its own).
 * @return {boolean} Whether a middleware was registered.
 */
export function registerPreloaded( preloaded, api = apiFetch ) {
	entries.clear();
	middleware = null;
	if ( ! preloaded || typeof preloaded !== 'object' ) {
		return false;
	}
	const clean = {};
	Object.keys( preloaded ).forEach( ( path ) => {
		const entry = preloaded[ path ];
		if ( path.indexOf( PREFIX ) !== 0 || ! entry || typeof entry !== 'object' || ! ( 'body' in entry ) ) {
			return;
		}
		clean[ path ] = entry;
		entries.set( normalizePath( path ), entry );
	} );
	if ( Object.keys( clean ).length === 0 || ! api || typeof api.createPreloadingMiddleware !== 'function' ) {
		return false;
	}
	middleware = api.createPreloadingMiddleware( clean );
	api.use( middleware );
	return true;
}

/**
 * Take a preloaded answer now, without a request. The middleware's copy is
 * dropped too, so a later request for the path reaches the server.
 *
 * @param {string} path Full REST path with its query, e.g. '/subtleforms/v1/forms?page=1'.
 * @return {?{body: *, headers: Object}} The answer, or null.
 */
export function takePreloaded( path ) {
	const key = normalizePath( path );
	const entry = entries.get( key );
	if ( ! entry ) {
		return null;
	}
	entries.delete( key );
	if ( middleware ) {
		try {
			// Served from the preloaded map, so nothing goes to the network.
			middleware( { path, method: 'GET', parse: false }, () => Promise.resolve( null ) );
		} catch ( e ) {
			// The entry stays in the middleware; the worst case is one stale answer.
		}
	}
	return entry;
}

if ( typeof window !== 'undefined' ) {
	registerPreloaded( window.subtleformsAdmin && window.subtleformsAdmin.preloaded );
}
