import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { inventoryControlService } from '@/features/inventory-control/services/inventory-control-service';
import type {
  AbcClassificationsQuery,
  CycleCountPlansQuery,
  VarianceAnalyticsQuery,
  WarehousePerformanceQuery,
} from '@/features/inventory-control/types/inventory-control';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const DASHBOARD_KEY       = 'inventory-dashboard';
const ABC_KEY             = 'inventory-abc-classifications';
const VARIANCE_KEY        = 'inventory-variance-analytics';
const WAREHOUSE_PERF_KEY  = 'inventory-warehouse-performance';
const CYCLE_PLANS_KEY     = 'inventory-cycle-count-plans';

export function useInventoryDashboard() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, DASHBOARD_KEY],
    queryFn:  () => inventoryControlService.getDashboard(),
  });
}

export function useAbcClassifications(params: AbcClassificationsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, ABC_KEY, params],
    queryFn:  () => inventoryControlService.getAbcClassifications(params),
    placeholderData: keepPreviousData,
  });
}

export function useRecalculateAbc() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => inventoryControlService.recalculateAbc(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['company', companyId, ABC_KEY] });
      void queryClient.invalidateQueries({ queryKey: ['company', companyId, CYCLE_PLANS_KEY] });
      void queryClient.invalidateQueries({ queryKey: ['company', companyId, DASHBOARD_KEY] });
    },
  });
}

export function useVarianceAnalytics(params: VarianceAnalyticsQuery = {}) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, VARIANCE_KEY, params],
    queryFn:  () => inventoryControlService.getVarianceAnalytics(params),
  });
}

export function useWarehousePerformance(params: WarehousePerformanceQuery = {}) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, WAREHOUSE_PERF_KEY, params],
    queryFn:  () => inventoryControlService.getWarehousePerformance(params),
  });
}

export function useCycleCountPlans(params: CycleCountPlansQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, CYCLE_PLANS_KEY, params],
    queryFn:  () => inventoryControlService.getCycleCountPlans(params),
    placeholderData: keepPreviousData,
  });
}
