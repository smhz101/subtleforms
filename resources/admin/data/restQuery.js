/**
 * Cached REST reads for add-ons.
 *
 * `useRestQuery` is a `useQuery` whose function calls apiFetch, so an add-on
 * (SubtleForms Pro) gets cached screens without bundling its own copy of
 * TanStack Query. It is exposed as `window.SubtleFormsExtend.useRestQuery`
 * next to `queryClient`, `useQuery`, `useMutation` and `useQueryClient`.
 */
import apiFetch from '@wordpress/api-fetch';
import { useQuery } from '@tanstack/react-query';

const NAMESPACE = '/subtleforms/v1';

/**
 * The full REST path for a path an add-on gives.
 *
 * A path that starts with `/subtleforms/` or `/wp/` is used as it is; any
 * other path is taken as relative to `/subtleforms/v1`.
 *
 * @param {string} path REST path.
 * @return {string} Full path.
 */
export function restPath( path ) {
	const value = String( path || '' );
	if ( /^\/(subtleforms|wp)\//.test( value ) ) {
		return value;
	}
	return `${ NAMESPACE }${ value.startsWith( '/' ) ? '' : '/' }${ value }`;
}

/**
 * A cached GET.
 *
 * @param {Object}          args
 * @param {string|string[]} args.key       Cache key. The same key shares the cache between screens.
 * @param {string}          args.path      REST path (see restPath).
 * @param {number}          args.staleTime Milliseconds the answer counts as fresh. Default 30000.
 * @param {Object}          args.options   Any other useQuery option (`enabled`, `select`, `placeholderData`).
 * @return {Object} The useQuery result.
 */
export function useRestQuery( { key, path, staleTime = 30 * 1000, ...options } ) {
	return useQuery( {
		queryKey: Array.isArray( key ) ? key : [ key ],
		queryFn: ( { signal } ) => apiFetch( { path: restPath( path ), method: 'GET', signal } ),
		staleTime,
		...options,
	} );
}
