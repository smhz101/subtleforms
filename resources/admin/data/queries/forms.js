/**
 * Forms Queries
 *
 * TanStack Query hooks for forms data fetching.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Fetch all forms with optional filters
 */
export function useForms(filters = {}) {
  return useQuery({
    queryKey: queryKeys.forms.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters).toString();
      const path = params ? `/forms?${params}` : '/forms';
      return apiClient.get(path);
    },
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
  });
}

/**
 * Fetch a single form by ID
 */
export function useForm(formId, options = {}) {
  return useQuery({
    queryKey: queryKeys.forms.detail(formId),
    queryFn: () => apiClient.get(`/forms/${formId}`),
    enabled: !!formId,
    staleTime: 2 * 60 * 1000, // 2 minutes for form details
    ...options,
  });
}

/**
 * Fetch form status (publish, draft, etc.)
 */
export function useFormStatus(formId, options = {}) {
  return useQuery({
    queryKey: queryKeys.forms.status(formId),
    queryFn: () => apiClient.get(`/forms/${formId}/status`),
    enabled: !!formId,
    ...options,
  });
}
