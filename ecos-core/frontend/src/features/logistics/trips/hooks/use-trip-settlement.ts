import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { tripSettlementService } from '../services/trip-settlement-service';
import type {
  RecordPaymentPayload,
  SettlementNotePayload,
  SubmitCashPayload,
} from '../types/trip-settlement';

const KEY = 'logistics-trips';

// ── Queries ──────────────────────────────────────────────────────────────────

export function useTripPayments(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'payments', tripId],
    queryFn: () => tripSettlementService.payments(tripId as string),
    enabled: tripId !== null,
  });
}

/**
 * Returns `null` — not an error — when no settlement has been opened. React
 * Query treats a resolved null as success, so the screen can offer to open one
 * instead of rendering a failure for a perfectly normal state.
 */
export function useTripSettlement(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'settlement', tripId],
    queryFn: () => tripSettlementService.show(tripId as string),
    enabled: tripId !== null,
  });
}

export function useTripFinancialSummary(tripId: string | null) {
  return useQuery({
    queryKey: [KEY, 'financial-summary', tripId],
    queryFn: () => tripSettlementService.financialSummary(tripId as string),
    enabled: tripId !== null,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

/**
 * Money writes ripple further than execution writes: verifying a payment
 * changes the ledger, which changes the settlement totals, which changes the
 * trip's own money fields. Invalidating the whole trip prefix is the only way
 * to keep those three views from contradicting each other.
 */
function useSettlementInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useRecordPayment(tripId: string) {
  const invalidate = useSettlementInvalidation();

  return useMutation({
    mutationFn: ({ stopId, payload }: { stopId: number; payload: RecordPaymentPayload }) =>
      tripSettlementService.recordPayment(tripId, stopId, payload),
    onSuccess: invalidate,
  });
}

export function useVerifyPayment(tripId: string) {
  const invalidate = useSettlementInvalidation();

  return useMutation({
    mutationFn: (paymentId: number) => tripSettlementService.verifyPayment(tripId, paymentId),
    onSuccess: invalidate,
  });
}

export function useRejectPayment(tripId: string) {
  const invalidate = useSettlementInvalidation();

  return useMutation({
    mutationFn: ({ paymentId, notes }: { paymentId: number; notes?: string }) =>
      tripSettlementService.rejectPayment(tripId, paymentId, notes),
    onSuccess: invalidate,
  });
}

export function useOpenSettlement(tripId: string) {
  const invalidate = useSettlementInvalidation();

  return useMutation({
    mutationFn: () => tripSettlementService.open(tripId),
    onSuccess: invalidate,
  });
}

export function useSubmitDriverCash(tripId: string) {
  const invalidate = useSettlementInvalidation();

  return useMutation({
    mutationFn: (payload: SubmitCashPayload) => tripSettlementService.submitCash(tripId, payload),
    onSuccess: invalidate,
  });
}

export function useReconcileSettlement(tripId: string) {
  const invalidate = useSettlementInvalidation();

  return useMutation({
    mutationFn: (payload: SettlementNotePayload) =>
      tripSettlementService.reconcile(tripId, payload),
    onSuccess: invalidate,
  });
}

export function useDisputeSettlement(tripId: string) {
  const invalidate = useSettlementInvalidation();

  return useMutation({
    mutationFn: (payload: SettlementNotePayload) => tripSettlementService.dispute(tripId, payload),
    onSuccess: invalidate,
  });
}

export function useFinalizeSettlement(tripId: string) {
  const invalidate = useSettlementInvalidation();

  return useMutation({
    mutationFn: () => tripSettlementService.finalize(tripId),
    onSuccess: invalidate,
  });
}
