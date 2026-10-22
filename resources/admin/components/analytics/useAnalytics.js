/**
 * Form analytics queries (2.1).
 *
 * Views, submissions and conversion for each form. Views are counted on
 * this site only, and can be turned off under Settings > Integrations >
 * Analytics.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../data/apiClient';

export const ANALYTICS_DAYS = 30;

/**
 * Views, submissions and conversion per form.
 *
 * @param {number} days Window in days.
 * @return {Object} Query result: { data, isLoading, error }.
 */
export function useAnalyticsSummary(days = ANALYTICS_DAYS) {
  return useQuery({
    queryKey: ['subtleforms', 'analytics', 'summary', days],
    queryFn: () => apiClient.get(`/analytics/summary?days=${days}`),
    staleTime: 60 * 1000,
  });
}

/**
 * Daily views and submissions, for all forms or one.
 *
 * @param {number} formId Form ID, 0 for all forms.
 * @param {number} days   Window in days.
 * @return {Object} Query result: { data, isLoading, error }.
 */
export function useAnalyticsSeries(formId = 0, days = ANALYTICS_DAYS) {
  return useQuery({
    queryKey: ['subtleforms', 'analytics', 'series', formId, days],
    queryFn: () => apiClient.get(`/analytics/series?days=${days}&form_id=${formId || 0}`),
    staleTime: 60 * 1000,
  });
}

/**
 * Format a conversion rate.
 *
 * @param {number|null} rate Percentage or null.
 * @return {string}
 */
export function formatRate(rate) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) {
    return '–';
  }
  return `${Number(rate).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}


/**
 * Where visitors stop filling in one form (2.6.0).
 *
 * @param {number} formId Form ID; nothing is fetched without one.
 * @param {number} days   Window in days.
 * @return {Object} Query result: { data, isLoading, error }.
 */
export function useFunnel(formId = 0, days = ANALYTICS_DAYS) {
  return useQuery({
    queryKey: ['subtleforms', 'analytics', 'funnel', formId, days],
    queryFn: () => apiClient.get(`/analytics/funnel?form_id=${formId}&days=${days}`),
    enabled: Number(formId) > 0,
    staleTime: 60 * 1000,
  });
}
