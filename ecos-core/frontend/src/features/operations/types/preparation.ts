// ── Enums ─────────────────────────────────────────────────────────────────────

export type WaveStatus =
  | 'draft'
  | 'collecting'
  | 'planning'
  | 'shortage_blocked'
  | 'preparing'
  | 'completed'
  | 'closed'
  | 'cancelled';

export type WaveItemStatus = 'pending' | 'in_progress' | 'prepared' | 'short' | 'blocked';
export type QualityStatus = 'pending_review' | 'passed' | 'failed';
export type StationType = 'picking' | 'assembly' | 'quality_check' | 'packaging' | 'storage';
export type StationStatus = 'active' | 'inactive' | 'maintenance';
export type WorkerRole = 'operator' | 'supervisor' | 'quality_checker' | 'lead_picker';
export type ExceptionSeverity = 'blocking' | 'high' | 'medium' | 'low';
export type ExceptionStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';
export type PoolMovementType =
  | 'created'
  | 'reserved'
  | 'reservation_released'
  | 'loaded'
  | 'quality_failed'
  | 'reallocated';

// ── Core Entities ─────────────────────────────────────────────────────────────

export type PreparationWave = {
  id: string;
  company_id: string;
  warehouse_id: string;
  wave_number: string;
  status: WaveStatus;
  planning_date: string;
  orders_count: number;
  products_count: number;
  total_units_required: number;
  total_units_prepared: number;
  completion_pct: number;
  shortage_detected: boolean;
  config_version_id: string | null;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // Loaded relations
  wave_items?: PreparationWaveItem[];
  orders?: PreparationWaveOrder[];
  material_requirements?: PreparationMaterialRequirement[];
  exceptions?: PreparationException[];
  workers?: PreparationWaveWorker[];
  pick_list?: PreparationPickList | null;
};

export type PreparationWaveItem = {
  id: string;
  preparation_wave_id: string;
  product_id: string;
  sku_snapshot: string;
  name_snapshot: string;
  quantity_required: number;
  quantity_prepared: number;
  quantity_short: number;
  status: WaveItemStatus;
  completion_pct: number;
  zone: string | null;
  shelf_location: string | null;
};

export type PreparationWaveOrder = {
  id: string;
  preparation_wave_id: string;
  order_id: string;
  order_number: string;
  customer_name_snapshot: string | null;
  delivery_zone: string | null;
  added_at: string;
};

export type PreparationMaterialRequirement = {
  id: string;
  preparation_wave_id: string;
  raw_material_id: string;
  material_name_snapshot: string;
  unit_snapshot: string;
  quantity_required: number;
  quantity_available: number;
  quantity_to_purchase: number;
  shortage: boolean;
  resolved: boolean;
};

export type PreparationProductionRequirement = {
  id: string;
  preparation_wave_id: string;
  product_id: string;
  sku_snapshot: string;
  quantity_to_produce: number;
  status: 'pending' | 'job_created' | 'manufacturing' | 'ready';
  manufacturing_job_id: string | null;
  quantity_produced: number | null;
};

export type PreparationPickList = {
  id: string;
  preparation_wave_id: string;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to: string | null;
  items: PreparationPickListItem[];
};

export type PreparationPickListItem = {
  id: string;
  preparation_pick_list_id: string;
  product_id: string;
  sku_snapshot: string;
  name_snapshot: string;
  quantity_to_pick: number;
  quantity_picked: number;
  status: 'pending' | 'in_progress' | 'picked' | 'short';
  zone: string | null;
  shelf_location: string | null;
};

export type PreparationWaveWorker = {
  id: string;
  preparation_wave_id: string;
  user_id: string;
  user_name?: string;
  role: WorkerRole;
  assigned_at: string;
  released_at: string | null;
};

export type PreparationException = {
  id: string;
  preparation_wave_id: string;
  company_id: string;
  exception_type: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  resolution_notes: string | null;
  raised_by: string | null;
  resolved_by: string | null;
  raised_at: string;
  resolved_at: string | null;
};

export type PreparationStation = {
  id: string;
  name: string;
  name_ar: string | null;
  station_type: StationType;
  zone: string | null;
  capacity: number | null;
  status: StationStatus;
  current_workers: number;
};

export type PreparedPoolEntry = {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  preparation_wave_number: string | null;
  quantity_available: number;
  quantity_reserved: number;
  quantity_loaded: number;
  quality_status: QualityStatus;
  quality_checked_at: string | null;
  prepared_at: string | null;
};

export type PreparedPoolMovement = {
  id: string;
  prepared_pool_id: string;
  movement_type: PoolMovementType;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  recorded_at: string;
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export type PreparationDashboard = {
  planning_date: string;
  kpis: {
    waves_total: number;
    waves_by_status: Record<WaveStatus, number>;
    orders_in_preparation: number;
    products_required: number;
    units_required: number;
    units_prepared: number;
    completion_pct: number;
    open_exceptions: number;
    pool_available_units: number;
    workers_active: number;
  };
  active_waves: Array<{
    id: string;
    wave_number: string;
    status: WaveStatus;
    orders_count: number;
    completion_pct: number;
    shortage_detected: boolean;
    started_at: string | null;
  }>;
  alerts: Array<{
    type: string;
    severity: string;
    wave_id: string;
    message: string;
  }>;
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export type PreparationAnalytics = {
  period: { from: string; to: string };
  summary: {
    waves_created: number;
    waves_completed: number;
    waves_cancelled: number;
    avg_completion_time_minutes: number;
    avg_completion_pct: number;
    shortage_rate_pct: number;
    total_units_prepared: number;
  };
  daily: Array<{
    date: string;
    waves: number;
    units_prepared: number;
    avg_minutes: number;
  }>;
  top_shorted_products: Array<{
    product_id: string;
    sku: string;
    shortage_occurrences: number;
    avg_shortage_pct: number;
  }>;
};

// ── Worker status ─────────────────────────────────────────────────────────────

export type WorkerStatus = {
  user_id: string;
  name: string;
  role: WorkerRole;
  wave_id: string;
  wave_number: string;
  wave_status: WaveStatus;
  assigned_at: string;
  status: 'active';
};

// ── Query/mutation payloads ────────────────────────────────────���──────────────

export type WavesQuery = {
  status?: WaveStatus | 'all';
  warehouse_id?: string;
  planning_date?: string;
  search?: string;
  page?: number;
  per_page?: number;
};

export type WavesMeta = {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type WavesResult = {
  data: PreparationWave[];
  meta: WavesMeta;
};

export type CreateWavePayload = {
  warehouse_id: string;
  planning_date: string;
  order_ids: string[];
  notes?: string;
};

export type StartPreparationPayload = {
  worker_ids?: string[];
  supervisor_id?: string;
  station_ids?: string[];
  override_shortage?: boolean;
};

export type CompleteProductPayload = {
  quantity_prepared: number;
};

export type CancelWavePayload = {
  reason: string;
};

export type RecalculateWavePayload = {
  remove_order_ids?: string[];
  add_order_lines?: Array<{
    order_id: string;
    order_number: string;
    confirmed_at: string;
    customer_name?: string;
    delivery_zone?: string;
  }>;
};

export type PoolQuery = {
  warehouse_id: string;
  quality_status?: QualityStatus;
  available_only?: boolean;
  page?: number;
  per_page?: number;
};

export type PoolResult = {
  data: PreparedPoolEntry[];
  meta: WavesMeta;
};

// ── Session types (CR-PREP-001) ───────────────────────────────────────────────

export type SessionStatus =
  | 'draft'
  | 'planning'
  | 'in_progress'
  | 'paused'
  | 'frozen'
  | 'completed'
  | 'approved'
  | 'closed'
  | 'cancelled';

export type PreparationIssueType =
  | 'missing_material'
  | 'damaged_material'
  | 'quality_issue'
  | 'recipe_mismatch'
  | 'negative_stock'
  | 'manual_adjustment';

export type PreparationSession = {
  id: string;
  company_id: string;
  warehouse_id: string;
  session_number: string;
  status: SessionStatus;
  planning_date: string;
  operator_id: string | null;
  supervisor_id: string | null;
  auto_created: boolean;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  frozen_at: string | null;
  approved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  // computed / enriched
  orders_count: number;
  products_count: number;
  waves_count: number;
  completion_pct: number;
  total_units_required: number;
  total_units_prepared: number;
};

export type TodaySessionKpis = {
  orders: number;
  products: number;
  prepared: number;
  blocked: number;
  remaining: number;
  prepared_pct: number;
};

export type TodaySessionWarehouse = {
  warehouse_id: string;
  warehouse_name: string;
  session: PreparationSession | null;
  kpis: TodaySessionKpis;
};

export type TodaySessionsResponse = {
  date: string;
  data: TodaySessionWarehouse[];
};

export type SessionsQuery = {
  warehouse_id?: string;
  status?: SessionStatus | 'all';
  planning_date?: string;
  search?: string;
  page?: number;
  per_page?: number;
};

export type SessionsResult = {
  data: PreparationSession[];
  meta: WavesMeta;
};

export type CreateSessionPayload = {
  warehouse_id: string;
  planning_date: string;
  operator_id?: string;
  supervisor_id?: string;
  notes?: string;
};

export type CancelSessionPayload = {
  reason: string;
};

export type AddWaveToSessionPayload = {
  wave_id: string;
};

export type ReportIssuePayload = {
  issue_type: PreparationIssueType;
  description: string;
  entity_type?: string;
  entity_id?: string;
};

export type CreateAssignmentPolicyPayload = {
  warehouse_id: string;
  name: string;
  priority?: number;
  rules: Record<string, unknown>;
  is_active?: boolean;
};

export type OverrideWarehousePayload = {
  warehouse_id: string;
  reason: string;
};

// ── Enterprise types (Phases 6, 8, 9, 13) ────────────────────────────────────

export type EnterpriseQueueItem = {
  order_id: string;
  order_number: string;
  wave_id: string | null;
  priority: number;
  status: string;
};

export type EnterpriseQueueResult = {
  items: EnterpriseQueueItem[];
  meta: WavesMeta;
};

export type CapacityPlanningResult = {
  warehouse_id: string;
  planning_date: string;
  capacity: Record<string, unknown>;
};

export type OptimizationSuggestion = {
  id: string;
  type: string;
  priority: number;
  message: string;
  metadata: Record<string, unknown> | null;
};

export type EnterpriseDashboardResult = {
  planning_date: string;
  warehouses: Record<string, unknown>[];
  kpis: Record<string, number>;
};

export type ProductWorkspace = {
  item: PreparationWaveItem & { sku: string; product_id: string };
  product: { id: string; name: string; sku: string; unit_symbol: string; image_url: string | null } | null;
  recipe: {
    id: string;
    recipe_cost: number | null;
    material_lines: Array<{
      id: string;
      material_name: string;
      material_sku: string;
      unit_symbol: string;
      quantity: number;
      waste_percentage: number;
    }>;
  } | null;
  materials: Array<{
    id: string;
    raw_material_id: string;
    quantity_needed: number;
    quantity_on_hand: number;
    shortage_flag: boolean;
    shortage_qty: number;
  }>;
  orders: Array<{
    order_id: string;
    order_number: string;
    customer_name: string | null;
    quantity: number;
    delivery_zone: string | null;
  }>;
};

export type SessionProduct = {
  product_id: string;
  sku: string;
  name: string;
  product_name: string;
  quantity_required: number;
  quantity_prepared: number;
  total_quantity_needed: number;
  unit: string;
  orders_count: number;
  status: WaveItemStatus;
};

export type SessionOrder = {
  id: string;
  order_number: string;
  customer_name: string | null;
  area: string | null;
  governorate: string | null;
  attachment_source: 'auto' | 'manual_supervisor' | string;
  attached_at: string;
};

export type SessionOrdersResult = {
  data: SessionOrder[];
  meta: WavesMeta;
};

export type SessionConsolidation = {
  session_id: string;
  products: SessionProduct[];
  total_orders: number;
  total_units: number;
};

export type AssignmentPolicy = {
  id: string;
  warehouse_id: string;
  name: string;
  priority: number;
  rules: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};

// ── Demand Engine Read Models (TASK-PREP-INTEGRATION-001) ────────────────────

export type WaveKpiReadModel = {
  preparation_wave_id: string;
  orders_count: number;
  products_count: number;
  materials_count: number;
  missing_materials_count: number;
  prepared_count: number;
  remaining_count: number;
  completion_pct: number;
  last_calculated_at: string | null;
};

export type WaveProductDemandItem = {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string | null;
  required_qty: number;
  prepared_qty: number;
  remaining_qty: number;
  orders_count: number;
  completion_pct: number;
  last_calculated_at: string | null;
};

export type WaveMaterialDemandItem = {
  id: string;
  material_id: string;
  material_name: string;
  material_sku: string | null;
  required_qty: number;
  available_qty: number;
  reserved_qty: number;
  expected_today: number;
  in_transit_qty: number;
  missing_qty: number;
  coverage_pct: number;
  last_calculated_at: string | null;
};

export type WaveMissingMaterialItem = {
  id: string;
  material_id: string;
  material_name: string;
  missing_qty: number;
  affected_orders_count: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  procurement_status: string | null;
  last_calculated_at: string | null;
};

export type WaveManufacturingDemandItem = {
  id: string;
  product_id: string;
  product_name: string;
  required_qty: number;
  planned_qty: number;
  manufacturing_qty: number;
  completed_qty: number;
  remaining_qty: number;
  last_calculated_at: string | null;
};

export type WaveOrderEntry = {
  id: string;
  order_id: string;
  order_number: string;
  customer_name_snapshot: string | null;
  delivery_zone_snapshot: string | null;
  governorate_snapshot: string | null;
  zone_code_snapshot: string | null;
  shipping_cost_snapshot: number | null;
  payment_status_snapshot: string | null;
  preparation_priority: number;
  is_paid: boolean;
  added_at: string;
};

// ── Timeline / Documents / new payloads ───────────────────────────────────────

export type TimelineEntry = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  actor_name: string | null;
  actor_type: string | null;
  metadata: Record<string, unknown> | null;
  source_module: string | null;
  occurred_at: string;
};

export type DocumentEntry = {
  id: string;
  title: string;
  document_type: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  url: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type ApproveWavePayload = {
  notes?: string;
};

export type AssignWorkerPayload = {
  user_id: string;
  role: WorkerRole;
};

export type ResolveShortagePayload = {
  requirement_ids: string[];
  notes?: string;
};

export type UpdatePoolQualityPayload = {
  quality_result: 'passed' | 'failed';
  notes?: string;
};
