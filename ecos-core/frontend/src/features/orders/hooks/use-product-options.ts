import { useQuery } from '@tanstack/react-query';

import type { ComboboxOption } from '@/components/crud/combobox';
import { productsService } from '@/features/products/services/products-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export function useProductOptions() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'products-all'],
    queryFn: async (): Promise<ComboboxOption[]> => {
      const result = await productsService.list({ per_page: 500, status: 'active' });
      return result.items.map((p) => ({ value: p.id, label: `${p.sku} – ${p.name}` }));
    },
    staleTime: 60_000,
  });
}
