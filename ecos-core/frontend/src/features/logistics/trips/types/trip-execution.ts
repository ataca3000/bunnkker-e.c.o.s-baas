/**
 * Trip execution types — mirror the DeliveryController contract and the trip
 * order endpoints on TripController.
 *
 * Stops, exceptions and returns use integer ids; the trip itself is addressed
 * by UUID, and orders are UUIDs. That split is the backend's, not a
 * simplification: stops are trip-scoped rows, orders are aggregates.
 */

export const STOP_STATUSES = [
  'pending',
  'in_progress',
  'delivered',
  'partial',
  'failed',
  'returned',
  'skipped',
] as const;

export type StopStatus = (typeof STOP_STATUSES)[number];

/**
 * Outcomes a stop can be completed with. `pending` and `in_progress` are states
 * the lifecycle passes through, not outcomes someone selects.
 */
export const STOP_OUTCOMES = ['delivered', 'partial', 'failed', 'returned', 'skipped'] as const;

export type StopOutcome = (typeof STOP_OUTCOMES)[number];

export const RETURN_KINDS = ['product', 'custody'] as const;

export type ReturnKind = (typeof RETURN_KINDS)[number];

export type DeliveryOption = { value: string; label: string };

export type DeliveryOptions = {
  stop_statuses: DeliveryOption[];
  return_kinds: DeliveryOption[];
};

export type DeliveryAction = {
  id: number;
  stop_id: number;
  action_type: string;
  reason: string | null;
  notes: string | null;
  new_delivery_date: string | null;
  corrected_lat: number | null;
  corrected_lng: number | null;
  performed_by: string | null;
  created_at: string | null;
};

/** Proof never exposes the signature itself — only whether one was captured. */
export type DeliveryProof = {
  id: number;
  stop_id: number;
  has_signature: boolean;
  photos: string[];
  photo_count: number;
  notes: string | null;
  captured_at: string | null;
  captured_by: string | null;
};

export type StopPayment = {
  id: number;
  amount: number | string;
  payment_method: string | null;
  is_verified?: boolean;
  created_at?: string | null;
};

export type DeliveryStop = {
  id: number;
  uuid: string;
  trip_id: number;
  order_id: string;
  sequence: number;
  status: StopStatus;
  status_label: string;
  is_settled: boolean;
  accepts_payment: boolean;
  delivery_type: string | null;
  collected_amount: number | string | null;
  payment_method: string | null;
  attempted_at: string | null;
  completed_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  notes: string | null;
  actions?: DeliveryAction[];
  proof?: DeliveryProof | null;
  payments?: StopPayment[];
  created_at: string | null;
};

export const CUSTODY_ITEM_TYPES = [
  'cash_float',
  'pos_device',
  'ice_boxes',
  'ice_packs',
  'thermal_bags',
  'delivery_bags',
  'other',
] as const;

export type CustodyItemType = (typeof CUSTODY_ITEM_TYPES)[number];

/**
 * Custody: equipment and cash floats handed to the driver with the trip.
 *
 * The shortfall is the backend's — it compares the received quantity against
 * what was dispatched. Recomputing it here would produce a second number that
 * disagrees the moment a partial confirmation lands.
 */
export type TripCustodyItem = {
  id: number;
  trip_id: number;
  item_type: CustodyItemType;
  item_type_label: string;
  description: string | null;
  quantity: number;
  received_quantity: number | null;
  has_shortfall: boolean;
  shortfall_quantity: number | null;
  is_driver_confirmed: boolean;
  driver_confirmed_at: string | null;
  notes: string | null;
  created_at: string | null;
};

export type AddCustodyPayload = {
  item_type: CustodyItemType;
  description?: string | null;
  quantity?: number;
  notes?: string | null;
};

export type TripOrder = {
  id: number;
  trip_id: number;
  order_id: string;
  zone_code_snapshot: string | null;
  governorate_snapshot: string | null;
  assignment_type: string;
  is_manual: boolean;
  assigned_by: string | null;
  assigned_at: string | null;
};

export type DeliveryException = {
  id: number;
  trip_id: number;
  stop_id: number | null;
  order_id: string | null;
  exception_type: string;
  description: string;
  photos: string[];
  synced_to_cs: boolean;
  is_resolved: boolean;
  resolved_at: string | null;
  resolution_notes: string | null;
  reported_by: string | null;
  created_at: string | null;
};

export type TripReturn = {
  id: number;
  trip_id: number;
  kind: ReturnKind;
  kind_label: string;
  order_id: string | null;
  product_id: string | null;
  product_name: string | null;
  disposition: string | null;
  custody_type: string | null;
  dispatched_qty: number | string | null;
  returned_qty: number | string;
  warehouse_confirmed_qty: number | string | null;
  warehouse_confirmed_at: string | null;
  discrepancy_qty: number | string | null;
  has_discrepancy: boolean;
  is_confirmed: boolean;
  driver_liable: boolean;
  reason: string | null;
  photos: string[];
  notes: string | null;
  reported_by: string | null;
  created_at: string | null;
};

// ── Write payloads ───────────────────────────────────────────────────────────

export type AddTripOrderPayload = {
  order_id: string;
  zone_code?: string | null;
  governorate?: string | null;
  assignment_type?: 'auto' | 'manual';
};

export type MoveTripOrderPayload = {
  order_id: string;
  target_trip_id: string;
};

export type CompleteStopPayload = {
  status: StopOutcome;
  delivery_type?: string | null;
  collected_amount?: number | null;
  payment_method?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  notes?: string | null;
};

export type RecordActionPayload = {
  action_type: string;
  reason?: string | null;
  notes?: string | null;
  new_delivery_date?: string | null;
  corrected_lat?: number | null;
  corrected_lng?: number | null;
};

export type CaptureProofPayload = {
  signature_path?: string | null;
  photos?: string[];
  notes?: string | null;
};

export type RaiseExceptionPayload = {
  exception_type: string;
  description: string;
  stop_id?: number | null;
  order_id?: string | null;
  photos?: string[];
};

export type RecordReturnPayload = {
  kind: ReturnKind;
  order_id?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  disposition?: 'full' | 'partial' | null;
  custody_type?: string | null;
  dispatched_qty?: number | null;
  returned_qty: number;
  reason?: string | null;
  notes?: string | null;
  photos?: string[];
};

export type ConfirmReturnPayload = {
  warehouse_confirmed_qty: number;
  driver_liable?: boolean;
};

/**
 * A derived, client-side roll-up of stop progress. It is presentation only:
 * nothing here is sent back, and the trip's own status remains the authority
 * on where the trip is in its lifecycle.
 */
export type StopProgress = {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  failed: number;
  percent: number;
};
