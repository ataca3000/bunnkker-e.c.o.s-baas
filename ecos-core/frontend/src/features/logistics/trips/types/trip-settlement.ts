/**
 * Settlement types — mirror SettlementController and its resources.
 *
 * Two related but distinct records: the payment ledger (one row per collection
 * at a stop) and the settlement itself (one per trip, derived from that ledger).
 * The settlement is opened from the ledger, never typed in.
 */

export const SETTLEMENT_STATUSES = [
  'draft',
  'submitted',
  'reconciled',
  'disputed',
  'finalized',
] as const;

export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const PAYMENT_TYPES = ['cash', 'bank_transfer', 'card', 'already_paid'] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number];

/** Payment rows carry their own review state, separate from the settlement's. */
export type PaymentStatus = string;

export type SettlementOption = { value: string; label: string };

export type SettlementOptions = {
  payment_types: SettlementOption[];
  settlement_statuses: SettlementOption[];
};

export type PaymentCollection = {
  id: number;
  trip_id: number;
  stop_id: number;
  payment_type: PaymentType;
  payment_type_label: string;
  is_physical_cash: boolean;
  amount: number | string;
  reference_number: string | null;
  status: PaymentStatus;
  /**
   * Whether this row is counted in `cash_expected`. A card payment or an
   * already-paid order is collected but is not cash the driver must hand over,
   * and the settlement arithmetic depends on that distinction.
   */
  counts_toward_cash_expected: boolean;
  verified_at: string | null;
  verified_by: string | null;
  collected_by: string | null;
  notes: string | null;
  created_at: string | null;
};

export type TripSettlement = {
  id: number;
  uuid: string;
  trip_id: number;

  cash_collected: number;
  bank_transfers_pending: number;
  already_paid: number;
  total_collected: number;
  cash_expected: number;
  driver_cash_submitted: number | null;
  discrepancy: number | null;
  is_balanced: boolean;
  is_short: boolean;

  status: SettlementStatus;
  status_label: string;
  allowed_transitions: { value: SettlementStatus; label: string }[];
  is_final: boolean;

  submitted_at: string | null;
  reconciled_at: string | null;
  finalized_at: string | null;
  notes: string | null;
  created_at: string | null;
};

/**
 * The read-only financial summary. It repeats the ledger totals and adds stop
 * counts, so a trip with no settlement yet still has something to report —
 * every settlement-derived field is nullable for exactly that case.
 */
export type TripFinancialSummary = {
  cash_collected: number;
  bank_transfers_pending: number;
  already_paid: number;
  total_collected: number;
  cash_expected: number;
  settlement_status: SettlementStatus | null;
  driver_cash_submitted: number | null;
  discrepancy: number | null;
  is_balanced: boolean | null;
  stops_total: number;
  stops_outstanding: number;
};

// ── Write payloads ───────────────────────────────────────────────────────────

export type RecordPaymentPayload = {
  payment_type: PaymentType;
  amount: number;
  reference_number?: string | null;
  image_path?: string | null;
  notes?: string | null;
};

export type SubmitCashPayload = {
  driver_cash_submitted: number;
  notes?: string | null;
};

/** Reconcile, dispute and finalize all take an optional note and nothing else. */
export type SettlementNotePayload = {
  notes?: string | null;
};
