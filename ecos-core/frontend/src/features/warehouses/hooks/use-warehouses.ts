import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { warehousesService } from '@/features/warehouses/services/warehouses-service';
import type { WarehousesQuery, WarehousePayload } from '@/features/warehouses/types/warehouse';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const WAREHOUSES_KEY = 'warehouses';

/** Paginated, filtered, sorted warehouses list. */
export function useWarehousesQuery(params: WarehousesQuery, options?: { enabled?: boolean }) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, WAREHOUSES_KEY, params],
    queryFn: () => warehousesService.list(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateWarehouse() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WarehousePayload) => warehousesService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, WAREHOUSES_KEY] }),
  });
}

export function useUpdateWarehouse() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WarehousePayload }) =>
      warehousesService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, WAREHOUSES_KEY] }),
  });
}

export function useDeleteWarehouse() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warehousesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, WAREHOUSES_KEY] }),
  });
}
