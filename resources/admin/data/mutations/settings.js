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
