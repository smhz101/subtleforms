/**
 * Import offer queries (2.7.2)
 * Fresh-install modal / notice to import forms from other plugins.
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

export function useImportOffer(options = {}) {
  return useQuery({
    queryKey: queryKeys.importOffer.status(),
    queryFn: () => apiClient.get('/import-offer'),
    ...options,
  });
}
