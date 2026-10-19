import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { branchesService } from '@/features/branches/services/branches-service';
import type { BranchesQuery, BranchPayload } from '@/features/branches/types/branch';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const BRANCHES_KEY = 'branches';

/** Paginated, filtered, sorted branches list. */
export function useBranchesQuery(params: BranchesQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, BRANCHES_KEY, params],
    queryFn: () => branchesService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateBranch() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BranchPayload) => branchesService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BRANCHES_KEY] }),
  });
}

export function useUpdateBranch() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BranchPayload }) =>
      branchesService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BRANCHES_KEY] }),
  });
}

export function useDeleteBranch() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => branchesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BRANCHES_KEY] }),
  });
}
