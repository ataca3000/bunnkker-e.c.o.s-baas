import { useQuery } from '@tanstack/react-query';

import { warehousesService } from '@/features/warehouses/services/warehouses-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export type WarehouseOption = { value: string; label: string };

export function useWarehouseOptions() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'warehouses-options'],
    queryFn: async (): Promise<WarehouseOption[]> => {
      const result = await warehousesService.list({ per_page: 200 });
      return result.items.map((w) => ({ value: w.id, label: w.name }));
    },
    staleTime: 60_000,
  });
}
