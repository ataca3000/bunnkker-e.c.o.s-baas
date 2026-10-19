import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { operationsService } from '../services/operations-service';
import type {
  ExceptionCategory,
  ExceptionResolution,
  ExceptionSeverity,
  ExceptionSource,
  ExceptionStatus,
  NoteType,
  PoolMemberStatus,
  PoolMemberType,
  PoolStatus,
  PoolType,
} from '../types/operations';

const KEY = 'logistics-operations';
/**
 * ADR-024 — invalidate the covering prefix.
 *
 * Operations reads Fleet, Network and Dispatch, so any mutation here can change
 * what those screens show. Leaving their caches alone would let two open tabs
 * disagree about the same fact.
 */
const RELATED = ['logistics-fleet', 'logistics-network', 'logistics-dispatch'];

// ── Pools ────────────────────────────────────────────────────────────────────

export function usePoolOptions() {
  return useQuery({
    queryKey: [KEY, 'pool-options'],
    queryFn: () => operationsService.poolOptions(),
    staleTime: Infinity,
  });
}

export function usePools(params?: { status?: PoolStatus; pool_type?: PoolType; page?: number }) {
  return useQuery({
    queryKey: [KEY, 'pools', params],
    queryFn: () => operationsService.pools(params),
    placeholderData: keepPreviousData,
  });
}

export function usePool(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'pool', id],
    queryFn: () => operationsService.pool(id!),
    enabled: id !== null,
  });
}

export function useUnifiedPool(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'pool-unified', id],
    queryFn: () => operationsService.unifiedPool(id!),
    enabled: id !== null,
    // Readiness comes from Fleet and Drivers and changes without us.
    staleTime: 30_000,
  });
}

export function usePoolHealth(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'pool-health', id],
    queryFn: () => operationsService.poolHealth(id!),
    enabled: id !== null,
  });
}

export function usePoolHealthOverview() {
  return useQuery({
    queryKey: [KEY, 'pool-health-overview'],
    queryFn: () => operationsService.poolHealthOverview(),
    staleTime: 30_000,
  });
}

export function useUnassignedResources() {
  return useQuery({
    queryKey: [KEY, 'unassigned'],
    queryFn: () => operationsService.unassigned(),
    staleTime: 60_000,
  });
}

export function useAvailabilityMatrix(from?: string, days = 7) {
  return useQuery({
    queryKey: [KEY, 'availability-matrix', from, days],
    queryFn: () => operationsService.availabilityMatrix(from, days),
    staleTime: 60_000,
  });
}

// ── Capacity ─────────────────────────────────────────────────────────────────

export function useCapacityOptions() {
  return useQuery({
    queryKey: [KEY, 'capacity-options'],
    queryFn: () => operationsService.capacityOptions(),
    staleTime: Infinity,
  });
}

export function useReservations(params?: { status?: string; holding_only?: boolean; page?: number }) {
  return useQuery({
    queryKey: [KEY, 'reservations', params],
    queryFn: () => operationsService.reservations(params),
    placeholderData: keepPreviousData,
  });
}

export function useReservationAudit(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'reservation-audit', id],
    queryFn: () => operationsService.reservationAudit(id!),
    enabled: id !== null,
  });
}

export function useRebalanceCandidates(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'rebalance-candidates', id],
    queryFn: () => operationsService.rebalanceCandidates(id!),
    enabled: id !== null,
    // Advisory only: nothing is held, so a stale candidate is a wasted attempt
    // rather than a wrong one.
    staleTime: 15_000,
  });
}

export function useCapacityMonitoring(date?: string) {
  return useQuery({
    queryKey: [KEY, 'capacity-monitoring', date],
    queryFn: () => operationsService.capacityMonitoring(date),
    staleTime: 30_000,
  });
}

// ── Health ───────────────────────────────────────────────────────────────────

export function useHealthOverview(date?: string) {
  return useQuery({
    queryKey: [KEY, 'health-overview', date],
    queryFn: () => operationsService.healthOverview(date),
    // The headline strip is what an operator watches; keep it moving.
    refetchInterval: 30_000,
  });
}

export function useResourceHealth() {
  return useQuery({
    queryKey: [KEY, 'health-resources'],
    queryFn: () => operationsService.resourceHealth(),
    staleTime: 30_000,
  });
}

export function useCapacityHealth(date?: string) {
  return useQuery({
    queryKey: [KEY, 'health-capacity', date],
    queryFn: () => operationsService.capacityHealth(date),
    staleTime: 30_000,
  });
}

export function useDispatchHealth() {
  return useQuery({
    queryKey: [KEY, 'health-dispatch'],
    queryFn: () => operationsService.dispatchHealth(),
    staleTime: 30_000,
  });
}

export function useUtilisation(date?: string) {
  return useQuery({
    queryKey: [KEY, 'health-utilisation', date],
    queryFn: () => operationsService.utilisation(date),
    staleTime: 60_000,
  });
}

// ── Exceptions ───────────────────────────────────────────────────────────────

export function useExceptionOptions() {
  return useQuery({
    queryKey: [KEY, 'exception-options'],
    queryFn: () => operationsService.exceptionOptions(),
    staleTime: Infinity,
  });
}

export function useExceptions(params?: {
  status?: ExceptionStatus;
  outstanding_only?: boolean;
  source?: ExceptionSource;
  category?: ExceptionCategory;
  severity?: ExceptionSeverity;
  search?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: [KEY, 'exceptions', params],
    queryFn: () => operationsService.exceptions(params),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function useException(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'exception', id],
    queryFn: () => operationsService.exception(id!),
    enabled: id !== null,
  });
}

export function useExceptionSummary() {
  return useQuery({
    queryKey: [KEY, 'exception-summary'],
    queryFn: () => operationsService.exceptionSummary(),
    refetchInterval: 30_000,
  });
}

export function useExceptionNotes(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'exception-notes', id],
    queryFn: () => operationsService.notes(id!),
    enabled: id !== null,
  });
}

export function useEscalations(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'exception-escalations', id],
    queryFn: () => operationsService.escalations(id!),
    enabled: id !== null,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: [KEY, 'alerts'],
    queryFn: () => operationsService.alerts(),
    refetchInterval: 30_000,
  });
}

export function useAlertSummary() {
  return useQuery({
    queryKey: [KEY, 'alert-summary'],
    queryFn: () => operationsService.alertSummary(),
    refetchInterval: 30_000,
  });
}

export function useAlertRules() {
  return useQuery({
    queryKey: [KEY, 'alert-rules'],
    queryFn: () => operationsService.alertRules(),
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

function useOpsMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      RELATED.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
    },
  });
}

export function useCreatePool() {
  return useOpsMutation((payload: Parameters<typeof operationsService.createPool>[0]) =>
    operationsService.createPool(payload),
  );
}

export function useSetPoolStatus() {
  return useOpsMutation(({ id, status, reason }: { id: string; status: PoolStatus; reason?: string }) =>
    operationsService.setPoolStatus(id, status, reason),
  );
}

export function useAddPoolMember() {
  return useOpsMutation(
    ({
      poolId,
      memberType,
      memberId,
      reason,
    }: {
      poolId: string;
      memberType: PoolMemberType;
      memberId: number;
      reason?: string;
    }) => operationsService.addMember(poolId, memberType, memberId, reason),
  );
}

export function useSetMemberStatus() {
  return useOpsMutation(
    ({ memberId, status, reason }: { memberId: string; status: PoolMemberStatus; reason?: string }) =>
      operationsService.setMemberStatus(memberId, status, reason),
  );
}

export function useReserveCapacity() {
  return useOpsMutation((payload: Parameters<typeof operationsService.reserve>[0]) =>
    operationsService.reserve(payload),
  );
}

export function useConfirmReservation() {
  return useOpsMutation((id: string) => operationsService.confirmReservation(id));
}

export function useReleaseReservation() {
  return useOpsMutation(({ id, reason }: { id: string; reason?: string }) =>
    operationsService.releaseReservation(id, reason),
  );
}

export function useRebalanceReservation() {
  return useOpsMutation(
    ({ id, destinationSlotId, reason }: { id: string; destinationSlotId: string; reason?: string }) =>
      operationsService.rebalance(id, destinationSlotId, reason),
  );
}

export function useAcknowledgeException() {
  return useOpsMutation((id: string) => operationsService.acknowledge(id));
}

export function useResolveException() {
  return useOpsMutation(
    ({ id, resolution, reason }: { id: string; resolution: ExceptionResolution; reason: string }) =>
      operationsService.resolve(id, resolution, reason),
  );
}

export function useSuppressException() {
  return useOpsMutation(({ id, reason }: { id: string; reason: string }) =>
    operationsService.suppress(id, reason),
  );
}

export function useAddExceptionNote() {
  return useOpsMutation(
    ({ id, body, noteType }: { id: string; body: string; noteType?: NoteType }) =>
      operationsService.addNote(id, body, noteType ?? 'note'),
  );
}

export function useEscalateException() {
  return useOpsMutation(({ id, reason, toRole }: { id: string; reason: string; toRole?: string }) =>
    operationsService.escalate(id, reason, toRole),
  );
}

export function useCreateAlertRule() {
  return useOpsMutation((payload: Parameters<typeof operationsService.createAlertRule>[0]) =>
    operationsService.createAlertRule(payload),
  );
}

// ── Exception maintenance ────────────────────────────────────────────────────

/**
 * Both sweeps change exception state, so the whole operations prefix is
 * invalidated: summaries, alert counts and the exception list all move.
 */
export function useEscalateOverdueExceptions() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => operationsService.escalateOverdueExceptions(),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useReconcileResolvedConflicts() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => operationsService.reconcileResolvedConflicts(),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
