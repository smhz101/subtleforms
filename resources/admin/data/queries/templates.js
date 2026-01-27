/**
 * Templates Queries
 *
 * TanStack Query hooks for templates data fetching.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Fetch all available templates
 */
export function useTemplates(options = {}) {
  return useQuery({
    queryKey: queryKeys.templates.all,
    queryFn: () => apiClient.get('/templates'),
    staleTime: 5 * 60 * 1000, // Templates rarely change, cache for 5 minutes
    ...options,
  });
}
