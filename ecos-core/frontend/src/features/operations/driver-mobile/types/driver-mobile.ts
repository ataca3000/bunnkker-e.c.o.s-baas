export type DeliveryStopStatus = 'pending' | 'in_progress' | 'delivered' | 'partial' | 'failed' | 'returned' | 'skipped';
export type DeliveryActionType = 'completed' | 'partial' | 'refused' | 'not_available' | 'delay' | 'wrong_address' | 'unreachable';
export type PaymentType = 'cash' | 'bank_transfer' | 'already_paid';
export type PaymentCollectionStatus = 'recorded' | 'pending_verification' | 'verified' | 'rejected';
export type ExceptionType = 'damaged' | 'missing' | 'wrong_product' | 'complaint' | 'packaging' | 'other';
export type ReturnType = 'full' | 'partial';
export type SettlementStatus = 'draft' | 'submitted' | 'verified' | 'closed';

export interface DriverTrip {
  id: string;
  trip_number: string;
  name: string | null;
  type: string;
  status: string;
  orders_count: number;
  collection_amount: number;
  zone_code: string | null;
  wave_number: string | null;
  driver_name: string | null;
  vehicle_plate: string | null;
  departure_at: string | null;
  trip_started_at: string | null;
  trip_finished_at: string | null;
  total_cash_collected: number;
  total_bank_transfers: number;
  total_already_paid: number;
  kpis: DriverTripKpis;
}

export interface DriverTripKpis {
  total_orders: number;
  pending: number;
  delivered: number;
  partial: number;
  failed: number;
  returned: number;
  total_collections: number;
  remaining_stops: number;
}

export interface DeliveryStop {
  id: string;
  sequence: number;
  status: DeliveryStopStatus;
  delivery_type: DeliveryActionType | null;
  collected_amount: number;
  payment_method: string | null;
  attempted_at: string | null;
  completed_at: string | null;
  notes: string | null;
  order: StopOrderSummary;
}

export interface StopOrderSummary {
  id: number;
  order_number: string;
  customer_name: string | null;
  billing_phone: string | null;
  shipping_address: string | null;
  governorate: string | null;
  city: string | null;
  area: string | null;
  payment_method: string | null;
  grand_total: number;
  deposit_paid: number;
  remaining_balance: number;
  delivery_notes: string | null;
  lines: StopOrderLine[];
}

export interface StopOrderLine {
  product_id: number;
  product_name: string;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface PaymentCollection {
  id: number;
  payment_type: PaymentType;
  amount: number;
  reference_number: string | null;
  notes: string | null;
  image_path: string | null;
  status: PaymentCollectionStatus;
  verified_at: string | null;
  created_at: string;
}

export interface DeliveryProof {
  id: number;
  signature_path: string | null;
  photos: string[];
  notes: string | null;
  captured_at: string;
}

export interface DeliveryException {
  id: number;
  exception_type: ExceptionType;
  description: string;
  photos: string[];
  synced_to_cs: boolean;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface DeliveryReturn {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  return_type: ReturnType;
  returned_qty: number;
  reason: string | null;
  photos: string[];
  warehouse_confirmed_qty: number | null;
  warehouse_confirmed_at: string | null;
  discrepancy_qty: number | null;
  driver_liability: boolean;
  created_at: string;
}

export interface TripSettlement {
  id: number;
  cash_collected: number;
  bank_transfers_pending: number;
  already_paid: number;
  total_collected: number;
  cash_expected: number;
  driver_cash_submitted: number | null;
  discrepancy: number | null;
  status: SettlementStatus;
  finalized_at: string | null;
}

export interface CustodyReturn {
  id: number;
  custody_type: string;
  dispatched_qty: number;
  returned_qty: number | null;
  driver_liable: boolean;
  confirmed_at: string | null;
}

export interface TripTimeline {
  events: TripTimelineEvent[];
}

export interface TripTimelineEvent {
  type: 'trip_started' | 'stop_completed' | 'stop_partial' | 'stop_failed' | 'stop_returned' | 'exception' | 'trip_finished';
  label: string;
  stop_sequence: number | null;
  order_number: string | null;
  timestamp: string;
  notes: string | null;
}

export interface DeliveryStopDetail {
  id: string;
  sequence: number;
  status: DeliveryStopStatus;
  delivery_type: DeliveryActionType | null;
  collected_amount: number;
  payment_method: string | null;
  attempted_at: string | null;
  completed_at: string | null;
  notes: string | null;
  order: StopOrderSummary;
  collections: PaymentCollection[];
  proof: DeliveryProof | null;
}

export const STOP_STATUS_LABELS: Record<DeliveryStopStatus, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  delivered:   'Delivered',
  partial:     'Partial',
  failed:      'Failed',
  returned:    'Returned',
  skipped:     'Skipped',
};

export const STOP_STATUS_COLORS: Record<DeliveryStopStatus, string> = {
  pending:     'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  delivered:   'bg-green-100 text-green-700',
  partial:     'bg-amber-100 text-amber-700',
  failed:      'bg-red-100 text-red-700',
  returned:    'bg-purple-100 text-purple-700',
  skipped:     'bg-gray-100 text-gray-500',
};

export const ACTION_TYPE_LABELS: Record<DeliveryActionType, string> = {
  completed:     'Delivered',
  partial:       'Partial Delivery',
  refused:       'Customer Refused',
  not_available: 'Not Available',
  delay:         'Delay Requested',
  wrong_address: 'Wrong Address',
  unreachable:   'Unreachable',
};

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  damaged:       'Damaged Item',
  missing:       'Missing Item',
  wrong_product: 'Wrong Product',
  complaint:     'Customer Complaint',
  packaging:     'Packaging Issue',
  other:         'Other',
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  cash:          'Cash',
  bank_transfer: 'Bank Transfer',
  already_paid:  'Pre-Paid',
};

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  draft:     'Draft',
  submitted: 'Submitted',
  verified:  'Verified',
  closed:    'Closed',
};

export const SETTLEMENT_STATUS_COLORS: Record<SettlementStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  verified:  'bg-green-100 text-green-700',
  closed:    'bg-gray-100 text-gray-500',
};
