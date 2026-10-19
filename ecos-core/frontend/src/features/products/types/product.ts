export type ProductType = 'finished_good' | 'raw_material' | 'packaging_material';

export type ProductStockStatus = 'instock' | 'outofstock' | 'onbackorder';

/** Computed manufacturing availability for finished goods only. */
export type ManufacturingAvailability = 'instock' | 'outofstock' | 'recipe_missing';

export type RecipeComponent = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  waste_percentage: number;
  available_qty: number;
  is_available: boolean;
};

export type SyncStatus = 'synced' | 'pending' | 'failed' | 'not_synced';

export type ProductRef = {
  id: string;
  code: string;
  name: string;
  symbol?: string | null;
};

/** Channel summary returned when a product is mapped to one or more channels. */
export type ProductChannel = {
  id: string;
  name: string;
  platform: string;
  company_id?: string | null;
  company_name?: string | null;
  is_synced: boolean;
  last_synced_at: string | null;
};

export type ActiveRecipeSummary = {
  id: string;
  bom_number: string;
  version: string;
  /** Stored material cost (raw + packaging). Does NOT include manufacturing or other costs. */
  recipe_cost: number | null;
  manufacturing_cost: number | null;
  other_costs: number | null;
  yield_quantity: number | null;
  component_count: number;
  notes: string | null;
  updated_at: string | null;
};

export type ProductBrand = {
  id: string;
  code: string;
  name: string;
  company_id?: string | null;
  company?: { id: string; name: string } | null;
  default_target_margin?: number | null;
  default_markup?: number | null;
  default_discount_pct?: number | null;
};

export type Product = {
  id: string;
  brand_id?: string | null;
  brand?: ProductBrand | null;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string;
  category?: ProductRef;
  unit_id: string;
  unit?: ProductRef;
  product_type: ProductType;
  is_active: boolean;
  image_url: string | null;
  regular_price: number | null;
  sale_price: number | null;
  short_description: string | null;
  long_description: string | null;
  stock_status: ProductStockStatus | null;
  // Cost fields — raw stored values
  material_cost?: number | null;
  product_cost?: number | null;
  last_purchase_cost?: number | null;
  // Derived cost & margin — pre-computed by backend ProductResource (CTO Rule: no frontend calculations)
  effective_cost?: number | null;
  markup_pct?: number | null;
  gross_profit_pct?: number | null;
  final_margin_pct?: number | null;
  average_cost?: number | null;
  current_fifo_cost?: number | null;
  last_purchase_date?: string | null;
  cost_source?: string | null;
  // Inventory fields (from join)
  on_hand_qty?: number | null;
  reserved_qty?: number | null;
  available_qty?: number | null;
  inventory_value?: number | null;
  // Manufacturing flags
  can_manufacture?: boolean;
  can_disassemble?: boolean;
  allow_negative_stock?: boolean;
  // Recipe
  has_recipe?: boolean | null;
  active_recipe?: ActiveRecipeSummary | null;
  // Manufacturing availability (computed on-read for finished_good only)
  manufacturing_availability?: ManufacturingAvailability | null;
  blocking_materials?: Array<{ id: string; sku: string; name: string; available_qty: number }> | null;
  recipe_components?: RecipeComponent[] | null;
  // Pricing policy
  pricing_mode?: 'brand_policy' | 'custom' | null;
  custom_target_margin?: number | null;
  custom_markup?: number | null;
  custom_discount_pct?: number | null;
  // Lifecycle flags (from list query computed columns)
  pending_review?: boolean | null;
  // Channel fields
  channels?: ProductChannel[];
  sync_status?: SyncStatus;
  is_published?: boolean;
  woo_sku?: string | null;
  short_name?: string | null;
  // Timestamps
  created_at: string | null;
  updated_at: string | null;
};

export type ProductPayload = {
  sku: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  brand_id?: string | null;
  category_id: string;
  unit_id?: string | null;
  product_type: ProductType;
  is_active: boolean;
  image_url?: string | null;
  regular_price?: number | null;
  sale_price?: number | null;
  short_description?: string | null;
  long_description?: string | null;
  stock_status?: ProductStockStatus | null;
  manual_cost?: number | null;
  channel_ids?: string[];
  pricing_mode?: 'brand_policy' | 'custom';
  custom_target_margin?: number | null;
  custom_markup?: number | null;
  custom_discount_pct?: number | null;
};

export type ProductStockStatusFilter = 'instock' | 'outofstock' | 'onbackorder' | '';
export type ManufacturingAvailabilityFilter = ManufacturingAvailability | '';

export type ProductSortField =
  | 'sku'
  | 'name'
  | 'product_type'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
  | 'regular_price'
  | 'material_cost';

export type SortDirection = 'asc' | 'desc';
export type ProductStatusFilter = 'all' | 'active' | 'inactive';

export type ProductsQuery = {
  search?: string;
  category_id?: string;
  unit_id?: string;
  warehouse_id?: string;
  brand_id?: string;
  channel_id?: string;
  product_type?: ProductType;
  product_types?: string;
  stock_status?: ProductStockStatusFilter;
  page?: number;
  company_id?: string;     // filter via brand.company_id (post-ADR-013, no direct column)
  per_page?: number;
  sort_by?: ProductSortField;
  sort_dir?: SortDirection;
  status?: ProductStatusFilter;
  is_published?: boolean;
  low_stock?: boolean;
  out_of_stock?: boolean;
  has_images?: boolean;
  not_synced?: boolean;
  eligible_for_recipe?: boolean;
  has_recipe?: 'true' | 'false' | null;
  manufacturing_ready?: boolean;
  needs_pricing_review?: boolean;
  low_margin?: boolean;
  manufacturing_availability?: ManufacturingAvailabilityFilter;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type ProductsResult = {
  items: Product[];
  meta: PaginationMeta;
};
