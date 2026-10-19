export type PurchaseRecordType = 'material_request' | 'purchase';

export type PurchaseSourceType = 'material_request' | 'direct' | 'reorder' | 'ai' | 'manual';

export type PurchaseMaterialStatus =
  | 'draft'
  | 'under_review'
  | 'waiting_supplier_selection'
  | 'approved'
  | 'purchasing'
  | 'receiving'
  | 'completed'
  | 'rejected'
  | 'on_hold'
  | 'cancelled';

export type PurchaseMaterialPriority = 'low' | 'normal' | 'high' | 'urgent';

export type PurchaseMaterialProduct = {
  id: string;
  sku: string;
  name: string;
  image_url: string | null;
  average_cost: number | null;
};

export type PurchaseMaterialLine = {
  id: string;
  purchase_material_id: string;
  product_id: string;
  product: PurchaseMaterialProduct | null;
  requested_qty: number;
  unit_label: string | null;
  notes: string | null;
  supplier_id: string | null;
  supplier: { id: string; name: string } | null;
  agreed_price: number | null;
  agreed_qty: number | null;
  lead_time_days: number | null;
  supplier_selected_at: string | null;
  supplier_selected_by: string | null;
};

export type PurchaseMaterial = {
  id: string;
  request_number: string;
  record_type: PurchaseRecordType;
  source_type: PurchaseSourceType | null;
  company_id: string | null;
  company: { id: string; name: string } | null;
  channel_id: string | null;
  channel: { id: string; name: string; code: string } | null;
  warehouse_id: string;
  warehouse: { id: string; name: string } | null;
  status: PurchaseMaterialStatus;
  status_label: string;
  priority: PurchaseMaterialPriority;
  priority_label: string;
  requested_by: string | null;
  assigned_buyer: string | null;
  required_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  estimated_value: number;
  approved_value: number;
  purchased_value: number;
  approved_by: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  review_notes: string | null;
  merged_into: string | null;
  clarification_requested_at: string | null;
  clarification_requested_by: string | null;
  items_count: number;
  total_requested_qty: number;
  lines?: PurchaseMaterialLine[];
  created_at: string | null;
  updated_at: string | null;
};

export type PurchaseMaterialsQuery = {
  search?: string;
  record_type?: PurchaseRecordType;
  status?: PurchaseMaterialStatus | 'all';
  priority?: PurchaseMaterialPriority | 'all';
  warehouse_id?: string;
  company_id?: string;
  channel_id?: string;
  assigned_buyer?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PurchaseMaterialsResult = {
  items: PurchaseMaterial[];
  meta: PaginationMeta;
};

export type PurchaseMaterialLinePayload = {
  product_id: string;
  requested_qty: number;
  unit_label?: string | null;
  notes?: string | null;
};

export type CreatePurchaseMaterialPayload = {
  warehouse_id: string;
  company_id?: string | null;
  channel_id?: string | null;
  priority?: PurchaseMaterialPriority;
  required_date?: string | null;
  notes?: string | null;
  record_type?: PurchaseRecordType;
  source_type?: PurchaseSourceType | null;
  lines: PurchaseMaterialLinePayload[];
};

export type UpdatePurchaseMaterialPayload = CreatePurchaseMaterialPayload;

// ── Stats ─────────────────────────────────────────────────────────────────────

export type PurchaseMaterialStats = {
  operational: {
    draft: number;
    under_review: number;
    waiting_supplier_selection: number;
    approved: number;
    purchasing: number;
    receiving: number;
  };
  financial: {
    total_estimated_value: number;
    total_approved_value: number;
    total_purchased_value: number;
    outstanding_value: number;
  };
  by_priority: {
    urgent: number;
    high: number;
    normal: number;
    low: number;
  };
};

// ── Procurement Panel ─────────────────────────────────────────────────────────

export type ProcurementPanelRecommendation = {
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  recommended_qty: number | null;
};

export type AlternativeSupplier = {
  supplier_id: string;
  supplier_name: string;
  last_price: number | null;
  last_delivery_date: string | null;
  lead_time_days: number | null;
  moq: number | null;
};

// ── Comprehensive Demand Analysis ─────────────────────────────────────────────
// Full enterprise data returned by GET /demand-analysis/{product}

export type InventoryHealth = {
  on_hand: number;
  reserved: number;
  available: number;
  incoming: number;
  in_transfer: number;
  damaged: number | null;
  expired: number | null;
  near_expiry: number | null;
  quarantine: number | null;
};

export type DemandIntelligence = {
  daily_avg: number;
  weekly_avg: number;
  monthly_avg: number;
  rolling_90d_avg: number;
  trend: 'normal' | 'higher' | 'lower';
  volatility: number | null;
  peak_consumption: number;
  seasonality: null;
};

export type CoverageIntelligence = {
  current_coverage_days: number | null;
  risk: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  stockout_date: string | null;
  suggested_purchase_date: string | null;
  safety_stock: number | null;
  min_stock: number | null;
  max_stock: number | null;
  reorder_point: number | null;
  coverage_trend: string;
};

export type ProcurementIntelligence = {
  preferred_supplier: AlternativeSupplier | null;
  last_purchase: { supplier_id: string | null; supplier_name: string | null; last_price: number | null; purchase_date: string | null; } | null;
  alternative_suppliers: AlternativeSupplier[];
  last_cost: number | null;
  avg_cost: number | null;
  lowest_cost: number | null;
  highest_cost: number | null;
  lead_time_days: number | null;
  moq: number | null;
  last_purchase_date: string | null;
  purchase_frequency: number | null;
  price_trend: 'rising' | 'falling' | 'stable' | null;
};

export type BusinessImpact = {
  warehouses_carrying: number;
  total_inventory_value: number;
  selling_channels: number | null;
  companies_count: number | null;
  open_orders: number | null;
  reserved_qty: number;
  backordered_qty: number | null;
  pending_preparation: number | null;
  sales_last_7d: number;
  sales_last_30d: number;
  revenue_last_30d: number | null;
  estimated_stockout_date: string | null;
};

export type DemandTimelineEvent = {
  type: 'inventory_event' | 'purchase_event';
  subtype: string;
  date: string;
  description: string;
  quantity: number;
  supplier: string | null;
  value: number | null;
};

export type DemandAnalysisData = {
  product_id: string;
  inventory_health: InventoryHealth;
  demand_intelligence: DemandIntelligence;
  coverage_intelligence: CoverageIntelligence;
  procurement_intelligence: ProcurementIntelligence;
  business_impact: BusinessImpact;
  recommendations: ProcurementPanelRecommendation[];
  timeline: DemandTimelineEvent[];
};

export type ProductProcurementPanel = {
  product_id: string;
  inventory: {
    on_hand_qty: number;
    reserved_qty: number;
    available_qty: number;
  };
  consumption: {
    daily_avg: number;
    weekly_avg: number;
    monthly_avg: number;
    trend: 'normal' | 'higher' | 'lower';
  };
  coverage: {
    days_remaining: number | null;
    risk: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  };
  last_purchase: {
    supplier_name: string | null;
    last_price: number | null;
    purchase_date: string | null;
  } | null;
  alternative_suppliers: AlternativeSupplier[];
  recommendations: ProcurementPanelRecommendation[];
};
