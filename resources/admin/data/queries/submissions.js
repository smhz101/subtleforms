/**
 * Submissions Queries
 *
 * TanStack Query hooks for submissions data fetching.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Fetch submissions for a form
 */
export function useSubmissions(formId, filters = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.submissions.list(formId, filters),
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(formId && { form_id: formId }),
        ...filters,
      }).toString();
      const path = params ? `/submissions?${params}` : '/submissions';
      return apiClient.get(path);
    },
    enabled: options.enabled !== false,
    ...options,
  });
}

/**
 * Fetch a single submission by ID
 */
export function useSubmission(submissionId, options = {}) {
  return useQuery({
    queryKey: queryKeys.submissions.detail(submissionId),
    queryFn: () => apiClient.get(`/submissions/${submissionId}`),
    enabled: !!submissionId,
    ...options,
  });
}
