import { useQuery } from '@tanstack/react-query';

import type { ComboboxOption } from '@/components/crud/combobox';
import { channelsService } from '@/features/channels/services/channels-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export function useChannelOptions() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'channels-all'],
    queryFn: async (): Promise<ComboboxOption[]> => {
      const result = await channelsService.list({ per_page: 200, status: 'active' });
      return result.items.map((c) => ({ value: c.id, label: c.name }));
    },
    staleTime: 60_000,
  });
}
