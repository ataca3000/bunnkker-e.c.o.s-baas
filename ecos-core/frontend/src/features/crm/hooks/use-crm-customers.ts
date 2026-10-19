import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { crmCustomersService } from '@/features/crm/services/crm-customers-service';
import type { CrmCustomersQuery } from '@/features/crm/types/crm-customer';
import type {
  CrmCustomerCreateValues,
  CrmCustomerUpdateValues,
} from '@/features/crm/components/crm-customer-form-schema';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export const CRM_CUSTOMERS_KEY = 'crm-customers';

/**
 * Every key is scoped by company, matching the rest of the platform: switching
 * company must not surface another tenant's cached rows.
 */
function useCompanyScope(): string {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

export function useCrmCustomersQuery(params: CrmCustomersQuery) {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_CUSTOMERS_KEY, params],
    queryFn: () => crmCustomersService.list(params),
    // Keeps the previous page on screen while the next loads, so paging and
    // filtering do not blank the grid.
    placeholderData: keepPreviousData,
  });
}

export function useCrmCustomerQuery(id: string) {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_CUSTOMERS_KEY, id],
    queryFn: () => crmCustomersService.get(id),
    enabled: Boolean(id),
  });
}

export function useCrmCustomerGroupsQuery() {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_CUSTOMERS_KEY, 'groups'],
    queryFn: () => crmCustomersService.groups(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useArchiveCrmCustomer() {
  const companyId = useCompanyScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => crmCustomersService.archive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['company', companyId, CRM_CUSTOMERS_KEY],
      });
    },
  });
}

export function useCrmCustomerProfileQuery(id: string | null) {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_CUSTOMERS_KEY, id, 'profile'],
    queryFn: () => crmCustomersService.profile(id as string),
    enabled: Boolean(id),
  });
}

export function useCrmCustomerTimelineQuery(id: string | null, enabled: boolean) {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_CUSTOMERS_KEY, id, 'timeline'],
    queryFn: () => crmCustomersService.timeline(id as string),
    // Only fetched once its tab is opened: the drawer would otherwise issue
    // every tab's request on open, for tabs the user may never look at.
    enabled: Boolean(id) && enabled,
  });
}

export function useCrmCustomerActivitiesQuery(id: string | null, enabled: boolean) {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_CUSTOMERS_KEY, id, 'activities'],
    queryFn: () => crmCustomersService.activities(id as string),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateCrmCustomer() {
  const companyId = useCompanyScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CrmCustomerCreateValues) => crmCustomersService.create(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['company', companyId, CRM_CUSTOMERS_KEY],
      });
    },
  });
}

export function useUpdateCrmCustomer() {
  const companyId = useCompanyScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CrmCustomerUpdateValues }) =>
      crmCustomersService.update(id, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['company', companyId, CRM_CUSTOMERS_KEY],
      });
    },
  });
}

export function useCrmCustomerIntelligenceQuery(id: string | null, enabled: boolean) {
  const companyId = useCompanyScope();

  return useQuery({
    queryKey: ['company', companyId, CRM_CUSTOMERS_KEY, id, 'intelligence'],
    queryFn: () => crmCustomersService.intelligence(id as string),
    enabled: Boolean(id) && enabled,
  });
}
