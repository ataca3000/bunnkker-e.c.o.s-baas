import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchCoverageService } from '@/features/branches/services/branch-coverage-service';
import type { CoverageAreaPayload } from '@/features/branches/types/branch';

const coverageKey = (branchId: string) => ['branches', branchId, 'coverage'] as const;

export function useBranchCoverageQuery(branchId: string | null) {
  return useQuery({
    queryKey: coverageKey(branchId ?? ''),
    queryFn: () => branchCoverageService.list(branchId!),
    enabled: !!branchId,
  });
}

export function useAddCoverageArea(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CoverageAreaPayload) =>
      branchCoverageService.create(branchId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coverageKey(branchId) }),
  });
}

export function useUpdateCoverageArea(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ areaId, payload }: { areaId: string; payload: CoverageAreaPayload }) =>
      branchCoverageService.update(branchId, areaId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coverageKey(branchId) }),
  });
}

export function useDeleteCoverageArea(branchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (areaId: string) => branchCoverageService.remove(branchId, areaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coverageKey(branchId) }),
  });
}
