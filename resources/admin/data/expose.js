import '../../shared/extend';
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { restPath, useRestQuery } from './restQuery';

/**
 * Put the shared data layer on the public extension object
 * (`window.SubtleFormsExtend`) so an add-on caches its REST reads in the same
 * TanStack Query cache as this plugin and bundles no second copy. Available
 * since 2.7.5; add-ons check `typeof SubtleFormsExtend.useRestQuery`.
 *
 * `QueryClientProvider` is there for an add-on page that mounts its own React
 * root (a page of its own, such as SubtleForms > Orders): wrap it in
 * `<QueryClientProvider client={ SubtleFormsExtend.queryClient }>`. Screens
 * drawn inside this plugin's own screens already sit in the provider.
 *
 * @param {Object} target The object to add them to; defaults to `window.SubtleFormsExtend`.
 * @return {Object} The object.
 */
export function exposeDataLayer( target = typeof window !== 'undefined' ? window.SubtleFormsExtend : null ) {
	if ( target ) {
		target.queryClient = queryClient;
		target.QueryClientProvider = QueryClientProvider;
		target.useQuery = useQuery;
		target.useMutation = useMutation;
		target.useQueryClient = useQueryClient;
		target.useRestQuery = useRestQuery;
		target.restPath = restPath;
	}
	return target;
}

exposeDataLayer();
