/**
 * Settings Mutations
 *
 * TanStack Query mutations for settings data modification.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Update general settings
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings) => apiClient.post('/settings', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}

/**
 * Activate/update license key
 */
export function useActivateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (licenseKey) =>
      apiClient.post('/license/activate', { license_key: licenseKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.license() });
    },
  });
}

/**
 * Deactivate license key
 */
export function useDeactivateLicense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post('/license/deactivate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.license() });
    },
  });
}
