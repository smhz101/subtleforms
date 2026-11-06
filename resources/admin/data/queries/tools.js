/**
 * Settings > Tools and Settings > Logs as cached queries.
 *
 * Both screens used to fetch every time they opened. Their data is cached for
 * a short time, so going from one section to another and back shows what was
 * there at once, and a change that makes it stale invalidates the key.
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

const FORMS_PATH = '/forms?per_page=100&orderby=title&order=ASC';

/**
 * The forms for the pickers on Transfer and on the Logs filters (first 100,
 * by title). Cached for a minute, and dropped when a form is created, changed or deleted
 * (it sits under the forms list keys).
 *
 * @return {Object} useQuery result; `data` is an array.
 */
export function useToolsForms() {
  return useQuery({
    queryKey: queryKeys.forms.list({ picker: 'tools' }),
    queryFn: () => apiClient.get(FORMS_PATH),
    staleTime: 60 * 1000,
    select: (rows) => (Array.isArray(rows) ? rows : []),
  });
}

/**
 * A page of the Activity or Webhooks log.
 *
 * @param {Object} args
 * @param {string} args.kind   'activity' or 'webhook'.
 * @param {number} args.page   Page, from 1.
 * @param {string} args.level  '', 'info', 'warning' or 'error'.
 * @param {string} args.formId '' or a form id.
 * @return {Object} useQuery result; `data` is `{ rows, total }`.
 */
export function useLogList({ kind, page, level = '', formId = '' }) {
  const params = new URLSearchParams({ kind, page: String(page), per_page: '20' });
  if (level) params.set('level', level);
  if (formId) params.set('form_id', formId);
  return useQuery({
    queryKey: queryKeys.logs.list(kind, { page, level, formId }),
    queryFn: () => apiClient.get(`/tools/logs?${params.toString()}`),
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });
}

/**
 * A page of the API log.
 *
 * @param {number} page Page, from 1.
 * @return {Object} useQuery result; `data` is `{ rows, total }`.
 */
export function useApiLog(page) {
  return useQuery({
    queryKey: queryKeys.logs.list('api', { page }),
    queryFn: () => apiClient.get(`/tools/api-logs?page=${page}&per_page=20`),
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
  });
}
