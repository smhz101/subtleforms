/**
 * Spam Mutations (2.6.0)
 *
 * Turn spam protection on for every form, undo it, or hide the offer.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * @param {'enable-all'|'undo'|'dismiss'} action Route under /spam/protection.
 */
export function useSpamProtectionAction(action) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.post(`/spam/protection/${action}`, {}),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.spam.protection(), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.spam.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.all });
    },
  });
}
