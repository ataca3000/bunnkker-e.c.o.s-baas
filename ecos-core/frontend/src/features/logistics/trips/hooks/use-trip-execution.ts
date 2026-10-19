import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { tripExecutionService } from '../services/trip-execution-service';
import type {
  AddCustodyPayload,
  AddTripOrderPayload,
  CaptureProofPayload,
  CompleteStopPayload,
  ConfirmReturnPayload,
  DeliveryStop,
  MoveTripOrderPayload,
  RaiseExceptionPayload,
  RecordActionPayload,
  RecordReturnPayload,
  StopProgress,
} from '../types/trip-execution';

const KEY = 'logistics-trips';

// ── Queries ──────────────────────────────────────────────────────────────────

export function useTripOrders(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'orders', tripId],
    queryFn: () => tripExecutionService.orders(tripId as string),
    enabled: tripId !== null,
  });
}

/**
 * Stops carry the live state of the run, so they are never served stale: a
 * driver's progress that lags the screen is worse than an extra request.
 */
export function useTripStops(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'stops', tripId],
    queryFn: () => tripExecutionService.stops(tripId as string),
    enabled: tripId !== null,
    staleTime: 0,
  });
}

export function useTripCustody(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'custody', tripId],
    queryFn: () => tripExecutionService.custody(tripId as string),
    enabled: tripId !== null,
  });
}

export function useTripExceptions(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'exceptions', tripId],
    queryFn: () => tripExecutionService.exceptions(tripId as string),
    enabled: tripId !== null,
  });
}

export function useTripReturns(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'returns', tripId],
    queryFn: () => tripExecutionService.returns(tripId as string),
    enabled: tripId !== null,
  });
}

// ── Derived ──────────────────────────────────────────────────────────────────

/**
 * Stop progress, computed from the stop list.
 *
 * This is presentation only. It is deliberately not sent anywhere and does not
 * decide anything: the trip's own status is the authority on lifecycle, and a
 * percentage derived in the browser must never contradict it.
 */
export function stopProgress(stops: DeliveryStop[] | undefined): StopProgress {
  const list = stops ?? [];
  const total = list.length;
  const done = (s: DeliveryStop) => s.status !== 'pending' && s.status !== 'in_progress';

  const completed = list.filter(done).length;
  const inProgress = list.filter((s) => s.status === 'in_progress').length;
  const failed = list.filter((s) => s.status === 'failed').length;

  return {
    total,
    completed,
    pending: list.filter((s) => s.status === 'pending').length,
    inProgress,
    failed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Execution writes ripple: adding an order changes the stop list, completing a
 * stop changes the trip's counters and money. Invalidating the whole trip
 * prefix keeps every view of the same aggregate consistent — a narrower
 * invalidation would leave two panels disagreeing.
 */
function useExecutionInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useAddTripOrder(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: (payload: AddTripOrderPayload) => tripExecutionService.addOrder(tripId, payload),
    onSuccess: invalidate,
  });
}

export function useRemoveTripOrder(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: (orderId: string) => tripExecutionService.removeOrder(tripId, orderId),
    onSuccess: invalidate,
  });
}

export function useMoveTripOrder(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: (payload: MoveTripOrderPayload) => tripExecutionService.moveOrder(tripId, payload),
    onSuccess: invalidate,
  });
}

export function useGenerateStops(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: () => tripExecutionService.generateStops(tripId),
    onSuccess: invalidate,
  });
}

export function useStartStop(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: (stopId: number) => tripExecutionService.startStop(tripId, stopId),
    onSuccess: invalidate,
  });
}

export function useCompleteStop(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: ({ stopId, payload }: { stopId: number; payload: CompleteStopPayload }) =>
      tripExecutionService.completeStop(tripId, stopId, payload),
    onSuccess: invalidate,
  });
}

export function useRecordStopAction(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: ({ stopId, payload }: { stopId: number; payload: RecordActionPayload }) =>
      tripExecutionService.recordAction(tripId, stopId, payload),
    onSuccess: invalidate,
  });
}

export function useCaptureProof(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: ({ stopId, payload }: { stopId: number; payload: CaptureProofPayload }) =>
      tripExecutionService.captureProof(tripId, stopId, payload),
    onSuccess: invalidate,
  });
}

export function useAddCustody(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: (payload: AddCustodyPayload) => tripExecutionService.addCustody(tripId, payload),
    onSuccess: invalidate,
  });
}

export function useConfirmCustody(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: ({ custodyId, receivedQuantity }: { custodyId: number; receivedQuantity: number }) =>
      tripExecutionService.confirmCustody(tripId, custodyId, receivedQuantity),
    onSuccess: invalidate,
  });
}

export function useRemoveCustody(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: (custodyId: number) => tripExecutionService.removeCustody(tripId, custodyId),
    onSuccess: invalidate,
  });
}

export function useRaiseException(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: (payload: RaiseExceptionPayload) =>
      tripExecutionService.raiseException(tripId, payload),
    onSuccess: invalidate,
  });
}

export function useResolveException(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: ({ exceptionId, notes }: { exceptionId: number; notes?: string }) =>
      tripExecutionService.resolveException(tripId, exceptionId, notes),
    onSuccess: invalidate,
  });
}

export function useRecordReturn(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: (payload: RecordReturnPayload) => tripExecutionService.recordReturn(tripId, payload),
    onSuccess: invalidate,
  });
}

export function useConfirmReturn(tripId: string) {
  const invalidate = useExecutionInvalidation();

  return useMutation({
    mutationFn: ({ returnId, payload }: { returnId: number; payload: ConfirmReturnPayload }) =>
      tripExecutionService.confirmReturn(tripId, returnId, payload),
    onSuccess: invalidate,
  });
}
