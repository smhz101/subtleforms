/**
 * Import offer mutations (2.7.2)
 * Defer the modal to a notice, or dismiss the offer.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/** @param {'defer'|'dismiss'} action */
export function useImportOfferAction(action) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/import-offer/dismiss', { action }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.importOffer.status(), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.importOffer.all });
    },
  });
}
