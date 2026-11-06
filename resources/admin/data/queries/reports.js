/**
 * Reports query: entries per day for a date range, the range before it, the
 * per form breakdown and, for one form, the field summary.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * @param {{from: string, to: string, formId?: number}} args Dates are Y-m-d in the site's zone.
 * @param {Object} options Query options.
 */
export function useReport({ from, to, formId = 0 }, options = {}) {
  return useQuery({
    queryKey: queryKeys.reports.report(from, to, formId),
    queryFn: () =>
      apiClient.get(
        `/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${formId ? `&form_id=${Number(formId)}` : ''}`
      ),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}
