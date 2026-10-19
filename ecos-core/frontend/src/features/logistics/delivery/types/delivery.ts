/**
 * TASK-LOG-005 — Delivery & Tracking OS
 *
 * A Delivery is one order's journey to the customer, spanning every attempt
 * across every trip. Its public identifier is the UUID, matching Trip.
 *
 * COD here is completion reporting only — Distribution remains the Single Cash
 * Authority, so no settlement figure appears in these types by design.
 */

export type DeliveryStatus =
  | 'pending'
  | 'scheduled'
  | 'in_transit'
  | 'out_for_delivery'
  | 'attempted'
  | 'delivered'
  | 'partially_delivered'
  | 'failed'
  | 'awaiting_retry'
  | 'returning'
  | 'returned'
  | 'cancelled';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export type AttemptStatus =
  | 'created'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'aborted';

export type FailureCategory = 'customer' | 'address' | 'product' | 'payment' | 'operational';

export type PodStatus = 'pending' | 'captured' | 'validated' | 'rejected';

export type PodArtifactKind = 'signature' | 'photo' | 'otp' | 'document';

export type DeliveryReturnStatus =
  | 'initiated'
  | 'in_transit'
  | 'received'
  | 'verified'
  | 'discrepancy'
  | 'cancelled';

export type CodStatus =
  | 'not_applicable'
  | 'due'
  | 'collected'
  | 'verified'
  | 'disputed'
  | 'written_off';

export interface EnumOption<T extends string = string> {
  value: T;
  label: string;
}

/** Each reason publishes its own retry policy so the UI never has to guess. */
export interface FailureReasonOption extends EnumOption {
  category: FailureCategory;
  is_retryable: boolean;
  requires_address_correction: boolean;
}

export interface DeliveryOptions {
  delivery_statuses: EnumOption<DeliveryStatus>[];
  attempt_statuses: EnumOption<AttemptStatus>[];
  failure_categories: EnumOption<FailureCategory>[];
  failure_reasons: FailureReasonOption[];
  pod_artifact_kinds: EnumOption<PodArtifactKind>[];
  return_statuses: EnumOption<DeliveryReturnStatus>[];
  cod_statuses: EnumOption<CodStatus>[];
}

export interface DeliveryStats {
  total: number;
  in_transit: number;
  out_for_delivery: number;
  delivered: number;
  partially_delivered: number;
  failed: number;
  awaiting_retry: number;
  returning: number;
  returned: number;
  cancelled: number;
  sla_breached: number;
  failures_by_category: Record<FailureCategory, number>;
}

export interface PodArtifact {
  id: number;
  kind: PodArtifactKind;
  kind_label: string;
  /** No file_path — downloads go through the authenticated endpoint. */
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  reference: string | null;
  captured_at: string | null;
}

export interface ProofOfDelivery {
  id: string;
  uuid: string;
  attempt_id: number;
  status: PodStatus;
  status_label: string;
  is_validated: boolean;
  required_artifacts: PodArtifactKind[];
  missing_artifacts?: PodArtifactKind[];
  is_complete?: boolean;
  recipient_name: string | null;
  notes: string | null;
  rejection_reason: string | null;
  captured_at: string | null;
  validated_at: string | null;
  artifacts?: PodArtifact[];
  created_at: string | null;
}

export interface DeliveryFailure {
  id: number;
  attempt_id: number;
  reason_code: string;
  reason_label: string;
  category: FailureCategory;
  category_label: string;
  is_retryable: boolean;
  requires_address_correction: boolean;
  is_customer_fault: boolean;
  description: string | null;
  photos: string[];
  reported_by: number | null;
  created_at: string | null;
}

export interface DeliveryAttempt {
  id: string;
  uuid: string;
  attempt_no: number;
  status: AttemptStatus;
  status_label: string;
  is_open: boolean;
  allowed_transitions: EnumOption<AttemptStatus>[];
  /** Read-only references into Distribution. */
  stop_id: number | null;
  trip_id: number | null;
  en_route_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  closed_at: string | null;
  dwell_minutes: number | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_m: number | null;
  recipient_name: string | null;
  recipient_relationship: string | null;
  notes: string | null;
  failure?: DeliveryFailure | null;
  pod?: ProofOfDelivery | null;
  created_at: string | null;
}

export interface DeliveryReturnLine {
  id: number;
  product_id: string | null;
  product_name: string | null;
  ordered_qty: number;
  delivered_qty: number;
  returned_qty: number;
  undelivered_qty: number;
  warehouse_confirmed_qty: number | null;
  discrepancy_qty: number | null;
  has_discrepancy: boolean;
  notes: string | null;
}

export interface DeliveryReturn {
  id: string;
  uuid: string;
  delivery_id: number;
  attempt_id: number | null;
  status: DeliveryReturnStatus;
  status_label: string;
  is_terminal: boolean;
  allowed_transitions: EnumOption<DeliveryReturnStatus>[];
  reason_code: string | null;
  reason: string | null;
  has_discrepancy: boolean;
  total_returned_qty?: number;
  initiated_at: string | null;
  initiated_by: number | null;
  received_at: string | null;
  received_by: number | null;
  verified_at: string | null;
  verified_by: number | null;
  notes: string | null;
  lines?: DeliveryReturnLine[];
  created_at: string | null;
}

/** Completion report. Settlement figures live in Distribution, not here. */
export interface CodRecord {
  id: string;
  uuid: string;
  attempt_id: number | null;
  status: CodStatus;
  status_label: string;
  amount_due: number;
  amount_collected: number;
  shortfall: number;
  is_fully_collected: boolean;
  is_outstanding: boolean;
  blocks_closure: boolean;
  currency: string;
  method: string | null;
  reference_number: string | null;
  collected_at: string | null;
  verified_at: string | null;
  dispute_reason: string | null;
  created_at: string | null;
}

export interface TrackingEvent {
  id: number;
  delivery_id: number;
  attempt_id: number | null;
  event_type: string;
  title: string;
  description: string | null;
  visibility: 'internal' | 'customer';
  customer_visible: boolean;
  occurred_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  actor_name: string | null;
  actor_id: number | null;
  metadata: Record<string, unknown>;
}

/** Redacted customer projection — deliberately narrower than TrackingEvent. */
export interface PublicTrackingEvent {
  event_type: string;
  title: string;
  description: string | null;
  occurred_at: string | null;
}

export interface Delivery {
  id: string;
  uuid: string;
  company_id: string | null;
  order_id: string;
  order_number?: string | null;
  order_customer_name?: string | null;
  current_stop_id: number | null;

  status: DeliveryStatus;
  status_label: string;
  status_tone: StatusTone;
  is_terminal: boolean;
  accepts_new_attempt: boolean;

  attempt_count: number;
  max_attempts: number;
  remaining_attempts: number;
  retry_cutoff_date: string | null;
  within_retry_window: boolean;
  can_retry: boolean;
  retry_blockers: string[];
  requires_manual_review: boolean;

  promised_at: string | null;
  sla_grace_minutes: number | null;
  delivered_at: string | null;
  sla_breached: boolean;
  minutes_late: number | null;
  escalation_level: number;

  requires_address_correction: boolean;
  address_corrected_at: string | null;

  notes: string | null;
  created_by: number | null;

  has_open_attempt?: boolean;
  attempts?: DeliveryAttempt[];
  open_attempt?: DeliveryAttempt | null;
  latest_attempt?: DeliveryAttempt | null;
  failures?: DeliveryFailure[];
  pods?: ProofOfDelivery[];
  returns?: DeliveryReturn[];
  cod_record?: CodRecord | null;
  tracking_events?: TrackingEvent[];

  attempts_count?: number;
  failures_count?: number;
  returns_count?: number;

  created_at: string | null;
  updated_at: string | null;
}

export interface DeliveriesQuery {
  status?: DeliveryStatus | 'all';
  order_id?: string;
  trip_id?: number;
  failure_category?: FailureCategory;
  sla_breached?: boolean;
  awaiting_retry?: boolean;
  per_page?: number;
  page?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export type DeliveriesResult = Paginated<Delivery>;

export interface RetryEligibility {
  can_retry: boolean;
  blockers: string[];
  attempt_count: number;
  max_attempts: number;
  remaining_attempts: number;
  retry_cutoff_date: string | null;
  requires_manual_review: boolean;
}

// ── Payloads ─────────────────────────────────────────────────────────────────

export interface DeliveryPayload {
  order_id: string;
  current_stop_id?: number | null;
  max_attempts?: number;
  retry_cutoff_date?: string | null;
  promised_at?: string | null;
  sla_grace_minutes?: number | null;
  notes?: string | null;
}

export interface PodCapturePayload {
  recipient_name?: string | null;
  notes?: string | null;
  required_artifacts?: PodArtifactKind[];
}

export interface PodArtifactPayload {
  kind: PodArtifactKind;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  reference?: string | null;
}

export interface FailAttemptPayload {
  reason_code: string;
  description?: string | null;
  photos?: string[];
}

export interface ReturnLinePayload {
  product_id?: string | null;
  product_name?: string | null;
  ordered_qty: number;
  delivered_qty: number;
  returned_qty: number;
  notes?: string | null;
}

export interface ReturnPayload {
  attempt_id?: string | null;
  reason_code?: string | null;
  reason?: string | null;
  notes?: string | null;
  lines: ReturnLinePayload[];
}

export interface CodCollectPayload {
  attempt_id: string;
  amount: number;
  method?: string | null;
  reference_number?: string | null;
}
