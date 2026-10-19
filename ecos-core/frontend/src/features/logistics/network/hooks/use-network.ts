import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { networkService } from '../services/network-service';
import type {
  CoverageMemberType,
  ReserveCapacityPayload,
  ServiceAreaPayload,
  ServiceAreaStatus,
  ServiceAreasQuery,
} from '../types/network';

const KEY = 'logistics-network';
/** Coverage feeds dispatch boards, so a coverage change makes them stale. */
const DISPATCH_KEY = 'logistics-dispatch';

export function useNetworkOptions() {
  return useQuery({
    queryKey: [KEY, 'options'],
    queryFn: () => networkService.options(),
    staleTime: Infinity,
  });
}

export function useServiceAreas(params?: ServiceAreasQuery) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => networkService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useServiceArea(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => networkService.get(id!),
    enabled: id !== null,
  });
}

export function useCapacityPlans(areaId: string | null) {
  return useQuery({
    queryKey: [KEY, 'capacity', areaId],
    queryFn: () => networkService.capacityPlans(areaId!),
    enabled: areaId !== null,
  });
}

export function useDispatchRegions() {
  return useQuery({
    queryKey: [KEY, 'regions'],
    queryFn: () => networkService.regions(),
    staleTime: 60_000,
  });
}

export function useServiceLevels() {
  return useQuery({
    queryKey: [KEY, 'service-levels'],
    queryFn: () => networkService.serviceLevels(),
    staleTime: 60_000,
  });
}

/** Mutations invalidate the broad prefix, plus Dispatch (ADR-024). */
function useNetworkMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [DISPATCH_KEY] });
    },
  });
}

export function useCreateServiceArea() {
  return useNetworkMutation((payload: ServiceAreaPayload) => networkService.create(payload));
}

export function useSetAreaStatus() {
  return useNetworkMutation(
    ({ id, status, reason }: { id: string; status: ServiceAreaStatus; reason?: string }) =>
      networkService.setStatus(id, status, reason),
  );
}

export function useAttachMember() {
  return useNetworkMutation(
    ({
      id,
      memberType,
      memberId,
      isExcluded,
    }: {
      id: string;
      memberType: CoverageMemberType;
      memberId: string;
      isExcluded?: boolean;
    }) => networkService.attachMember(id, memberType, memberId, isExcluded ?? false),
  );
}

export function useDetachMember() {
  return useNetworkMutation(({ id, memberId }: { id: string; memberId: number }) =>
    networkService.detachMember(id, memberId),
  );
}

// ── Capacity commitments ─────────────────────────────────────────────────────

export function useReserveCapacity() {
  return useNetworkMutation((payload: ReserveCapacityPayload) =>
    networkService.reserveCapacity(payload),
  );
}

export function useCommitCapacity() {
  return useNetworkMutation((id: string) => networkService.commitCapacity(id));
}

export function useReleaseCapacity() {
  return useNetworkMutation(({ id, reason }: { id: string; reason?: string }) =>
    networkService.releaseCapacity(id, reason),
  );
}

export function useSweepExpiredCapacity() {
  return useNetworkMutation(() => networkService.sweepExpiredCapacity());
}
