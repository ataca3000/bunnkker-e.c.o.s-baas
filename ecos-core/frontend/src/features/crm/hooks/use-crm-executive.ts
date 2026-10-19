import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { crmExecutiveService } from '@/features/crm/services/crm-executive-service';
import type { CrmExecutiveQuery } from '@/features/crm/types/crm-executive';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export const CRM_EXECUTIVE_KEY = 'crm-executive';

function useCompanyScope(): string {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

export function useCrmExecutiveKpis(params: CrmExecutiveQuery) {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_EXECUTIVE_KEY, 'kpis', params],
    queryFn: () => crmExecutiveService.kpis(params),
    placeholderData: keepPreviousData,
  });
}

export function useCrmExecutiveGrowth(params: CrmExecutiveQuery) {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_EXECUTIVE_KEY, 'growth', params],
    queryFn: () => crmExecutiveService.growth(params),
    placeholderData: keepPreviousData,
  });
}

export function useCrmExecutiveSatisfaction(params: CrmExecutiveQuery) {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_EXECUTIVE_KEY, 'satisfaction', params],
    queryFn: () => crmExecutiveService.satisfaction(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * Retention and lifetime value are company-wide on the backend, so the period
 * is deliberately absent from their keys — including it would refetch identical
 * data every time the filter moved.
 */
export function useCrmExecutiveRetention() {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_EXECUTIVE_KEY, 'retention'],
    queryFn: () => crmExecutiveService.retention(),
  });
}

export function useCrmExecutiveLifetimeValue() {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_EXECUTIVE_KEY, 'lifetime-value'],
    queryFn: () => crmExecutiveService.lifetimeValue(),
  });
}
