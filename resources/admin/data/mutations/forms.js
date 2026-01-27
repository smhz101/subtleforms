/**
 * Forms Mutations
 *
 * TanStack Query mutations for forms data modification.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Create a new form
 */
export function useCreateForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData) => apiClient.post('/forms', formData),
    onSuccess: () => {
      // Invalidate all form lists to show new form
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.lists() });
    },
  });
}

/**
 * Update an existing form
 */
export function useUpdateForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ formId, data }) => apiClient.put(`/forms/${formId}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.forms.detail(variables.formId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.lists() });
    },
  });
}

/**
 * Delete a form
 */
export function useDeleteForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formId) => apiClient.delete(`/forms/${formId}`),
    onSuccess: (_, formId) => {
      // Remove deleted form from cache
      queryClient.removeQueries({ queryKey: queryKeys.forms.detail(formId) });
      // Invalidate lists to remove from UI
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.lists() });
    },
  });
}

/**
 * Duplicate a form
 */
export function useDuplicateForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formId) => apiClient.post(`/forms/${formId}/duplicate`),
    onSuccess: () => {
      // Invalidate lists to show new duplicate
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.lists() });
    },
  });
}

/**
 * Update form status (publish/draft/archive)
 */
export function useUpdateFormStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ formId, status }) =>
      apiClient.patch(`/forms/${formId}/status`, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.forms.detail(variables.formId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.lists() });
    },
  });
}
