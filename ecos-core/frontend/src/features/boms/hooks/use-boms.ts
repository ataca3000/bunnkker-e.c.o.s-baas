import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bomsService } from '@/features/boms/services/boms-service';
import type { BomPayload, BomsQuery } from '@/features/boms/types/bom';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const BOMS_KEY = 'boms';

export function useBomsQuery(params: BomsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, BOMS_KEY, params],
    queryFn: () => bomsService.list(params),
  });
}

export function useBomQuery(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, BOMS_KEY, id],
    queryFn: () => bomsService.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateBom() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BomPayload) => bomsService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BOMS_KEY] }),
  });
}

export function useUpdateBom(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BomPayload) => bomsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BOMS_KEY] }),
  });
}

export function useDeleteBom() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bomsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BOMS_KEY] }),
  });
}
