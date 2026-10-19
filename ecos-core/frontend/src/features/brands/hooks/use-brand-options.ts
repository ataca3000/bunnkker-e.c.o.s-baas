import { useQuery } from '@tanstack/react-query';

import { brandsService } from '@/features/brands/services/brands-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

/**
 * Returns brand ComboboxOptions for a specific company.
 * Query is disabled (returns []) until companyId is non-empty.
 */
export function useBrandOptions(companyId?: string | null) {
  const { activeCompanyId } = useOrganizationContext();
  const scopeId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', scopeId, 'brand-options', companyId ?? ''],
    queryFn: () =>
      brandsService.list({
        company_id: companyId ?? undefined,
        per_page: 200,
        sort_by: 'name',
        sort_dir: 'asc',
        status: 'active',
      }),
    enabled: Boolean(companyId),
    staleTime: 5 * 60 * 1000,
    select: (data) => data.items.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
  });
}
