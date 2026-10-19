import type { Product, PaginationMeta } from '@/features/products/types/product';

// ─── Supplier row (used in form + payload) ────────────────────────────────────

export type SupplierRow = {
  supplier_id:        string;
  supplier_sku?:      string | null;
  lead_time_days?:    number | null;
  minimum_order_qty?: number | null;
  last_purchase_cost?: number | null;
  is_active:          boolean;
  is_default:         boolean;
};

// ─── Domain model ─────────────────────────────────────────────────────────────

export type RawMaterial = Product & {
  // Inventory quantities (aggregated from inventory_items)
  on_hand_qty?:    number | null;
  reserved_qty?:   number | null;
  available_qty?:  number | null;
  inventory_value?: number | null;

  // Inventory rules
  allow_negative_stock?:   boolean | null;
  minimum_stock?:          number | null;
  reorder_point?:          number | null;
  preferred_warehouse_id?: string | null;

  // Cost extensions
  manual_cost?:    number | null;
  cost_source?:    string | null;
  last_purchase_date?: string | null;

  // Purchasing extensions
  purchasing_supplier_id?:       string | null;
  purchasing_lead_time_days?:    number | null;
  purchasing_minimum_order_qty?: number | null;
  purchase_unit_id?:             string | null;

  // Relations
  suppliers?: SupplierRow[];

  // Notes
  internal_notes?: string | null;
};

// ─── Write payload ────────────────────────────────────────────────────────────

export type RawMaterialPayload = {
  // Core product fields
  sku:          string;
  name:         string;
  category_id:  string;
  unit_id:      string;
  product_type: 'raw_material' | 'packaging_material';
  is_active?:   boolean;
  description?: string;
  stock_status?: 'instock' | 'outofstock' | null;
  sale_price?:  null;
  image_url?:   string | null;
  regular_price?: number | null;

  // Inventory extensions
  allow_negative_stock?:   boolean;
  minimum_stock?:          number | null;
  reorder_point?:          number | null;
  preferred_warehouse_id?: string | null;

  // Cost extensions (cost_source always 'purchase' for raw materials)
  manual_cost?:  number | null;
  cost_source?:  'purchase' | null;

  // Purchasing extensions
  purchasing_supplier_id?:       string | null;
  purchasing_lead_time_days?:    number | null;
  purchasing_minimum_order_qty?: number | null;
  purchase_unit_id?:             string | null;

  // Relations
  suppliers?: SupplierRow[];

  // Notes
  internal_notes?: string | null;
};

// ─── Purchase history (from inventory_receipt_layers) ─────────────────────────
// Sourced from the existing GET /products/{id}/cost-history (receipt layers).
// This is the canonical, real purchasing history for a material — no new schema.

export type PurchaseLayer = {
  id:            string;
  receipt_date:  string | null;
  supplier:      { id: string; name: string } | null;
  goods_receipt: { id: string; receipt_number: string } | null;
  received_qty:  number;
  remaining_qty: number;
  unit_cost:     number;
  layer_value:   number;
  status:        'open' | 'consumed';
};

export type MaterialPurchaseHistory = {
  receipt_layers: PurchaseLayer[];
};

/** Derived per-supplier summary for the Suppliers tab (Supplier History). */
export type SupplierHistoryRow = {
  supplier_id:        string;
  supplier_name:      string;
  last_purchase_date: string | null;
  last_purchase_cost: number | null;
  total_received:     number;
  receipts:           number;
};

// ─── Warehouse distribution (from inventory_items, canonical) ─────────────────
// Sourced from GET /products/{id}/warehouse-distribution — availability is the
// official InventoryItem::availableQty(), not a repo/frontend calculation.

export type WarehouseDistributionRow = {
  warehouse_id:   string;
  warehouse_name: string | null;
  warehouse_code: string | null;
  on_hand_qty:    number;
  reserved_qty:   number;
  available_qty:  number;
};

export type WarehouseDistribution = {
  product_id:      string;
  warehouses:      WarehouseDistributionRow[];
  total_on_hand:   number;
  total_reserved:  number;
  total_available: number;
};

// ─── Stats ────────────────────────────────────────────────────────────────────

export type RawMaterialStats = {
  total_count:           number;
  total_on_hand:         number;
  total_reserved:        number;
  total_available:       number;
  total_inventory_value: number;
};

// ─── Query types ──────────────────────────────────────────────────────────────

export type MaterialType = 'raw_material' | 'packaging_material';

export type RawMaterialsQuery = {
  search?:        string;
  category_id?:   string;
  supplier_id?:   string;
  warehouse_id?:  string;
  material_type?: MaterialType | '';
  page?:          number;
  per_page?:      number;
  sort_by?:       'name' | 'sku' | 'material_cost' | 'on_hand_qty' | 'created_at';
  sort_dir?:      'asc' | 'desc';
  status?:        'all' | 'active' | 'inactive';
  availability?:  'available' | 'out_of_stock';
  allow_negative?: boolean;
};

export type RawMaterialsResult = {
  items: RawMaterial[];
  meta:  PaginationMeta;
};
