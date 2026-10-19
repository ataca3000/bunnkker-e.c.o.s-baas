import { useQuery } from '@tanstack/react-query';

import { useOrganizationContext } from '@/features/organization/context/organization-context';

import { financeService, type FinancePeriodParams } from '../services/finance-service';

/**
 * React-query hooks for the Executive Finance Workspace (EPIC-FINANCE-UI-001, Phase 1).
 * Company-scoped keys (multi-tenant) matching the house pattern. All read-only.
 */
function useCompanyScope() {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

export function useExecutiveWorkspace(params: FinancePeriodParams = {}) {
  const companyId = useCompanyScope();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'executive-workspace', params],
    queryFn: () => financeService.executiveWorkspace(params),
  });
}

export function useExecutiveSummary(params: FinancePeriodParams = {}) {
  const companyId = useCompanyScope();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'executive-summary', params],
    queryFn: () => financeService.executiveSummary(params),
  });
}

export function useCfoWorkspace() {
  const companyId = useCompanyScope();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'cfo-workspace'],
    queryFn: () => financeService.cfoWorkspace(),
  });
}

export function useRecentJournals() {
  const companyId = useCompanyScope();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'recent-journals'],
    queryFn: () => financeService.recentJournals(),
  });
}
