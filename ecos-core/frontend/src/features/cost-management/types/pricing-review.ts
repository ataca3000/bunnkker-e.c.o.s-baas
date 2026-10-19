export type ReviewStatus = 'pending' | 'approved' | 'kept' | 'custom_price' | 'snoozed' | 'rejected';

export type ImpactType =
  | 'margin_below_target'
  | 'cost_increased'
  | 'cost_decreased'
  | 'recipe_changed'
  | 'packaging_changed';

export type PersonRef = {
  id: string | null;
  name: string;
};

export type ProductRef = {
  id: string;
  name: string;
  sku: string;
  image_url: string | null;
  unit: string | null;
  pricing_mode?: 'brand_policy' | 'custom';
  custom_target_margin?: number | null;
  custom_markup?: number | null;
  custom_discount_pct?: number | null;
};

export type BrandRef = {
  id: string;
  name: string;
  default_target_margin: number | null;
  default_markup: number | null;
  default_discount_pct: number | null;
};

export type CompanyRef = { id: string; name: string };
export type ChannelRef  = { id: string; name: string };

export type PricingReview = {
  id: string;
  product: ProductRef;
  brand: BrandRef | null;
  company: CompanyRef;
  channel: ChannelRef;
  // Official Pricing Dictionary (TASK-ARCH-PRICE-001 Part 1)
  product_cost: number;
  previous_product_cost: number;
  cost_difference: number;
  cost_change_pct: number | null;
  selling_price: number;
  sale_price: number | null;
  suggested_selling_price: number;
  suggested_sale_price: number;
  discount_pct: number;
  current_margin: number;
  target_margin: number;
  markup: number;
  gross_profit_pct: number | null;
  final_margin_pct: number | null;
  impacts: ImpactType[];
  status: ReviewStatus;
  publish_status: 'pending_publish' | 'published' | null;
  approved_price: number | null;
  approved_sale_price: number | null;
  published_at: string | null;
  reviewer: PersonRef | null;
  snooze_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CostBreakdownLine = {
  label: string;
  category: 'raw_material' | 'packaging' | 'other';
  product_cost: number;
  previous_product_cost: number;
  difference: number;
  pct_of_total: number;
};

export type RecipeChangeLine = {
  material_name: string;
  sku: string;
  old_material_cost: number;
  new_material_cost: number;
  difference: number;
  quantity: number;
};

export type PriceHistoryEntry = {
  date: string;
  selling_price: number;
  product_cost: number;
  margin: number;
  changed_by: PersonRef;
};

export type ApprovalHistoryEntry = {
  id: string;
  action: 'approve_suggested' | 'keep_current' | 'custom_price' | 'snoozed' | 'assigned' | 'reject';
  old_selling_price: number | null;
  new_selling_price: number | null;
  reason: string | null;
  manager_name: string | null;
  approved_channels: string[];
  approved_at: string | null;
};

export type ProductCostDetail = {
  review: PricingReview;
  cost_breakdown: CostBreakdownLine[];
  recipe_changes: RecipeChangeLine[];
  price_history: PriceHistoryEntry[];
  approvals: ApprovalHistoryEntry[];
};

export type ReviewSummary = {
  pending: number;
  approved: number;
  kept: number;
  custom_price: number;
  snoozed: number;
  rejected: number;
  below_brand_margin?: number;
  pending_publish?: number;
};

export type PricingReviewsQuery = {
  search?: string;
  status?: ReviewStatus | 'all';
  product_id?: string;
  brand_id?: string;
  page?: number;
  per_page?: number;
};

export type PricingReviewsResult = {
  data: PricingReview[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
  summary: ReviewSummary;
};

export type ApprovePayload = {
  action: 'approve_suggested' | 'keep_current' | 'custom_price' | 'reject';
  custom_price?: number;
  reason?: string;
  manager_name?: string;
  channels?: string[];
};

export type SnoozePayload = { until: string };
export type AssignPayload  = { reviewer_name: string };
export type BulkApprovePayload = {
  ids: string[];
  action: ApprovePayload['action'];
  reason?: string;
  manager_name?: string;
  channels?: string[];
};

export type InlineUpdatePayload = {
  target_margin?: number;
  markup?: number;
  regular_price?: number;
  sale_price?: number | null;
  pricing_mode?: 'brand_policy' | 'custom';
};

export type BulkPolicyPayload = {
  ids: string[];
  action: 'apply_brand_policy' | 'set_target_margin' | 'set_markup' | 'snooze';
  value?: number;
  snooze_until?: string;
};

// Dashboard KPI types
export type CostDashboardStats = {
  pending_reviews: number;
  below_target_margin: number;
  cost_increased_today: number;
  cost_decreased_today: number;
  expected_profit_impact: number;
  average_margin: number | null;
  awaiting_approval: number;
};

// Material Cost History types
export type MaterialCostHistoryEntry = {
  id: string;
  product: { id: string; name: string; sku: string };
  previous_cost: number | null;
  new_cost: number;
  difference: number;
  change_pct: number | null;
  source: 'manual' | 'purchase_invoice';
  goods_receipt_id: string | null;
  updated_by: string | null;
  affected_recipe_count: number;
  affected_product_count: number;
  affected_recipe_ids: string[];
  affected_product_ids: string[];
  occurred_at: string;
};

export type MaterialCostHistoryResult = {
  data: MaterialCostHistoryEntry[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

export type MaterialCostHistoryQuery = {
  search?: string;
  source?: 'manual' | 'purchase_invoice';
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
};
