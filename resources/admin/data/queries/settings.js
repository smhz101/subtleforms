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
 * Get license information from PHP-localized data
 * 
 * NO API calls - free version reads from window.subtleformsAdmin
 * Pro version manages license through PHP and passes data via localize_script
 */
export function useLicense(options = {}) {
  return useQuery({
    queryKey: queryKeys.settings.license(),
    queryFn: () => {
      // Read license data from PHP (no API calls)
      const hasProPlugin = window.subtleformsAdmin?.hasProPlugin === true;
      const license = window.subtleformsAdmin?.license || {};
      const capabilities = window.subtleformsAdmin?.capabilities || {};
      
      if (!hasProPlugin) {
        // Free version - no Pro plugin installed
        return {
          active: false,
          plan: 'free',
          status: 'inactive',
          expiresAt: null,
          key: null,
          activationsUsed: 0,
          activationsLimit: 0,
        };
      }
      
      // Pro plugin installed - read from PHP-provided data
      const status = license.status || 'inactive';
      const plan = license.plan || 'free';
      const expiresAt = license.expiresAt || null;
      
      return {
        active: status === 'active',
        plan,
        status,
        expiresAt,
        key: null, // Don't expose full key to frontend
        activationsUsed: 0,
        activationsLimit: 0,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (data comes from PHP, changes rarely)
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
}
