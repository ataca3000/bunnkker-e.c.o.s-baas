import { api } from '@/lib/axios';
import { DEFAULT_CURRENCY } from '@/lib/format';
import type {
  CodCollectPayload,
  CodRecord,
  DeliveriesQuery,
  DeliveriesResult,
  Delivery,
  DeliveryAttempt,
  DeliveryFailure,
  DeliveryOptions,
  DeliveryPayload,
  DeliveryReturn,
  DeliveryStats,
  DeliveryStatus,
  FailAttemptPayload,
  PodArtifactPayload,
  PodCapturePayload,
  ProofOfDelivery,
  PublicTrackingEvent,
  RetryEligibility,
  ReturnPayload,
  TrackingEvent,
} from '../types/delivery';

const BASE = '/logistics/delivery';

/** Deliveries and attempts are addressed by UUID, matching the Trip convention. */
export const deliveryService = {
  // ── Reference data ─────────────────────────────────────────────────────────

  async options(): Promise<DeliveryOptions> {
    const { data } = await api.get<DeliveryOptions>(`${BASE}/options`);
    return data;
  },

  async stats(): Promise<DeliveryStats> {
    const { data } = await api.get<DeliveryStats>(`${BASE}/stats`);
    return data;
  },

  // ── Deliveries ─────────────────────────────────────────────────────────────

  async list(params?: DeliveriesQuery): Promise<DeliveriesResult> {
    const { data } = await api.get<DeliveriesResult>(BASE, { params });
    return data;
  },

  async get(id: string): Promise<Delivery> {
    const { data } = await api.get<{ data: Delivery }>(`${BASE}/${id}`);
    return data.data;
  },

  async create(payload: DeliveryPayload): Promise<Delivery> {
    const { data } = await api.post<{ data: Delivery }>(BASE, payload);
    return data.data;
  },

  async setStatus(id: string, status: DeliveryStatus): Promise<Delivery> {
    const { data } = await api.patch<{ data: Delivery }>(`${BASE}/${id}/status`, { status });
    return data.data;
  },

  async cancel(id: string, reason?: string): Promise<Delivery> {
    const { data } = await api.patch<{ data: Delivery }>(`${BASE}/${id}/cancel`, { reason });
    return data.data;
  },

  async escalate(id: string): Promise<Delivery> {
    const { data } = await api.patch<{ data: Delivery }>(`${BASE}/${id}/escalate`);
    return data.data;
  },

  // ── Retry ──────────────────────────────────────────────────────────────────

  async retryEligibility(id: string): Promise<RetryEligibility> {
    const { data } = await api.get<RetryEligibility>(`${BASE}/${id}/retry-eligibility`);
    return data;
  },

  async retry(id: string): Promise<Delivery> {
    const { data } = await api.post<{ data: Delivery }>(`${BASE}/${id}/retry`);
    return data.data;
  },

  async markAddressCorrected(id: string): Promise<Delivery> {
    const { data } = await api.patch<{ data: Delivery }>(`${BASE}/${id}/address-corrected`);
    return data.data;
  },

  // ── Tracking ───────────────────────────────────────────────────────────────

  async timeline(id: string): Promise<TrackingEvent[]> {
    const { data } = await api.get<{ data: TrackingEvent[] }>(`${BASE}/${id}/timeline`);
    return data.data;
  },

  /** The redacted projection the customer is allowed to see. */
  async publicTimeline(id: string): Promise<PublicTrackingEvent[]> {
    const { data } = await api.get<{ data: PublicTrackingEvent[] }>(`${BASE}/${id}/public-timeline`);
    return data.data;
  },

  // ── Attempts ───────────────────────────────────────────────────────────────

  async attempts(deliveryId: string): Promise<DeliveryAttempt[]> {
    const { data } = await api.get<{ data: DeliveryAttempt[] }>(`${BASE}/${deliveryId}/attempts`);
    return data.data;
  },

  /** Opens an attempt against a Distribution stop — consumed by reference. */
  async openAttempt(deliveryId: string, stopId: number): Promise<DeliveryAttempt> {
    const { data } = await api.post<{ data: DeliveryAttempt }>(`${BASE}/${deliveryId}/attempts`, {
      stop_id: stopId,
    });
    return data.data;
  },

  async advanceAttempt(
    deliveryId: string,
    attemptId: string,
    payload: { status: string; gps_lat?: number; gps_lng?: number; notes?: string },
  ): Promise<DeliveryAttempt> {
    const { data } = await api.patch<{ data: DeliveryAttempt }>(
      `${BASE}/${deliveryId}/attempts/${attemptId}/advance`,
      payload,
    );
    return data.data;
  },

  async succeedAttempt(deliveryId: string, attemptId: string, partial = false): Promise<DeliveryAttempt> {
    const { data } = await api.patch<{ data: DeliveryAttempt }>(
      `${BASE}/${deliveryId}/attempts/${attemptId}/succeed`,
      { partial },
    );
    return data.data;
  },

  async failAttempt(
    deliveryId: string,
    attemptId: string,
    payload: FailAttemptPayload,
  ): Promise<DeliveryFailure> {
    const { data } = await api.patch<{ data: DeliveryFailure }>(
      `${BASE}/${deliveryId}/attempts/${attemptId}/fail`,
      payload,
    );
    return data.data;
  },

  async abortAttempt(deliveryId: string, attemptId: string, reason?: string): Promise<DeliveryAttempt> {
    const { data } = await api.patch<{ data: DeliveryAttempt }>(
      `${BASE}/${deliveryId}/attempts/${attemptId}/abort`,
      { reason },
    );
    return data.data;
  },

  // ── Proof of delivery ──────────────────────────────────────────────────────

  async pod(deliveryId: string, attemptId: string): Promise<ProofOfDelivery> {
    const { data } = await api.get<{ data: ProofOfDelivery }>(
      `${BASE}/${deliveryId}/attempts/${attemptId}/pod`,
    );
    return data.data;
  },

  async capturePod(
    deliveryId: string,
    attemptId: string,
    payload: PodCapturePayload,
  ): Promise<ProofOfDelivery> {
    const { data } = await api.post<{ data: ProofOfDelivery }>(
      `${BASE}/${deliveryId}/attempts/${attemptId}/pod`,
      payload,
    );
    return data.data;
  },

  async addPodArtifact(
    deliveryId: string,
    attemptId: string,
    payload: PodArtifactPayload,
  ): Promise<ProofOfDelivery> {
    const { data } = await api.post<{ data: ProofOfDelivery }>(
      `${BASE}/${deliveryId}/attempts/${attemptId}/pod/artifacts`,
      payload,
    );
    return data.data;
  },

  async validatePod(deliveryId: string, attemptId: string): Promise<ProofOfDelivery> {
    const { data } = await api.patch<{ data: ProofOfDelivery }>(
      `${BASE}/${deliveryId}/attempts/${attemptId}/pod/validate`,
    );
    return data.data;
  },

  async rejectPod(deliveryId: string, attemptId: string, reason: string): Promise<ProofOfDelivery> {
    const { data } = await api.patch<{ data: ProofOfDelivery }>(
      `${BASE}/${deliveryId}/attempts/${attemptId}/pod/reject`,
      { reason },
    );
    return data.data;
  },

  // ── Returns ────────────────────────────────────────────────────────────────

  async returns(deliveryId: string): Promise<DeliveryReturn[]> {
    const { data } = await api.get<{ data: DeliveryReturn[] }>(`${BASE}/${deliveryId}/returns`);
    return data.data;
  },

  async initiateReturn(deliveryId: string, payload: ReturnPayload): Promise<DeliveryReturn> {
    const { data } = await api.post<{ data: DeliveryReturn }>(`${BASE}/${deliveryId}/returns`, payload);
    return data.data;
  },

  async markReturnInTransit(deliveryId: string, returnId: string): Promise<DeliveryReturn> {
    const { data } = await api.patch<{ data: DeliveryReturn }>(
      `${BASE}/${deliveryId}/returns/${returnId}/in-transit`,
    );
    return data.data;
  },

  /** Confirmed quantities keyed by line id; the discrepancy is derived server-side. */
  async receiveReturn(
    deliveryId: string,
    returnId: string,
    confirmed: Record<number, number>,
  ): Promise<DeliveryReturn> {
    const { data } = await api.patch<{ data: DeliveryReturn }>(
      `${BASE}/${deliveryId}/returns/${returnId}/receive`,
      { confirmed },
    );
    return data.data;
  },

  async verifyReturn(deliveryId: string, returnId: string): Promise<DeliveryReturn> {
    const { data } = await api.patch<{ data: DeliveryReturn }>(
      `${BASE}/${deliveryId}/returns/${returnId}/verify`,
    );
    return data.data;
  },

  /**
   * Flags a discrepancy on a received return. Separate from verification: a
   * discrepancy is a finding, not a rejection, and the domain keeps the return
   * open so it can be settled rather than closing it.
   */
  async flagReturnDiscrepancy(
    deliveryId: string,
    returnId: string,
    notes?: string,
  ): Promise<DeliveryReturn> {
    const { data } = await api.patch<{ data: DeliveryReturn }>(
      `${BASE}/${deliveryId}/returns/${returnId}/discrepancy`,
      { notes: notes ?? null },
    );
    return data.data;
  },

  // ── COD (completion reporting only) ────────────────────────────────────────

  async cod(deliveryId: string): Promise<CodRecord> {
    const { data } = await api.get<{ data: CodRecord }>(`${BASE}/${deliveryId}/cod`);
    return data.data;
  },

  async openCod(deliveryId: string, amountDue: number, currency = DEFAULT_CURRENCY): Promise<CodRecord> {
    const { data } = await api.post<{ data: CodRecord }>(`${BASE}/${deliveryId}/cod`, {
      amount_due: amountDue,
      currency,
    });
    return data.data;
  },

  async collectCod(deliveryId: string, payload: CodCollectPayload): Promise<CodRecord> {
    const { data } = await api.patch<{ data: CodRecord }>(`${BASE}/${deliveryId}/cod/collect`, payload);
    return data.data;
  },

  async verifyCod(deliveryId: string): Promise<CodRecord> {
    const { data } = await api.patch<{ data: CodRecord }>(`${BASE}/${deliveryId}/cod/verify`);
    return data.data;
  },

  /**
   * Writes off uncollected COD. The reason is required by the API and is the
   * audit trail for money the business has decided not to pursue, so it is
   * required here too rather than defaulted to an empty string.
   */
  async writeOffCod(deliveryId: string, reason: string): Promise<CodRecord> {
    const { data } = await api.patch<{ data: CodRecord }>(
      `${BASE}/${deliveryId}/cod/write-off`,
      { reason },
    );
    return data.data;
  },

  async disputeCod(deliveryId: string, reason: string): Promise<CodRecord> {
    const { data } = await api.patch<{ data: CodRecord }>(`${BASE}/${deliveryId}/cod/dispute`, { reason });
    return data.data;
  },
};
