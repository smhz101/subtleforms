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
      const hasProPlugin   = window.subtleformsAdmin?.hasProPlugin === true;
      const license        = window.subtleformsAdmin?.license || {};
      const subscription   = window.subtleformsAdmin?.subscription || {};
      const capabilities   = window.subtleformsAdmin?.capabilities || {};

      if (!hasProPlugin) {
        // Free version - check subscription for entitlements
        return {
          active: subscription.connected === true,
          plan: subscription.plan || 'free',
          status: subscription.connected ? 'active' : (subscription.status || 'inactive'),
          expiresAt: subscription.expiresAt || null,
          isDev: subscription.isDev || false,
          capabilities,
        };
      }

      // Pro plugin installed: prefer license data when present, fallback to subscription
      const hasLicenseData = license && license.status;
      const status    = hasLicenseData ? license.status : (subscription.connected ? 'active' : 'inactive');
      const plan      = hasLicenseData ? (license.plan || 'pro') : (subscription.plan || 'free');
      const expiresAt = hasLicenseData ? (license.expires_at || null) : (subscription.expiresAt || null);

      return {
        active: status === 'active' || status === 'valid' || status === 'grace_period',
        plan,
        status,
        expiresAt,
        isDev: subscription.isDev || false,
        capabilities,
      };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (data comes from PHP, changes rarely)
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    ...options,
  });
}
