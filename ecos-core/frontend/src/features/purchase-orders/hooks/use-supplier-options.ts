import { useQuery } from '@tanstack/react-query';

import { suppliersService } from '@/features/suppliers/services/suppliers-service';
import type { ComboboxOption } from '@/components/crud/combobox';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export function useSupplierOptions() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'suppliers-all'],
    queryFn: async (): Promise<ComboboxOption[]> => {
      const result = await suppliersService.list({ per_page: 200, status: 'active' });
      return result.items.map((s) => ({ value: s.id, label: `${s.code} – ${s.name}` }));
    },
    staleTime: 60_000,
  });
}
