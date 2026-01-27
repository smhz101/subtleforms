/**
 * Submissions Mutations
 *
 * TanStack Query mutations for submissions data modification.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Delete a submission
 */
export function useDeleteSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (submissionId) =>
      apiClient.delete(`/submissions/${submissionId}`),
    onSuccess: (_, submissionId) => {
      // Remove deleted submission from cache
      queryClient.removeQueries({ queryKey: queryKeys.submissions.detail(submissionId) });
      // Invalidate lists to update counts and remove from UI
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions.lists() });
    },
  });
}

/**
 * Mark submission as read
 */
export function useMarkSubmissionRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (submissionId) =>
      apiClient.patch(`/submissions/${submissionId}/read`),
    onSuccess: (_, submissionId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.detail(submissionId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.submissions.lists() });
    },
  });
}
