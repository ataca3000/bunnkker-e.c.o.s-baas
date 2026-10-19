import { useQuery } from '@tanstack/react-query';

import type { ComboboxOption } from '@/components/crud/combobox';
import { warehousesService } from '@/features/warehouses/services/warehouses-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export function useWarehouseOptions() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'warehouses-all'],
    queryFn: async (): Promise<ComboboxOption[]> => {
      const result = await warehousesService.list({ per_page: 200 });
      return result.items.map((w) => ({ value: w.id, label: `${w.code} – ${w.name}` }));
    },
    staleTime: 60_000,
  });
}
