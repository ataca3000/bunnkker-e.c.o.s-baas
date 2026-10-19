export type TripType = 'company_vehicle' | 'personal_vehicle' | 'external_carrier';
export type TripStatus =
  | 'planning'
  | 'loading'
  | 'loading_completed'
  | 'driver_accepted'
  | 'dispatch_blocked'
  | 'ready_for_dispatch'
  | 'out_for_delivery'
  | 'dispatched'
  | 'completed'
  | 'settlement_pending'
  | 'closed'
  | 'cancelled';
export type CapacityStatus = 'ok' | 'warning' | 'critical';
export type CustodyItemType =
  | 'cash_float'
  | 'pos_device'
  | 'ice_boxes'
  | 'ice_packs'
  | 'thermal_bags'
  | 'delivery_bags'
  | 'other';

export interface WaveSummary {
  total_orders: number;
  assigned_orders: number;
  unassigned_orders: number;
  total_value: number;
  trip_count: number;
}

export interface ActiveWave {
  id: string;
  wave_number: string;
  planning_date: string;
  status: string;
  orders_count: number;
  warehouse_id: number | null;
  created_at: string;
  summary: WaveSummary;
}

export interface BoardZone {
  zone_id: number;
  name_en: string;
  name_ar: string;
  code: string;
  color: string;
  total_orders: number;
  assigned_orders: number;
  unassigned_orders: number;
  total_value: number;
}

export interface PoolOrder {
  order_id: string;
  order_number: string;
  grand_total: number;
  status: string;
  city_name: string;
  governorate_name: string;
  delivery_zone_snapshot: string | null;
  zone_code_snapshot: string | null;
  customer_name: string;
  customer_phone: string;
}

export interface TripOrder {
  order_id: string;
  order_number: string;
  grand_total: number;
  status: string;
  customer_name: string;
  customer_phone: string;
  city_name: string;
  assignment_type: 'auto' | 'manual';
  assigned_at: string;
}

export interface FleetVehicle {
  id: number;
  plate_number: string;
  type: string;
  make: string | null;
  model: string | null;
  display_name: string;
  capacity_orders: number;
  status: string;
}

export interface FleetDriver {
  id: number;
  name_en: string;
  name_ar: string | null;
  phone: string;
  status: string;
}

export interface ExternalCarrier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  rate_per_order: number | null;
}

export interface CustodyItem {
  id: number;
  item_type: CustodyItemType;
  label: string;
  description: string | null;
  quantity: number;
  notes: string | null;
  received_quantity: number | null;
  is_driver_confirmed: boolean;
  driver_confirmed_at: string | null;
}

export interface DistributionTrip {
  id: string;
  preparation_wave_id: string;
  distribution_zone_id: number | null;
  trip_number: string;
  name: string;
  type: TripType;
  capacity: number;
  orders_count: number;
  collection_amount: number;
  capacity_usage_percent: number;
  capacity_status: CapacityStatus;
  status: TripStatus;
  notes: string | null;
  finalized_at: string | null;
  created_at: string | null;
  fleet_vehicle_id: number | null;
  fleet_driver_id: number | null;
  external_carrier_id: number | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle: FleetVehicle | null;
  driver: FleetDriver | null;
  carrier: ExternalCarrier | null;
  custody_items: CustodyItem[];
  is_ready_for_loading: boolean;
}

export interface DistributionBoardData {
  wave: ActiveWave | null;
  zones: BoardZone[];
  trips: DistributionTrip[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  ready: boolean;
  issues: ValidationIssue[];
}

export interface CreateTripPayload {
  preparation_wave_id: string;
  distribution_zone_id?: number | null;
  name?: string;
  type: TripType;
  capacity?: number;
  notes?: string;
}

export interface UpdateTripPayload {
  name?: string;
  type?: TripType;
  capacity?: number;
  notes?: string;
}

export interface AssignDriverPayload {
  fleet_driver_id?: number | null;
  driver_name?: string | null;
  driver_phone?: string | null;
}

export interface AddCustodyPayload {
  item_type: CustodyItemType;
  description?: string;
  quantity?: number;
  notes?: string;
}

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  company_vehicle:  'Company Vehicle',
  personal_vehicle: 'Personal Vehicle',
  external_carrier: 'External Carrier',
};

export const CUSTODY_ITEM_LABELS: Record<CustodyItemType, string> = {
  cash_float:    'Cash Float',
  pos_device:    'POS Device',
  ice_boxes:     'Ice Boxes',
  ice_packs:     'Ice Packs',
  thermal_bags:  'Thermal Bags',
  delivery_bags: 'Delivery Bags',
  other:         'Other',
};

// ─── Loading Manifest ─────────────────────────────────────────────────────────

export type ManifestStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ManifestItemStatus = 'pending' | 'confirmed' | 'shortage' | 'skipped';
export type ShortageResolution =
  | 'priority_allocation'
  | 'manual_selection'
  | 'return_preparation'
  | 'send_manufacturing'
  | 'delay_orders';

export type DriverItemStatus = 'pending' | 'confirmed' | 'discrepancy' | 'accepted';

export interface ManifestItem {
  id: number;
  product_id: number | null;
  product_name: string;
  product_sku: string | null;
  required_qty: number;
  loaded_qty: number | null;
  shortage_qty: number | null;
  unit: string;
  status: ManifestItemStatus;
  shortage_resolution: ShortageResolution | null;
  shortage_notes: string | null;
  confirmed_at: string | null;
  driver_received_qty: number | null;
  driver_status: DriverItemStatus;
  driver_confirmed_at: string | null;
}

export interface LoadingManifest {
  id: number;
  distribution_trip_id: string;
  status: ManifestStatus;
  total_products: number;
  confirmed_products: number;
  shortage_products: number;
  pending_products: number;
  unresolved_shortages: number;
  can_complete: boolean;
  started_at: string | null;
  completed_at: string | null;
  items: ManifestItem[];
}

export interface ManifestSummary {
  id: number;
  status: ManifestStatus;
  total_products: number;
  confirmed_products: number;
  shortage_products: number;
  can_complete: boolean;
  started_at: string | null;
  completed_at: string | null;
}

export const SHORTAGE_RESOLUTION_LABELS: Record<ShortageResolution, string> = {
  priority_allocation: 'Priority Allocation',
  manual_selection:    'Manual Selection',
  return_preparation:  'Return to Preparation',
  send_manufacturing:  'Send to Manufacturing',
  delay_orders:        'Delay Affected Orders',
};

// ─── Wave Exceptions ──────────────────────────────────────────────────────────

export interface WaveException {
  id: number;
  order_id: string;
  order_number: string;
  grand_total: number;
  reason: string;
  notes: string | null;
  returned_at: string;
  city_name: string;
  governorate_name: string;
  from_trip_number: string | null;
}

// ─── Coverage Map ─────────────────────────────────────────────────────────────

export interface CoverageOrder {
  order_id: string;
  order_number: string;
  grand_total: number;
  latitude: number | null;
  longitude: number | null;
  city_name: string;
  governorate_name: string;
  isOutlier?: boolean;
  distance?: number;
}

export interface ProductBreakdownItem {
  order_id: string;
  order_number: string;
  grand_total: number;
  quantity: number;
}

// ─── Driver Handover ──────────────────────────────────────────────────────────

export interface HandoverManifestItem {
  id: number;
  product_name: string;
  product_sku: string | null;
  loaded_qty: number | null;
  driver_received_qty: number | null;
  driver_status: DriverItemStatus;
  driver_confirmed_at: string | null;
  shortage_qty: number | null;
}

export interface HandoverManifest {
  id: number;
  status: ManifestStatus;
  total_products: number;
  driver_confirmed: number;
  driver_discrepancies: number;
  driver_pending: number;
  items: HandoverManifestItem[];
}

export interface HandoverCustodyItem {
  id: number;
  item_type: CustodyItemType;
  label: string;
  quantity: number;
  received_quantity: number | null;
  is_driver_confirmed: boolean;
  driver_confirmed_at: string | null;
}

export interface HandoverCustody {
  total: number;
  confirmed: number;
  items: HandoverCustodyItem[];
}

export interface DispatchIssue {
  message: string;
  severity: 'error' | 'warning';
}

export interface HandoverStatus {
  loading_phase: 'warehouse' | 'driver_handover';
  manifest: HandoverManifest | null;
  custody: HandoverCustody;
  can_dispatch: boolean;
  dispatch_issues: DispatchIssue[];
}

// ─── Loading OS Dashboard ─────────────────────────────────────────────────────

export type LoadingStatus =
  | 'waiting_for_loading'
  | 'loading'
  | 'loaded'
  | 'ready_for_dispatch';

export interface LoadingDashboardTrip {
  id: string;
  trip_number: string;
  name: string;
  status: TripStatus;
  loading_status: LoadingStatus;
  type: TripType;
  orders_count: number;
  collection_amount: number;
  driver_display: string;
  vehicle_plate: string;
  carrier_name: string;
  wave_number: string;
  zone_name: string;
  zone_color: string;
  manifest_id: number | null;
  manifest_status: ManifestStatus | null;
  total_products: number;
  confirmed_products: number;
  shortage_products: number;
  driver_confirmed: number;
  driver_discrepancies: number;
  driver_pending: number;
  custody_total: number;
  custody_confirmed: number;
  finalized_at: string | null;
  dispatched_at: string | null;
}

export interface LoadingDashboardData {
  trips: LoadingDashboardTrip[];
  stats: {
    total: number;
    waiting_for_loading: number;
    loading: number;
    loaded: number;
    ready_for_dispatch: number;
  };
}

export const LOADING_STATUS_LABELS: Record<LoadingStatus, string> = {
  waiting_for_loading: 'Waiting for Loading',
  loading:             'Loading',
  loaded:              'Loaded — Driver Handover',
  ready_for_dispatch:  'Ready for Dispatch',
};

export const LOADING_STATUS_COLORS: Record<LoadingStatus, string> = {
  waiting_for_loading: 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400',
  loading:             'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  loaded:              'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ready_for_dispatch:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

// ─── Trip Status Labels & Colors ──────────────────────────────────────────────

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  planning:           'Planning',
  loading:            'Loading',
  loading_completed:  'Loading Completed',
  driver_accepted:    'Driver Accepted',
  dispatch_blocked:   'Dispatch Blocked',
  ready_for_dispatch: 'Ready for Dispatch',
  out_for_delivery:   'Out for Delivery',
  dispatched:         'Dispatched',
  completed:          'Completed',
  settlement_pending: 'Settlement Pending',
  closed:             'Closed',
  cancelled:          'Cancelled',
};

export const TRIP_STATUS_COLORS: Record<TripStatus, string> = {
  planning:           'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400',
  loading:            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  loading_completed:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  driver_accepted:    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  dispatch_blocked:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  ready_for_dispatch: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  out_for_delivery:   'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  dispatched:         'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  completed:          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  settlement_pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  closed:             'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400',
  cancelled:          'bg-muted text-muted-foreground',
};

// ─── Dispatch Gate ────────────────────────────────────────────────────────────

export interface DispatchGateTripCard {
  id: string;
  trip_number: string;
  name: string;
  status: TripStatus;
  type: TripType;
  orders_count: number;
  collection_amount: number;
  driver_display: string;
  vehicle_plate: string | null;
  carrier_name: string | null;
  wave_number: string;
  zone_name: string;
  zone_color: string;
  total_products: number;
  confirmed_products: number;
  shortage_products: number;
  loading_completed_at: string | null;
  driver_acceptance_at: string | null;
  has_discrepancy: boolean;
}

export interface DispatchGateDashboardData {
  trips: DispatchGateTripCard[];
  stats: {
    total: number;
    loading_completed: number;
    driver_accepted: number;
    dispatch_blocked: number;
  };
}

export interface TripReviewProduct {
  id: number;
  product_name: string;
  product_sku: string | null;
  required_qty: number;
  loaded_qty: number | null;
  shortage_qty: number | null;
  status: ManifestItemStatus;
}

export interface TripReviewManifest {
  id: number;
  status: ManifestStatus;
  total_products: number;
  confirmed_products: number;
  shortage_products: number;
  completed_at: string | null;
  items: TripReviewProduct[];
}

export interface TripReviewCustodyItem {
  id: number;
  item_type: CustodyItemType;
  label: string;
  quantity: number;
  received_quantity: number | null;
  is_driver_confirmed: boolean;
}

export interface TripReviewCustody {
  total: number;
  confirmed: number;
  items: TripReviewCustodyItem[];
}

export interface DispatchChecklist {
  loading_completed: boolean;
  driver_accepted_products: boolean;
  driver_accepted_custody: boolean;
  driver_accepted_equipment: boolean;
  no_outstanding_shortages: boolean;
  no_outstanding_discrepancies: boolean;
  can_dispatch: boolean;
}

export interface TripAuditEntry {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  performed_by_name: string | null;
  notes: string | null;
  performed_at: string;
}

export interface DispatchGateTripDetail {
  trip: {
    id: string;
    trip_number: string;
    name: string;
    status: TripStatus;
    type: TripType;
    orders_count: number;
    collection_amount: number;
    driver_display: string;
    driver_phone: string | null;
    vehicle_plate: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    carrier_name: string | null;
    wave_number: string;
    zone_name: string;
    zone_color: string;
    finalized_at: string | null;
    driver_accepted_products: boolean;
    driver_accepted_custody: boolean;
    driver_accepted_equipment: boolean;
    driver_acceptance_at: string | null;
    accepting_user_name: string | null;
    has_discrepancy: boolean;
    discrepancy_notes: string | null;
    departure_at: string | null;
    odometer_start: number | null;
    fuel_level: number | null;
    gps_tracking_started: boolean;
  };
  manifest_summary: TripReviewManifest | null;
  custody_summary: TripReviewCustody;
  checklist: DispatchChecklist;
  audit_trail: TripAuditEntry[];
}

export interface DriverAcceptancePayload {
  products_accepted: boolean;
  custody_accepted: boolean;
  equipment_accepted: boolean;
  has_discrepancy: boolean;
  discrepancy_notes?: string;
}

export interface DeparturePayload {
  odometer_start?: number;
  fuel_level?: number;
  notes?: string;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  loading_completed:    'Loading Completed',
  driver_accepted:      'Driver Accepted',
  dispatch_blocked:     'Dispatch Blocked',
  vehicle_dispatched:   'Vehicle Dispatched',
  manifest_regenerated: 'Manifest Regenerated',
};

// ── ADR-DIST-008: Order SSOT & Distribution Sync ─────────────────────────────

export interface OrderDistributionStage {
  trip_id:          string;
  trip_number:      string;
  trip_name:        string | null;
  trip_status:      TripStatus;
  wave_id:          string | null;
  wave_number:      string | null;
  zone_code:        string | null;
  governorate:      string | null;
  /** Human-readable stage label */
  stage:            string;
  /** True if the trip is in an operationally active state */
  is_active:        boolean;
  /** List of human-readable impacts this edit will have */
  impact_list:      string[];
  /** True if a loading manifest already exists */
  manifest_exists:  boolean;
}

export interface OrderSyncEvent {
  id:                   number;
  action:               string;
  trip_stage:           string | null;
  trip_number:          string | null;
  changed_fields:       string[];
  previous_values:      Record<string, unknown>;
  new_values:           Record<string, unknown>;
  manifest_regenerated: boolean;
  notes:                string | null;
  performed_by_name:    string | null;
  synced_at:            string;
}

export interface ManifestRegenerationPayload {
  order_id: number | string;
}
