import { useQuery } from '@tanstack/react-query';

import type { ComboboxOption } from '@/components/crud/combobox';
import { customersService } from '@/features/customers/services/customers-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export function useCustomerOptions() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'customers-all'],
    queryFn: async (): Promise<ComboboxOption[]> => {
      const result = await customersService.list({ per_page: 200, status: 'active' });
      return result.items.map((c) => ({ value: c.id, label: `${c.code} – ${c.name}` }));
    },
    staleTime: 60_000,
  });
}
