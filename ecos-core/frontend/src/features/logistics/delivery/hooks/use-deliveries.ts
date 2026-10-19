import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deliveryService } from '../services/delivery-service';
import type {
  CodCollectPayload,
  DeliveriesQuery,
  DeliveryPayload,
  DeliveryStatus,
  FailAttemptPayload,
  PodArtifactPayload,
  PodCapturePayload,
  ReturnPayload,
} from '../types/delivery';

const KEY = 'logistics-delivery';
/** Attempt outcomes move the trip's stop, so Distribution views go stale too. */
const DISTRIBUTION_KEY = 'logistics-distribution';

// ── Queries ──────────────────────────────────────────────────────────────────

/** Enum catalogue — cached hard, it only changes on deploy. */
export function useDeliveryOptions() {
  return useQuery({
    queryKey: [KEY, 'options'],
    queryFn: () => deliveryService.options(),
    staleTime: Infinity,
  });
}

export function useDeliveryStats() {
  return useQuery({
    queryKey: [KEY, 'stats'],
    queryFn: () => deliveryService.stats(),
    staleTime: 30_000,
  });
}

export function useDeliveries(params?: DeliveriesQuery) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => deliveryService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useDelivery(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => deliveryService.get(id!),
    enabled: id !== null,
  });
}

export function useRetryEligibility(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'retry-eligibility', id],
    queryFn: () => deliveryService.retryEligibility(id!),
    enabled: id !== null,
  });
}

export function useDeliveryTimeline(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'timeline', id],
    queryFn: () => deliveryService.timeline(id!),
    enabled: id !== null,
  });
}

export function useDeliveryReturns(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'returns', id],
    queryFn: () => deliveryService.returns(id!),
    enabled: id !== null,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Every mutation invalidates the broad delivery prefix so list, detail, stats
 * and timeline refresh together (ADR-024 — one canonical key per entity,
 * invalidate the covering prefix), plus Distribution because stop and trip
 * views read the same execution state.
 */
function useDeliveryMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] });
      qc.invalidateQueries({ queryKey: [DISTRIBUTION_KEY] });
    },
  });
}

export function useCreateDelivery() {
  return useDeliveryMutation((payload: DeliveryPayload) => deliveryService.create(payload));
}

export function useSetDeliveryStatus() {
  return useDeliveryMutation(({ id, status }: { id: string; status: DeliveryStatus }) =>
    deliveryService.setStatus(id, status),
  );
}

export function useCancelDelivery() {
  return useDeliveryMutation(({ id, reason }: { id: string; reason?: string }) =>
    deliveryService.cancel(id, reason),
  );
}

export function useRetryDelivery() {
  return useDeliveryMutation((id: string) => deliveryService.retry(id));
}

export function useMarkAddressCorrected() {
  return useDeliveryMutation((id: string) => deliveryService.markAddressCorrected(id));
}

export function useEscalateDelivery() {
  return useDeliveryMutation((id: string) => deliveryService.escalate(id));
}

// ── Attempts ─────────────────────────────────────────────────────────────────

export function useOpenAttempt() {
  return useDeliveryMutation(({ id, stopId }: { id: string; stopId: number }) =>
    deliveryService.openAttempt(id, stopId),
  );
}

export function useAdvanceAttempt() {
  return useDeliveryMutation(
    ({ id, attemptId, status }: { id: string; attemptId: string; status: string }) =>
      deliveryService.advanceAttempt(id, attemptId, { status }),
  );
}

export function useSucceedAttempt() {
  return useDeliveryMutation(
    ({ id, attemptId, partial }: { id: string; attemptId: string; partial?: boolean }) =>
      deliveryService.succeedAttempt(id, attemptId, partial ?? false),
  );
}

export function useFailAttempt() {
  return useDeliveryMutation(
    ({ id, attemptId, payload }: { id: string; attemptId: string; payload: FailAttemptPayload }) =>
      deliveryService.failAttempt(id, attemptId, payload),
  );
}

// ── Proof of delivery ────────────────────────────────────────────────────────

export function useCapturePod() {
  return useDeliveryMutation(
    ({ id, attemptId, payload }: { id: string; attemptId: string; payload: PodCapturePayload }) =>
      deliveryService.capturePod(id, attemptId, payload),
  );
}

export function useAddPodArtifact() {
  return useDeliveryMutation(
    ({ id, attemptId, payload }: { id: string; attemptId: string; payload: PodArtifactPayload }) =>
      deliveryService.addPodArtifact(id, attemptId, payload),
  );
}

export function useValidatePod() {
  return useDeliveryMutation(({ id, attemptId }: { id: string; attemptId: string }) =>
    deliveryService.validatePod(id, attemptId),
  );
}

export function useRejectPod() {
  return useDeliveryMutation(
    ({ id, attemptId, reason }: { id: string; attemptId: string; reason: string }) =>
      deliveryService.rejectPod(id, attemptId, reason),
  );
}

// ── Returns ──────────────────────────────────────────────────────────────────

export function useInitiateReturn() {
  return useDeliveryMutation(({ id, payload }: { id: string; payload: ReturnPayload }) =>
    deliveryService.initiateReturn(id, payload),
  );
}

export function useReceiveReturn() {
  return useDeliveryMutation(
    ({ id, returnId, confirmed }: { id: string; returnId: string; confirmed: Record<number, number> }) =>
      deliveryService.receiveReturn(id, returnId, confirmed),
  );
}

export function useVerifyReturn() {
  return useDeliveryMutation(({ id, returnId }: { id: string; returnId: string }) =>
    deliveryService.verifyReturn(id, returnId),
  );
}

// ── COD (completion reporting only — Distribution owns settlement) ───────────

export function useCollectCod() {
  return useDeliveryMutation(({ id, payload }: { id: string; payload: CodCollectPayload }) =>
    deliveryService.collectCod(id, payload),
  );
}

export function useVerifyCod() {
  return useDeliveryMutation((id: string) => deliveryService.verifyCod(id));
}

// ── Return discrepancy and COD write-off ─────────────────────────────────────


export function useFlagReturnDiscrepancy() {
  return useDeliveryMutation(
    ({ id, returnId, notes }: { id: string; returnId: string; notes?: string }) =>
      deliveryService.flagReturnDiscrepancy(id, returnId, notes),
  );
}

export function useWriteOffCod() {
  return useDeliveryMutation(({ id, reason }: { id: string; reason: string }) =>
    deliveryService.writeOffCod(id, reason),
  );
}

