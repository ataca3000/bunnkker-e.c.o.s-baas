import { useQuery } from '@tanstack/react-query';

import { executiveDashboardService } from '@/features/dashboard/services/executive-dashboard.service';

export const EXEC_DASHBOARD_KEY = ['executive-dashboard'] as const;

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: EXEC_DASHBOARD_KEY,
    queryFn:  () => executiveDashboardService.get(),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
    staleTime:       2 * 60 * 1000,
    retry: 1,
  });
}
