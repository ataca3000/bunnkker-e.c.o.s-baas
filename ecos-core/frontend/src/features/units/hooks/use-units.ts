import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { unitsService } from '@/features/units/services/units-service';
import type { UnitsQuery, UnitPayload } from '@/features/units/types/unit';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const UNITS_KEY = 'units';

/** Paginated, filtered, sorted units list. */
export function useUnitsQuery(params: UnitsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, UNITS_KEY, params],
    queryFn: () => unitsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUnit() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UnitPayload) => unitsService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, UNITS_KEY] }),
  });
}

export function useUpdateUnit() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UnitPayload }) =>
      unitsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, UNITS_KEY] }),
  });
}

export function useDeleteUnit() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unitsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, UNITS_KEY] }),
  });
}
