/**
 * Form analytics queries (2.1).
 *
 * Reports are a SubtleForms Pro feature (`extensions.analytics`). Without it
 * these hooks do not call the server and report `locked: true`, so screens can
 * show a preview instead.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../data/apiClient';
import { isProFeature } from '../../utils/featureGate';

export const ANALYTICS_DAYS = 30;

/**
 * Whether the analytics reports are unlocked.
 *
 * @return {boolean}
 */
export function analyticsUnlocked() {
  return isProFeature('extensions.analytics');
}

/**
 * Views, submissions and conversion per form.
 *
 * @param {number} days Window in days.
 * @return {Object} { data, isLoading, error, locked }
 */
export function useAnalyticsSummary(days = ANALYTICS_DAYS) {
  const locked = !analyticsUnlocked();
  const query = useQuery({
    queryKey: ['subtleforms', 'analytics', 'summary', days],
    queryFn: () => apiClient.get(`/analytics/summary?days=${days}`),
    enabled: !locked,
    staleTime: 60 * 1000,
  });
  return { ...query, locked };
}

/**
 * Daily views and submissions, for all forms or one.
 *
 * @param {number} formId Form ID, 0 for all forms.
 * @param {number} days   Window in days.
 * @return {Object} { data, isLoading, error, locked }
 */
export function useAnalyticsSeries(formId = 0, days = ANALYTICS_DAYS) {
  const locked = !analyticsUnlocked();
  const query = useQuery({
    queryKey: ['subtleforms', 'analytics', 'series', formId, days],
    queryFn: () => apiClient.get(`/analytics/series?days=${days}&form_id=${formId || 0}`),
    enabled: !locked,
    staleTime: 60 * 1000,
  });
  return { ...query, locked };
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
 * A believable sample series for the locked preview.
 *
 * @param {number} days Days.
 * @return {Array<{date:string,views:number,submissions:number}>}
 */
export function sampleSeries(days = ANALYTICS_DAYS) {
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const wave = Math.round(60 + 25 * Math.sin(i / 3) + ((i * 7) % 11));
    out.push({
      date: d.toISOString().slice(0, 10),
      views: wave,
      submissions: Math.max(1, Math.round(wave * (0.14 + ((i * 3) % 5) / 100))),
    });
  }
  return out;
}
