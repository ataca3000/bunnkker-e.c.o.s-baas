import { useQuery } from '@tanstack/react-query';

import type { ComboboxOption } from '@/components/crud/combobox';
import { companiesService } from '@/features/companies/services/companies-service';

export function useCompanyOptions() {
  return useQuery({
    queryKey: ['companies-all'],
    queryFn: async (): Promise<ComboboxOption[]> => {
      const result = await companiesService.list({ per_page: 200, status: 'active' });
      return result.items.map((c) => ({ value: c.id, label: c.name }));
    },
    staleTime: 60_000,
  });
}
