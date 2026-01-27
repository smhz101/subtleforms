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

/**
 * Fetch license information
 * Returns null if Pro plugin is not installed (404 response)
 */
export function useLicense(options = {}) {
  return useQuery({
    queryKey: queryKeys.settings.license(),
    queryFn: async () => {
      try {
        return await apiClient.get('/license');
      } catch (error) {
        // Pro plugin not installed - treat as free tier
        if (error?.data?.status === 404 || error?.status === 404) {
          return { active: false, tier: 'free' };
        }
        throw error;
      }
    },
    staleTime: 60 * 1000, // Cache for 1 minute
    retry: false, // Don't retry 404s
    ...options,
  });
}
