import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dispatchOpsService } from '../services/dispatch-ops-service';
import type { QueuePriority, SessionMode, SessionStatus } from '../types/dispatch-ops';

const KEY = 'logistics-dispatch';
/** Allocation touches Fleet readiness and Network capacity views. */
const FLEET_KEY = 'logistics-fleet';
const NETWORK_KEY = 'logistics-network';

// ── Queries ──────────────────────────────────────────────────────────────────

export function useDispatchOpsOptions() {
  return useQuery({
    queryKey: [KEY, 'ops-options'],
    queryFn: () => dispatchOpsService.options(),
    staleTime: Infinity,
  });
}

export function useDispatchBoards() {
  return useQuery({
    queryKey: [KEY, 'boards'],
    queryFn: () => dispatchOpsService.boards(),
    staleTime: 60_000,
  });
}

export function useSessions(params?: { status?: SessionStatus; page?: number }) {
  return useQuery({
    queryKey: [KEY, 'sessions', params],
    queryFn: () => dispatchOpsService.sessions(params),
    placeholderData: keepPreviousData,
  });
}

export function useQueue(boardId: string | null) {
  return useQuery({
    queryKey: [KEY, 'queue', boardId],
    queryFn: () => dispatchOpsService.queue(boardId!),
    enabled: boardId !== null,
    // The queue moves while a dispatcher works it.
    refetchInterval: 30_000,
  });
}

export function useConflicts(outstandingOnly = true) {
  return useQuery({
    queryKey: [KEY, 'conflicts', outstandingOnly],
    queryFn: () => dispatchOpsService.conflicts(outstandingOnly),
    refetchInterval: 30_000,
  });
}

export function usePendingReviews() {
  return useQuery({
    queryKey: [KEY, 'reviews-pending'],
    queryFn: () => dispatchOpsService.pendingReviews(),
    refetchInterval: 30_000,
  });
}

export function useHeldLocks() {
  return useQuery({
    queryKey: [KEY, 'locks'],
    queryFn: () => dispatchOpsService.locks(),
    refetchInterval: 15_000,
  });
}

export function useBoardTimeline(boardId: string | null) {
  return useQuery({
    queryKey: [KEY, 'timeline', boardId],
    queryFn: () => dispatchOpsService.boardTimeline(boardId!),
    enabled: boardId !== null,
  });
}

export function useAuditTrail(overridesOnly = false) {
  return useQuery({
    queryKey: [KEY, 'audit', overridesOnly],
    queryFn: () => dispatchOpsService.audit(overridesOnly),
  });
}

export function useDispatchKpis() {
  return useQuery({
    queryKey: [KEY, 'kpis'],
    queryFn: () => dispatchOpsService.kpis(),
    staleTime: 30_000,
  });
}

export function useQueueStatistics() {
  return useQuery({
    queryKey: [KEY, 'queue-stats'],
    queryFn: () => dispatchOpsService.queueStatistics(),
    staleTime: 30_000,
  });
}

export function useAssignmentHealth() {
  return useQuery({
    queryKey: [KEY, 'health'],
    queryFn: () => dispatchOpsService.assignmentHealth(),
    staleTime: 30_000,
  });
}

export function useCapacityUtilisation() {
  return useQuery({
    queryKey: [KEY, 'capacity'],
    queryFn: () => dispatchOpsService.capacityUtilisation(),
    staleTime: 60_000,
  });
}

export function useDispatchExceptions() {
  return useQuery({
    queryKey: [KEY, 'exceptions'],
    queryFn: () => dispatchOpsService.exceptions(),
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Invalidates the dispatch prefix plus Fleet and Network, because an allocation
 * consumes their resources (ADR-024 — invalidate the covering prefix).
 */
function useOpsMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [FLEET_KEY] });
      qc.invalidateQueries({ queryKey: [NETWORK_KEY] });
    },
  });
}

export function useOpenSession() {
  return useOpsMutation(({ boardId, mode }: { boardId: string; mode?: SessionMode }) =>
    dispatchOpsService.openSession(boardId, mode ?? 'manual'),
  );
}

export function useCloseSession() {
  return useOpsMutation(({ id, reason }: { id: string; reason?: string }) =>
    dispatchOpsService.closeSession(id, reason),
  );
}

export function useBuildQueue() {
  return useOpsMutation((boardId: string) => dispatchOpsService.buildQueue(boardId));
}

export function useClaimNext() {
  return useOpsMutation((sessionId: string) => dispatchOpsService.claimNext(sessionId));
}

export function usePrioritiseItem() {
  return useOpsMutation(
    ({ itemId, priority, reason }: { itemId: string; priority: QueuePriority; reason: string }) =>
      dispatchOpsService.prioritise(itemId, priority, reason),
  );
}

export function useDeferItem() {
  return useOpsMutation(({ itemId, reason }: { itemId: string; reason?: string }) =>
    dispatchOpsService.deferItem(itemId, reason),
  );
}

export function useAllocate() {
  return useOpsMutation(
    ({
      sessionId,
      payload,
    }: {
      sessionId: string;
      payload: { trip_id: string; vehicle_id: number; driver_id: number; mode?: 'manual' | 'automatic' };
    }) => dispatchOpsService.allocate(sessionId, payload),
  );
}

export function useConfirmAllocation() {
  return useOpsMutation((id: string) => dispatchOpsService.confirmAllocation(id));
}

export function useResolveConflict() {
  return useOpsMutation(
    ({ id, resolution, reason }: { id: string; resolution: string; reason?: string }) =>
      dispatchOpsService.resolveConflict(id, resolution, reason),
  );
}

export function useOverrideConflict() {
  return useOpsMutation(({ id, reason }: { id: string; reason: string }) =>
    dispatchOpsService.overrideConflict(id, reason),
  );
}

export function useApproveReview() {
  return useOpsMutation(({ id, reason }: { id: string; reason?: string }) =>
    dispatchOpsService.approveReview(id, reason),
  );
}

export function useRejectReview() {
  return useOpsMutation(({ id, reason }: { id: string; reason: string }) =>
    dispatchOpsService.rejectReview(id, reason),
  );
}

export function useBreakLock() {
  return useOpsMutation(({ id, reason }: { id: string; reason: string }) =>
    dispatchOpsService.breakLock(id, reason),
  );
}
