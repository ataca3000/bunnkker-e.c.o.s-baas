import { useQuery } from '@tanstack/react-query';

import { enterpriseService } from '../services/enterprise-service';

/**
 * The Enterprise Workspace dashboards — one aggregated read each. Read-only.
 */
const KEY = 'logistics-enterprise';

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: [KEY, 'executive'],
    queryFn: () => enterpriseService.executive(),
    refetchInterval: 30_000,
  });
}

export function useOperationsDashboard() {
  return useQuery({
    queryKey: [KEY, 'operations'],
    queryFn: () => enterpriseService.operations(),
    refetchInterval: 30_000,
  });
}
