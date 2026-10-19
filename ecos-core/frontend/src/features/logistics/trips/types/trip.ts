/**
 * Trip types — mirror TripResource and the TripController contract.
 *
 * The public identifier for a Trip is its UUID; the bigint primary key is
 * deliberately never exposed by the backend, so every id here is a string.
 */

export const TRIP_STATUSES = [
  'planning',
  'loading',
  'loading_completed',
  'driver_accepted',
  'dispatch_blocked',
  'ready_for_dispatch',
  'dispatched',
  'out_for_delivery',
  'in_progress',
  'completed',
  'settlement_pending',
  'closed',
  'cancelled',
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_TYPES = ['company_vehicle', 'personal_vehicle', 'external_carrier'] as const;

export type TripType = (typeof TRIP_TYPES)[number];

/** An enum option as the backend publishes it. */
export type TripOption = {
  value: string;
  label: string;
};

export type TripOptions = {
  statuses: TripOption[];
  types: TripOption[];
  custody_item_types: TripOption[];
};

export type TripDriver = {
  id: number;
  driver_code: string;
  full_name: string;
  mobile: string | null;
  license_status: string;
};

export type TripVehicle = {
  id: number;
  vehicle_code: string;
  plate_number: string;
  label: string;
  status: string;
};

/**
 * Fields marked optional are published through `when()`/`whenLoaded()` and are
 * therefore absent — not null — unless the relation was eager-loaded. The list
 * endpoint loads the assignment, so driver/vehicle/readiness arrive there too.
 */
export type Trip = {
  id: string;
  uuid: string;
  trip_number: string;
  name: string;

  company_id: string;
  preparation_wave_id: string | null;
  distribution_zone_id: number | null;

  type: TripType;
  type_label: string;
  capacity: number;
  orders_count: number;
  remaining_capacity: number;

  shipping_company_id: number | null;
  shipping_company_name?: string | null;
  driver_vehicle_assignment_id: number | null;
  driver?: TripDriver | null;
  vehicle?: TripVehicle | null;

  status: TripStatus;
  status_label: string;
  allowed_transitions: { value: TripStatus; label: string }[];
  is_editable: boolean;
  is_terminal: boolean;

  dispatch_blockers?: string[];
  is_ready_for_dispatch?: boolean;

  driver_accepted_products: boolean;
  driver_accepted_custody: boolean;
  driver_accepted_equipment: boolean;
  has_full_driver_acceptance: boolean;
  driver_acceptance_at: string | null;
  has_discrepancy: boolean;
  discrepancy_notes: string | null;

  finalized_at: string | null;
  dispatched_at: string | null;
  driver_notified_at: string | null;
  departure_at: string | null;
  trip_started_at: string | null;
  trip_finished_at: string | null;
  odometer_start: number | null;
  odometer_end: number | null;

  collection_amount: number;
  total_cash_collected: number;
  total_bank_transfers: number;
  total_already_paid: number;

  notes: string | null;

  trip_orders_count?: number;
  stops_count?: number;
  custody_count?: number;
  exceptions_count?: number;

  created_at: string | null;
  updated_at: string | null;
};

/**
 * Trip counts by status.
 *
 * `on_the_road` is a backend-side roll-up of dispatched + out_for_delivery +
 * in_progress. It is not a status, and is not filterable as one.
 */
export type TripStats = {
  total_trips: number;
  planning: number;
  loading: number;
  ready_for_dispatch: number;
  dispatch_blocked: number;
  on_the_road: number;
  completed: number;
  settlement_pending: number;
  closed: number;
  cancelled: number;
};

/**
 * `status` accepts a TripStatus, or the literal 'all'. Omitting it is NOT the
 * same as 'all': the backend then excludes closed and cancelled trips, which is
 * the operational default.
 */
export type TripsQuery = {
  search?: string;
  status?: TripStatus | 'all';
  type?: TripType;
  company_id?: string;
  preparation_wave_id?: string;
  distribution_zone_id?: number;
  shipping_company_id?: number;
  per_page?: number;
  page?: number;
};

export type TripsMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

export type TripsResult = {
  data: Trip[];
  meta: TripsMeta;
};

export type TripPayload = {
  company_id: string;
  name: string;
  trip_number?: string;
  type?: TripType;
  capacity?: number;
  preparation_wave_id?: string | null;
  distribution_zone_id?: number | null;
  shipping_company_id?: number | null;
  driver_vehicle_assignment_id?: number | null;
  notes?: string | null;
};

export type TripDispatchReadiness = {
  is_ready: boolean;
  blockers: string[];
  has_full_driver_acceptance: boolean;
};

export type TripDriverAcceptancePayload = {
  products: boolean;
  custody: boolean;
  equipment: boolean;
  discrepancy_notes?: string | null;
};
