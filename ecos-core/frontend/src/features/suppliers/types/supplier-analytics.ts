import type { ProcurementHealth } from './supplier';

export type SupplierAnalytics = {
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  // Purchasing totals
  total_purchases: number;
  total_invoiced: number;
  total_paid: number;
  outstanding_balance: number;
  last_purchase_date: string | null;
  // Inventory
  current_inventory_quantity: number;
  current_inventory_cost_value: number;
  current_inventory_sale_value: number;
  potential_gross_profit: number;
  inventory_remaining_margin_percent: number;
  // Performance metrics
  avg_lead_time_days: number | null;
  on_time_delivery_rate: number | null;
  fill_rate: number | null;
  active_pos_count: number;
  pending_grs_count: number;
  total_products_supplied: number;
};

export type SupplierInventoryProduct = {
  product_id: string;
  product_sku: string;
  product_name: string;
  average_cost: number | null;
  sale_price: number | null;
  remaining_quantity: number;
  cost_value: number;
  sale_value: number;
  gross_profit: number;
  oldest_receipt_date: string | null;
  latest_receipt_date: string | null;
  receipt_count: number;
};

// ── Global KPI Stats ─────────────────────────────────────────────────────────

export type SupplierSummaryStats = {
  total_suppliers: number;
  active_suppliers: number;
  new_this_month: number;
  open_pos_total: number;
  delayed_pos: number;
  total_outstanding: number;
  total_inventory_value: number;
  needs_review_count: number;
};

// ── Procurement Health Score ──────────────────────────────────────────────────

export type ProcurementHealthComponents = {
  delivery_performance: number;
  fill_rate: number;
  price_stability: number;
  activity: number;
  financial_standing: number;
  inventory_impact: number;
};

export type ProcurementHealthResult = {
  supplier_id: string;
  score: number;
  tier: ProcurementHealth;
  color: string;
  trend: 'up' | 'down' | 'stable';
  components: ProcurementHealthComponents;
  weights: Record<string, number>;
};

// ── Price History ─────────────────────────────────────────────────────────────

export type SupplierPriceHistoryEntry = {
  id: string;
  date: string;
  po_number: string;
  warehouse_name: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_cost: number;
  landed_unit_cost: number | null;
  previous_price: number | null;
  price_diff_pct: number | null;
};

// ── Timeline ──────────────────────────────────────────────────────────────────

export type SupplierTimelineEventType =
  | 'supplier_created'
  | 'supplier_updated'
  | 'po_created'
  | 'po_approved'
  | 'gr_posted'
  | 'price_change';

export type SupplierTimelineEvent = {
  id: string;
  type: SupplierTimelineEventType;
  title: string;
  description: string | null;
  reference: string | null;
  actor: string | null;
  occurred_at: string;
};

// ── Documents ─────────────────────────────────────────────────────────────────

export type SupplierDocumentType =
  | 'commercial_registration'
  | 'tax_card'
  | 'contract'
  | 'certificate'
  | 'attachment';

export type SupplierDocument = {
  id: string;
  supplier_id: string;
  document_type: SupplierDocumentType;
  name: string;
  mime_type: string;
  file_size: number;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
};
