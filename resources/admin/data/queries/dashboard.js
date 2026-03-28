/**
 * Dashboard Queries
 *
 * TanStack Query hooks for dashboard data fetching.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import { queryKeys } from '../queryKeys';

/**
 * Fetch dashboard statistics
 */
export function useDashboardStats(options = {}) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => apiClient.get('/dashboard'),
    refetchInterval: 60 * 1000, // Refetch every minute
    ...options,
  });
}
