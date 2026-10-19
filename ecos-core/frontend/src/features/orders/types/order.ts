// ── Date presets ─────────────────────────────────────────────────────────────
export type DatePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'custom';

// ── Reservation Status (TASK-INV-RESERVATION-LIFECYCLE-001) ──────────────────
export type ReservationStatus =
  | 'pending'
  | 'reserved'
  | 'partial_reserved'
  | 'awaiting_stock'
  | 'released'
  | 'transferred'
  | 'consumed'
  | 'failed';

// ── Status ────────────────────────────────────────────────────────────────────
// V3 lifecycle (TASK-ORDERS-LIFECYCLE-ARCH-002).
// Primary flow: new → in_progress → ready_for_dispatch → out_for_delivery → delivered
// Terminal: delivered, cancelled, returned
export type OrderStatus =
  | 'new'
  | 'in_progress'
  | 'ready_for_dispatch'
  | 'out_for_delivery'
  | 'delivered'
  | 'awaiting_payment'
  | 'awaiting_stock'
  | 'scheduled'
  | 'on_hold'
  | 'cancelled'
  | 'returned';

/**
 * Official V3 status display order — applies everywhere in the UI:
 * filters, selector, dashboard, analytics, timeline, toolbar, badges, exports.
 * Do NOT reorder.
 */
export const STATUS_TAB_ORDER: Array<OrderStatus | 'all'> = [
  'all',
  'new',
  'scheduled',
  'awaiting_payment',
  'in_progress',
  'awaiting_stock',
  'ready_for_dispatch',
  'out_for_delivery',
  'delivered',
  'returned',
  'on_hold',
  'cancelled',
];

// ── Bulk action keys ─────────────────────────────────────────────────────────
// Canonical definition — shared by order-list-toolbar, use-order-labels, and orders-page.
export type BulkActionKey =
  | 'confirm'
  | 'move_to_awaiting_payment'
  | 'verify_payment'
  | 'move_to_preparation'
  | 'return_to_preparation'
  | 'awaiting_stock'
  | 'retry_reservation'
  | 'start_manufacturing'
  | 'purchase_materials'
  | 'resume'
  | 'resume_confirmed'
  | 'dispatch'
  | 'complete_delivery'
  | 'complete'
  | 'delivery_failed'
  | 'reschedule'
  | 'review'
  | 'return'
  | 'return_to_confirmed'
  | 'inspect_return'
  | 'return_to_stock'
  | 'scrap'
  | 'cancel';

// ── Sub-types ─────────────────────────────────────────────────────────────────
export type OrderChannel  = { id: string; name: string; type: string | null; brand_id: string | null };
export type CustomerStats = {
  total_orders: number;
  lifetime_value: number;
  first_order_date: string | null;
  last_order_date: string | null;
};

export type OrderCustomer = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  mobile: string | null;
  // Extended — present on GET /orders/{id} (detail endpoint only)
  email?: string | null;
  city?: string | null;
  governorate?: string | null;
  area?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
  created_at?: string | null;
  stats?: CustomerStats | null;
};
export type OrderProduct  = { id: string; sku: string; name: string; image_url: string | null; unit_name?: string | null };
export type OrderFee      = { id: string; name: string; total: number };
export type OrderCoupon   = { id: string; code: string; discount: number };

export type OrderNoteType = 'internal' | 'customer' | 'system';

export type OrderNote = {
  id: string;
  order_id: string;
  type: OrderNoteType;
  content: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  is_edited: boolean;
  edited_by_id: string | null;
  edited_by_name: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderLine = {
  id: string;
  product_id: string;
  product: OrderProduct | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  // Fulfillment quantities (PART 2)
  reserved_qty: number;
  available_qty: number;
  prepared_qty: number;
  packed_qty: number;
  loaded_qty: number;
  delivered_qty: number;
  returned_qty: number;
  cancelled_qty: number;
  warehouse_name: string | null;
  batch_number: string | null;
  // Manufacturing state
  manufacturing_state?: string | null;
  manufacturing_state_label?: string | null;
  manufacturing_started_at?: string | null;
  manufacturing_completed_at?: string | null;
};

export type OrderLocation = {
  lat: number;
  lng: number;
  label?: string | null;
  set_by?: 'customer' | 'employee' | null;
};

// ── Order ─────────────────────────────────────────────────────────────────────
export type Order = {
  id: string;
  channel_id: string | null;
  channel: OrderChannel | null;
  customer_id: string;
  customer: OrderCustomer | null;
  external_order_id: string | null;
  order_number: string;
  order_date: string;
  status: OrderStatus;
  status_label: string;
  source: string | null;
  assigned_warehouse_id: string | null;
  inventory_reserved_at: string | null;
  inventory_released_at: string | null;
  inventory_shipped_at: string | null;
  reservation_status: ReservationStatus | null;
  reservation_failure_reason: string | null;
  subtotal: number;
  shipping_total: number;
  discount_total: number;
  tax_total: number;
  total: number;

  // Canonical financial summary — resolved by API (TASK-007).
  // These unify the WooCommerce and enterprise field families.
  // All display screens read these; never the raw WC fields above.
  products_total: number;
  shipping_amount: number;
  discount_value: number;
  discount_percentage: number | null;
  tax_amount: number;
  grand_total: number;
  deposit_paid: number;
  notes: string | null;
  customer_note: string | null;
  internal_notes: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  order_notes_list: OrderNote[];

  // Billing
  billing_first_name: string | null;
  billing_last_name: string | null;
  billing_company: string | null;
  billing_country: string | null;
  billing_state: string | null;
  billing_city: string | null;
  billing_address_1: string | null;
  billing_address_2: string | null;
  billing_postcode: string | null;
  billing_phone: string | null;
  billing_email: string | null;

  // Shipping address
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_company: string | null;
  shipping_country: string | null;
  shipping_state: string | null;
  shipping_city: string | null;
  shipping_address_1: string | null;
  shipping_address_2: string | null;
  shipping_postcode: string | null;

  // Payment
  payment_method: string | null;
  payment_method_title: string | null;
  transaction_id: string | null;
  date_paid: string | null;

  // Shipping logistics
  shipping_method: string | null;
  shipping_company_name: string | null;  // carrier name (e.g. "DHL", "Aramex")
  shipping_attempts: number;             // 0 = never attempted
  tracking_number: string | null;

  // Enterprise address fields
  governorate: string | null;
  city: string | null;
  shipping_address: string | null;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  address_notes: string | null;
  area: string | null;
  google_maps_url: string | null;
  location_source: string | null;

  // Enterprise payment / financial fields
  payment_method_manual: string | null;
  payment_proof_path: string | null;
  shipping_cost: number | null;
  shipping_cost_source: string | null;
  discount_amount: number;
  discount_type: string | null;
  deposit_amount: number;
  remaining_balance: number;

  // Delivery scheduling
  requested_delivery_date: string | null;
  preferred_delivery_time: string | null;
  delivery_window_id: string | null;
  delivery_window: string | null;
  delivery_zone_id: string | null;
  delivery_zone: string | null;

  // Location (single location, either from customer or set by employee)
  location: OrderLocation | null;

  // Status tracking (optional — populated when backend supports it)
  customer_confirmed_at?: string | null;
  customer_confirmed_by?: string | null;
  confirmation_result?: 'confirmed' | 'not_answered' | 'rejected' | 'postponed' | null;
  status_entered_at?: string | null;
  status_entered_by?: string | null;
  previous_status?: OrderStatus | null;

  // Line items
  fees: OrderFee[];
  coupons: OrderCoupon[];
  lines: OrderLine[];

  // Workflow contract — backend is the single source of truth (TASK-ORDER-WORKFLOW-STATUS-API-REFINEMENT-001)
  // Frontend must never hardcode transitions, workflow names, or action keys.
  current_status: string;
  current_status_label: string;
  allowed_status_transitions: Array<{
    target_status: string;  // business state — use as Select value
    label: string;          // human-readable — display to user
    requires_reason: boolean;
    action: string;         // opaque audit field — frontend must NOT route on this
  }>;

  created_at: string | null;
  updated_at: string | null;
};

// ── Payloads ──────────────────────────────────────────────────────────────────
export type OrderLinePayload = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

export type OrderPayload = {
  channel_id?: string | null;
  customer_id: string;
  external_order_id?: string | null;
  order_date: string;
  status: OrderStatus;
  notes?: string | null;
  lines: OrderLinePayload[];
};

// ── Query params ──────────────────────────────────────────────────────────────
export type OrderSortField = 'order_number' | 'order_date' | 'status' | 'total' | 'created_at';
export type SortDirection  = 'asc' | 'desc';

// DD-025 — Customer Intelligence filter options
export type CustomerIntelligenceFilter =
  | 'first_order'
  | 'repeated'
  | 'more_than_5'
  | 'more_than_10'
  | 'has_cancelled'
  | 'has_returned'
  | 'has_rejected'
  | 'incomplete';

export type OrdersQuery = {
  search?: string;
  status?: OrderStatus | 'all';
  channel_id?: string;
  product_id?: string;
  customer_code?: string;
  phone?: string;
  external_number?: string;
  brand_id?: string;
  sku?: string;
  payment_method?: string;
  payment_status?: 'paid' | 'partial' | 'unpaid';
  has_payment_proof?: boolean;
  reservation_status?: ReservationStatus;
  shipping_company?: string;
  date_from?: string;
  date_to?: string;
  governorate?: string;
  city?: string;
  zone?: string;
  has_location?: boolean;
  min_amount?: number;
  max_amount?: number;
  min_shipping_attempts?: number;
  min_products?: number;
  customer_filter?: string;   // comma-separated CustomerIntelligenceFilter values
  customer_id?: string;
  created_by?: string;
  page?: number;
  per_page?: number;
  sort_by?: OrderSortField;
  sort_dir?: SortDirection;
};

// ── Response types ────────────────────────────────────────────────────────────
export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  total_amount?: number;
};

export type OrdersResult = {
  items: Order[];
  meta: PaginationMeta;
};

// ── Status counts (for tabs) ──────────────────────────────────────────────────
export type OrderStatusCounts = Partial<Record<OrderStatus | 'all', number>>;

// ── Shipping pricing rules ────────────────────────────────────────────────────
export type ShippingPricingRule = {
  id: string;
  company_id: string | null;
  governorate: string;
  city: string | null;
  area: string | null;
  standard_cost: number;
  express_cost: number | null;
  is_active: boolean;
};

export type ShippingCalcResult = {
  found: boolean;
  standard_cost: number | null;
  matched_level: string | null;
};

// ── Product pricing (approved price for manual orders) ────────────────────────
export type ProductPricingResult = {
  product_id: string;
  regular_price: number | null;
  sale_price: number | null;
  resolved_price: number | null;
  approved_price: number | null; // alias for resolved_price set by ResolveProductPricingAction
  source: string | null;
  has_pending_review: boolean;
};

// ── Financial snapshot ────────────────────────────────────────────────────────
export type MarginStatus = 'within_target' | 'above_target' | 'below_target';

export type OrderBusinessContextSnapshot = {
  captured_at: string | null;
  brand_context: { name: string | null };
  channel_context: { name: string | null; type: string | null };
  decision_provenance: {
    price: { source: string | null };
    cost: { source: string | null; recipe_version: string | null };
    discount: { source: string | null; manual_override: boolean };
    shipping: { zone: string | null };
  };
  customer_context: {
    delivery_success_rate: number | null;
    tier: string | null;
    segment: string | null;
  };
  policy_versions: { pricing: string | null; shipping: string | null };
  marketing_context: {
    campaign_name: string | null;
    utm_source: string | null;
    utm_medium: string | null;
  };
};

export type OrderFinancialSnapshotLine = {
  id: string;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price_at_sale: number;
  regular_price_at_sale: number | null;
  sale_price_at_sale: number | null;
  line_total: number;
  unit_cost: number | null;
  line_cost: number | null;
  raw_material_cost: number | null;
  packaging_cost: number | null;
  manufacturing_cost: number | null;
  other_cost: number | null;
  gross_profit: number | null;
  margin_percent: number | null;
  margin_status: MarginStatus | null;
  target_margin_percent: number | null;
  source_recipe_version: string | null;
  bom_version_number: number | null;
  price_review_id: string | null;
  price_review_approved_at: string | null;
};

export type OrderFinancialSnapshot = {
  id: string;
  snapshot_uuid: string;
  snapshot_version: number;
  snapshotted_at: string;
  locked: boolean;
  locked_at: string | null;
  hash_verified: boolean | null;
  integrity_hash: string | null;
  currency: string;
  recipe_version: string | null;
  pricing_engine_version: string;
  cost_engine_version: string;
  subtotal: number;
  discount_amount: number;
  discount_type: string | null;
  shipping_cost: number;
  grand_total: number;
  deposit_amount: number;
  remaining_balance: number;
  total_cogs: number | null;
  total_raw_material_cost: number | null;
  total_packaging_cost: number | null;
  total_manufacturing_cost: number | null;
  total_other_cost: number | null;
  gross_profit: number | null;
  actual_margin_percent: number | null;
  margin_status: MarginStatus | null;
  target_margin_percent: number | null;
  margin_difference: number | null;
  shipping_zone: string | null;
  shipping_rule_name: string | null;
  shipping_override_applied: boolean;
  business_context: OrderBusinessContextSnapshot | null;
  lines: OrderFinancialSnapshotLine[];
};

// ── Customer lookup (manual order phone-first resolution) ─────────────────────
export type CustomerLookupStats = {
  total_orders: number;
  delivered: number;
  completed: number;
  cancelled: number;
  returned: number;
  success_rate: number;
  lifetime_value: number;
  avg_order_value: number;
  first_order_date: string | null;
  last_order_date: string | null;
};

export type CustomerAddress = {
  id: string;
  is_default: boolean;
  governorate: string | null;
  city: string | null;
  area: string | null;
  address_line: string | null;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  address_notes: string | null;
  google_maps_lat: number | null;
  google_maps_lng: number | null;
  google_maps_url: string | null;
  location_source: string | null;
};

export type CustomerLookupCustomer = {
  id: string;
  name: string;
  phone: string | null;
  mobile: string | null;
  governorate: string | null;
  city: string | null;
  area: string | null;
  notes: string | null;
};

export type CustomerLookupResult = {
  customer: CustomerLookupCustomer;
  addresses: CustomerAddress[];
  stats: CustomerLookupStats;
} | null;

// ── Brand Order Policy (from GET /configuration/brands/{id}/policies/order) ───
export type BrandOrderPolicy = {
  source_entry_policies: {
    manual: string | string[];
    pos: string | string[];
    woocommerce: string;
    public_api: string;
  };
  payment_proof_policy: Record<string, 'none' | 'required' | 'optional'>;
  auto_reserve_inventory: boolean;
  customer_matching_policy: 'reuse_existing' | 'warn_only' | 'block_duplicate' | 'always_create_new';
  require_phone: boolean;
  require_address: boolean;
  customer_lookup_enabled: boolean;
  discount_policy: string;
  deposit_policy: string;
};

// ── Shipping quote (POST /shipping/quote) ─────────────────────────────────────
export type ShippingQuotePayload = {
  brand_id: string;
  governorate_id: number;
  city_id?: number | null;
};

/** coverage_status: 'covered' | 'needs_review' | 'unavailable' | 'walk_in' */
export type ShippingQuoteResult = {
  available: boolean;
  decision: string;
  coverage_status: string;
  validation_message: string | null;
  shipping_price: number | null;
  delivery_days: number | null;
  same_day: boolean;
  cod_allowed: boolean;
  preferred_provider: string | null;
  governorate_id: number | null;
  city_id: number | null;
};

// ── Activity timeline ─────────────────────────────────────────────────────────
export type OrderActivityActionType =
  | 'created' | 'updated' | 'deleted'
  | 'workflow' | 'payment' | 'inventory'
  | 'customer' | 'shipping' | 'system'
  | 'automation' | 'note';

export type OrderActivitySource =
  | 'dashboard' | 'mobile_app' | 'api'
  | 'woocommerce' | 'automation' | 'cron' | 'webhook';

export type OrderActivityActorType =
  | 'user' | 'system' | 'api' | 'automation' | 'woocommerce' | 'webhook';

export type OrderActivity = {
  id: string;
  event_type: string;
  description: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  actor_email: string | null;
  actor_type: OrderActivityActorType | null;
  source: OrderActivitySource | null;
  action_type: OrderActivityActionType | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  changed_fields: string[] | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  module: string;
  payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// ── Manual order payload for POST /orders/manual ──────────────────────────────
export type ManualOrderPayload = {
  company_id?: string | null;
  channel_id?: string | null;
  status?: string;
  order_date?: string | null;
  requested_delivery_date?: string | null;
  delivery_window_id?: string | null;
  delivery_window?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_secondary_phone?: string | null;
  customer_notes?: string | null;
  governorate?: string | null;
  city?: string | null;
  area?: string | null;
  shipping_address?: string | null;
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  landmark?: string | null;
  address_notes?: string | null;
  delivery_zone_id?: string | null;
  delivery_zone?: string | null;
  google_maps_lat?: number | null;
  google_maps_lng?: number | null;
  google_maps_url?: string | null;
  location_source?: string | null;
  governorate_id?: number | null;
  city_id?: number | null;
  payment_method_manual?: string | null;
  shipping_cost?: number | null;
  shipping_cost_source?: string | null;
  discount_amount?: number | null;
  discount_type?: string | null;
  deposit_amount?: number | null;
  payment_proof_path?: string | null;
  notes?: string | null;
  lines: { product_id: string; quantity: number; unit_price: number }[];
};
