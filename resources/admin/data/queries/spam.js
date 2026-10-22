/**
 * Spam Queries (2.6.0)
 *
 * Blocked spam counts and the dashboard offer to turn protection on.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Blocked spam over the last `days` days, for the site or one form.
 *
 * @param {{days?: number, formId?: number}} args
 * @param {Object} options Query options.
 */
export function useSpamStats({ days = 30, formId = 0 } = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.spam.stats(days, formId),
    queryFn: () =>
      apiClient.get(
        `/spam/stats?days=${Number(days)}${formId ? `&form_id=${Number(formId)}` : ''}`
      ),
    staleTime: 60 * 1000,
    ...options,
  });
}

/**
 * Whether the dashboard offers to turn spam protection on for every form.
 */
export function useSpamProtection(options = {}) {
  return useQuery({
    queryKey: queryKeys.spam.protection(),
    queryFn: () => apiClient.get('/spam/protection'),
    ...options,
  });
}
