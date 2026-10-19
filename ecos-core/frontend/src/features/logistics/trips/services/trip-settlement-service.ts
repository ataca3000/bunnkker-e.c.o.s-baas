import { api } from '@/lib/axios';
import type {
  PaymentCollection,
  RecordPaymentPayload,
  SettlementNotePayload,
  SubmitCashPayload,
  TripFinancialSummary,
  TripSettlement,
} from '../types/trip-settlement';

const BASE = '/logistics/distribution/trips';

/**
 * Settlement — the money side of a trip.
 *
 * `show` returns 404 when no settlement has been opened yet. That is a normal
 * state, not an error, so it is translated into `null` here and the caller
 * offers to open one instead of showing a failure.
 */
export const tripSettlementService = {
  // ── Payment ledger ─────────────────────────────────────────────────────────

  async payments(tripId: string): Promise<PaymentCollection[]> {
    const { data } = await api.get<{ data: PaymentCollection[] }>(`${BASE}/${tripId}/payments`);
    return data.data;
  },

  async recordPayment(
    tripId: string,
    stopId: number,
    payload: RecordPaymentPayload,
  ): Promise<PaymentCollection> {
    const { data } = await api.post<{ data: PaymentCollection }>(
      `${BASE}/${tripId}/stops/${stopId}/payments`,
      payload,
    );
    return data.data;
  },

  async verifyPayment(tripId: string, paymentId: number): Promise<PaymentCollection> {
    const { data } = await api.patch<{ data: PaymentCollection }>(
      `${BASE}/${tripId}/payments/${paymentId}/verify`,
    );
    return data.data;
  },

  async rejectPayment(
    tripId: string,
    paymentId: number,
    notes?: string,
  ): Promise<PaymentCollection> {
    const { data } = await api.patch<{ data: PaymentCollection }>(
      `${BASE}/${tripId}/payments/${paymentId}/reject`,
      { notes: notes ?? null },
    );
    return data.data;
  },

  // ── Settlement lifecycle ───────────────────────────────────────────────────

  /** `null` means no settlement has been opened for this trip yet. */
  async show(tripId: string): Promise<TripSettlement | null> {
    try {
      const { data } = await api.get<{ data: TripSettlement }>(`${BASE}/${tripId}/settlement`);
      return data.data;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  /** Derives the totals from the payment ledger and opens the settlement. */
  async open(tripId: string): Promise<TripSettlement> {
    const { data } = await api.post<{ data: TripSettlement }>(`${BASE}/${tripId}/settlement`);
    return data.data;
  },

  async submitCash(tripId: string, payload: SubmitCashPayload): Promise<TripSettlement> {
    const { data } = await api.patch<{ data: TripSettlement }>(
      `${BASE}/${tripId}/settlement/submit-cash`,
      payload,
    );
    return data.data;
  },

  async reconcile(tripId: string, payload: SettlementNotePayload): Promise<TripSettlement> {
    const { data } = await api.patch<{ data: TripSettlement }>(
      `${BASE}/${tripId}/settlement/reconcile`,
      payload,
    );
    return data.data;
  },

  async dispute(tripId: string, payload: SettlementNotePayload): Promise<TripSettlement> {
    const { data } = await api.patch<{ data: TripSettlement }>(
      `${BASE}/${tripId}/settlement/dispute`,
      payload,
    );
    return data.data;
  },

  /** Approval. The backend stamps the approving user from the token. */
  async finalize(tripId: string): Promise<TripSettlement> {
    const { data } = await api.patch<{ data: TripSettlement }>(
      `${BASE}/${tripId}/settlement/finalize`,
    );
    return data.data;
  },

  async financialSummary(tripId: string): Promise<TripFinancialSummary> {
    const { data } = await api.get<TripFinancialSummary>(`${BASE}/${tripId}/financial-summary`);
    return data;
  },
};

/** Narrow enough to avoid treating an unrelated failure as "not opened yet". */
function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { status?: number } }).response?.status === 'number' &&
    (error as { response: { status: number } }).response.status === 404
  );
}
