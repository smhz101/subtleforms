/**
 * Extensions catalog query.
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

export function useExtensions(options = {}) {
  return useQuery({
    queryKey: queryKeys.extensions.all,
    queryFn: () => apiClient.get('/extensions'),
    staleTime: 60 * 1000,
    ...options,
  });
}
