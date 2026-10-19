import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fulfillmentsService } from '@/features/fulfillments/services/fulfillments-service';
import type { FulfillmentPayload, FulfillmentsQuery } from '@/features/fulfillments/types/fulfillment';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export const FULFILLMENTS_KEY = 'fulfillments';

export function useFulfillmentsQuery(params: FulfillmentsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, FULFILLMENTS_KEY, params],
    queryFn: () => fulfillmentsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useFulfillmentQuery(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, FULFILLMENTS_KEY, id],
    queryFn: () => fulfillmentsService.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateFulfillment() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FulfillmentPayload) => fulfillmentsService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, FULFILLMENTS_KEY] }),
  });
}

export function useDeleteFulfillment() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fulfillmentsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, FULFILLMENTS_KEY] }),
  });
}

export function useFulfillFulfillment() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fulfillmentsService.fulfill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, FULFILLMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['company', companyId, 'stock-movements'] });
    },
  });
}

export function useCancelFulfillment() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fulfillmentsService.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, FULFILLMENTS_KEY] }),
  });
}
