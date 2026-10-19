/**
 * EPIC-LOG-V2-001 Phase 1 — Fleet Operations
 *
 * Fleet owns vehicle CONDITION. Identity — plate, VIN, capacity, type — lives in
 * logistics_vehicles (LOG-003) and appears here only as a read-only projection
 * under `vehicle`. Nothing in Fleet duplicates it (Directive 2).
 *
 * D8: cost here is OPERATIONAL. Accounting remains the financial authority and
 * Distribution remains the Single Cash Authority — no settlement figure appears
 * in these types by design.
 */

export type FleetUnitLifecycle =
  | 'draft'
  | 'commissioning'
  | 'active'
  | 'suspended'
  | 'decommissioning'
  | 'retired';

export type FitnessLevel = 'fit' | 'fit_with_warnings' | 'unfit';

export type WorkOrderStatus = 'planned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type InspectionStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'abandoned';

export type InspectionKind = 'pre_trip' | 'post_trip' | 'periodic' | 'statutory' | 'incident';

export type DefectStatus =
  | 'open'
  | 'acknowledged'
  | 'in_repair'
  | 'resolved'
  | 'reopened'
  | 'dismissed';

export type DefectSeverity = 'minor' | 'major' | 'critical';

export type FuelTransactionStatus =
  | 'captured'
  | 'validated'
  | 'reconciled'
  | 'disputed'
  | 'written_off'
  | 'rejected';

export type MaintenanceTrigger = 'distance' | 'time' | 'engine_hours';

export type OdometerSource = 'maintenance' | 'fuel_stop' | 'inspection' | 'manual' | 'telemetry';

export type CostType =
  | 'fuel'
  | 'maintenance'
  | 'inspection'
  | 'insurance'
  | 'licensing'
  | 'depreciation'
  | 'tyres'
  | 'other';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface EnumOption<T extends string = string> {
  value: T;
  label: string;
}

export interface TriggerOption extends EnumOption<MaintenanceTrigger> {
  unit: string;
}

export interface InspectionKindOption extends EnumOption<InspectionKind> {
  is_mandatory: boolean;
}

export interface FleetOptions {
  lifecycle_states: EnumOption<FleetUnitLifecycle>[];
  fitness_levels: EnumOption<FitnessLevel>[];
  work_order_statuses: EnumOption<WorkOrderStatus>[];
  inspection_statuses: EnumOption<InspectionStatus>[];
  inspection_kinds: InspectionKindOption[];
  defect_statuses: EnumOption<DefectStatus>[];
  defect_severities: EnumOption<DefectSeverity>[];
  fuel_statuses: EnumOption<FuelTransactionStatus>[];
  maintenance_triggers: TriggerOption[];
  odometer_sources: EnumOption<OdometerSource>[];
  cost_types: EnumOption<CostType>[];
}

export interface FleetStats {
  total: number;
  draft: number;
  commissioning: number;
  active: number;
  suspended: number;
  decommissioning: number;
  retired: number;
  open_critical_defects: number;
  open_work_orders: number;
  overdue_maintenance: number;
  /** Distance is the denominator of most cost metrics — silence is a signal. */
  stale_odometer: number;
}

/**
 * The readiness answer, with its ordered reasons.
 *
 * A screen that says "unfit" without saying why is not acceptable, so the
 * blockers travel with the verdict rather than requiring a second call.
 */
export interface FitnessVerdict {
  level: FitnessLevel;
  level_label: string;
  tone: Tone;
  is_assignable: boolean;
  blockers: string[];
  warnings: string[];
}

export interface HealthFactor {
  weight: number;
  score: number;
  note: string;
}

export interface HealthScore {
  value: number;
  band: 'good' | 'fair' | 'poor' | 'critical';
  weakest_factor: string | null;
  factors: Record<string, HealthFactor>;
}

/** Read-only projection of the V1 vehicle. Fleet stores none of this. */
export interface VehicleRef {
  id: number;
  uuid: string;
  vehicle_code: string | null;
  plate_number: string | null;
  name: string | null;
  type: string | null;
  status: string | null;
  fuel_type: string | null;
  capacity_orders: number | null;
}

export interface MaintenanceRule {
  id: number;
  trigger: MaintenanceTrigger;
  trigger_label: string;
  interval_value: number;
  unit: string;
  is_active: boolean;
}

export interface MaintenancePlan {
  id: string;
  uuid: string;
  fleet_unit_id: number;
  maintenance_type: string;
  name: string;
  description: string | null;
  next_due_km: number | null;
  next_due_date: string | null;
  last_performed_km: number | null;
  last_performed_date: string | null;
  grace_days: number;
  grace_km: number;
  is_due: boolean;
  is_overdue: boolean;
  days_until_due: number | null;
  km_until_due: number | null;
  is_active: boolean;
  is_open: boolean;
  rules?: MaintenanceRule[];
  created_at: string | null;
}

export interface WorkOrder {
  id: string;
  uuid: string;
  fleet_unit_id: number;
  maintenance_plan_id: number | null;
  status: WorkOrderStatus;
  status_label: string;
  is_open: boolean;
  allowed_transitions: EnumOption<WorkOrderStatus>[];
  maintenance_type: string;
  kind: string;
  description: string | null;
  is_immobilising: boolean;
  scheduled_for: string | null;
  vendor: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_hours: number | null;
  odometer_at_start_km: number | null;
  odometer_at_completion_km: number | null;
  distance_km: number | null;
  cost: number | null;
  currency: string | null;
  /** Receipt from LOG-003's VehicleMaintenanceService. */
  v1_maintenance_record_id: number | null;
  is_mirrored_to_v1: boolean;
  cancellation_reason: string | null;
  created_at: string | null;
}

export interface Defect {
  id: string;
  uuid: string;
  fleet_unit_id: number;
  inspection_id: number | null;
  work_order_id: number | null;
  status: DefectStatus;
  status_label: string;
  is_outstanding: boolean;
  allowed_transitions: EnumOption<DefectStatus>[];
  severity: DefectSeverity;
  severity_label: string;
  severity_tone: Tone;
  blocks_fitness: boolean;
  requires_override_to_dismiss: boolean;
  title: string;
  description: string | null;
  photos: string[];
  reported_at: string | null;
  reported_by: number | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_by: number | null;
  age_days: number;
  dismissal_reason: string | null;
  dismissed_by: number | null;
  created_at: string | null;
}

export interface InspectionResultItem {
  id: number;
  item_code: string;
  item_label: string;
  passed: boolean;
  failure_severity: DefectSeverity;
  is_critical_failure: boolean;
  comment: string | null;
  photos: string[];
}

export interface Inspection {
  id: string;
  uuid: string;
  fleet_unit_id: number;
  template_id: number | null;
  /** Snapshotted so a historical inspection reads exactly as performed. */
  template_version: number | null;
  status: InspectionStatus;
  status_label: string;
  is_immutable: boolean;
  allowed_transitions: EnumOption<InspectionStatus>[];
  kind: InspectionKind;
  kind_label: string;
  is_mandatory_kind: boolean;
  odometer_km: number | null;
  has_critical_failure: boolean;
  failed_item_count: number;
  performed_at: string | null;
  performed_by: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_by: number | null;
  notes: string | null;
  rejection_reason: string | null;
  results?: InspectionResultItem[];
  created_at: string | null;
}

export interface InspectionTemplateItem {
  id: number;
  code: string;
  label: string;
  guidance: string | null;
  is_mandatory: boolean;
  requires_photo_on_fail: boolean;
  failure_severity: DefectSeverity;
  blocks_fitness_on_fail: boolean;
}

export interface InspectionTemplate {
  id: string;
  uuid: string;
  code: string;
  name: string;
  kind: InspectionKind;
  kind_label: string;
  version: number;
  fleet_group_id: number | null;
  items: InspectionTemplateItem[];
}

export interface FuelTransaction {
  id: string;
  uuid: string;
  fleet_unit_id: number;
  fuel_card_id: number | null;
  status: FuelTransactionStatus;
  status_label: string;
  is_terminal: boolean;
  posts_cost: boolean;
  allowed_transitions: EnumOption<FuelTransactionStatus>[];
  source: string;
  litres: number;
  cost: number;
  currency: string;
  price_per_litre: number | null;
  odometer_km: number;
  efficiency_l_per_100km: number | null;
  has_anomaly: boolean;
  anomaly_flags: string[];
  station: string | null;
  reference_number: string | null;
  transacted_at: string | null;
  reconciled_at: string | null;
  reconciled_by: number | null;
  photos: string[];
  notes: string | null;
  resolution_reason: string | null;
  created_at: string | null;
}

export interface OdometerReadingRow {
  id: number;
  reading_km: number;
  source: OdometerSource;
  source_label: string;
  is_accepted: boolean;
  rejection_reason: string | null;
  source_reference: string | null;
  recorded_at: string | null;
}

export interface FleetUnit {
  id: string;
  uuid: string;
  company_id: string | null;
  vehicle_id: number;
  vehicle?: VehicleRef;
  lifecycle_state: FleetUnitLifecycle;
  lifecycle_label: string;
  lifecycle_tone: Tone;
  lifecycle_reason: string | null;
  allowed_transitions: EnumOption<FleetUnitLifecycle>[];
  fitness: FitnessVerdict;
  current_odometer_km: number | null;
  odometer_updated_at: string | null;
  group?: {
    id: string;
    code: string;
    name: string;
    fleet: { id: string; name: string; is_own_fleet: boolean } | null;
  };
  open_defect_count?: number;
  open_work_order_count?: number;
  acquisition_cost: number | null;
  currency: string | null;
  acquisition_date: string | null;
  monthly_depreciation: number | null;
  commissioned_at: string | null;
  retired_at: string | null;
  notes: string | null;
  maintenance_plans?: MaintenancePlan[];
  defects?: Defect[];
  work_orders?: WorkOrder[];
  created_at: string | null;
  updated_at: string | null;
}

export interface CostSummary {
  from: string;
  to: string;
  total: number;
  currency: string;
  by_type: Record<CostType, number>;
  distance_km: number | null;
  /** Null, never zero, when distance is unknown — see VehicleCostService. */
  cost_per_km: number | null;
  entry_count: number;
}

export interface FuelEfficiency {
  from: string;
  to: string;
  transaction_count: number;
  total_litres: number;
  total_cost: number;
  distance_km: number | null;
  l_per_100km: number | null;
  cost_per_km: number | null;
  anomaly_count: number;
}

export interface FleetUnitsQuery {
  lifecycle_state?: FleetUnitLifecycle | 'all';
  fleet_group_id?: number;
  vehicle_id?: number;
  has_critical_defect?: boolean;
  has_open_work_order?: boolean;
  page?: number;
  per_page?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export type FleetUnitsResult = Paginated<FleetUnit>;

// ── Payloads ─────────────────────────────────────────────────────────────────

export interface RegisterUnitPayload {
  vehicle_id: number;
  fleet_group_id?: number | null;
  acquisition_cost?: number | null;
  currency?: string | null;
  acquisition_date?: string | null;
  useful_life_months?: number | null;
  notes?: string | null;
}

export interface MaintenancePlanPayload {
  maintenance_type: string;
  name: string;
  description?: string | null;
  grace_days?: number;
  grace_km?: number;
  rules: { trigger: MaintenanceTrigger; interval_value: number }[];
}

export interface CompleteWorkOrderPayload {
  odometer_km: number;
  cost: number;
  currency?: string;
  description?: string | null;
}

export interface FuelCapturePayload {
  litres: number;
  cost: number;
  currency?: string;
  odometer_km: number;
  station?: string | null;
  reference_number?: string | null;
  transacted_at?: string | null;
  notes?: string | null;
}

export interface InspectionAnswer {
  passed: boolean;
  comment?: string | null;
  photos?: string[];
}
