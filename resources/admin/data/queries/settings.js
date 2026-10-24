/**
 * Settings Queries
 *
 * TanStack Query hooks for settings data fetching.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Fetch general settings
 */
export function useSettings(options = {}) {
  return useQuery({
    queryKey: queryKeys.settings.general(),
    queryFn: () => apiClient.get('/settings'),
    ...options,
  });
}
