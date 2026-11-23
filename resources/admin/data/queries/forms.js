/**
 * Forms Queries
 *
 * TanStack Query hooks for forms data fetching.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';
import { fetchAllForms } from '../../../shared/allForms';

/**
 * Fetch all forms with optional filters
 */
export function useForms(filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.forms.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters).toString();
      const path = params ? `/forms?${params}` : '/forms';
      return apiClient.get(path);
    },
    staleTime: 30 * 1000, // Consider fresh for 30 seconds
    ...options,
  });
}

/**
 * Every form as `{ id, title }`, for pickers and filters. Walks all pages, so
 * it is not limited to the newest 20.
 */
export function useAllForms(options = {}) {
  return useQuery({
    queryKey: [...queryKeys.forms.all, 'every'],
    queryFn: () => fetchAllForms(),
    staleTime: 30 * 1000,
    ...options,
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
