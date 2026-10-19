import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { suppliersService } from '@/features/suppliers/services/suppliers-service';
import type { SuppliersQuery, SupplierPayload } from '@/features/suppliers/types/supplier';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const SUPPLIERS_KEY = 'suppliers';

export function useSupplierQuery(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, SUPPLIERS_KEY, id],
    queryFn: () => suppliersService.get(id),
    enabled: Boolean(id),
  });
}

/** Paginated, filtered, sorted suppliers list. */
export function useSuppliersQuery(params: SuppliersQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, SUPPLIERS_KEY, params],
    queryFn: () => suppliersService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateSupplier() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SupplierPayload) => suppliersService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, SUPPLIERS_KEY] }),
  });
}

export function useUpdateSupplier() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SupplierPayload }) =>
      suppliersService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, SUPPLIERS_KEY] }),
  });
}

export function useDeleteSupplier() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suppliersService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, SUPPLIERS_KEY] }),
  });
}
