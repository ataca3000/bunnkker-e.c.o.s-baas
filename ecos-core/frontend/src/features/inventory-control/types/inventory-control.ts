export type AbcClass = 'A' | 'B' | 'C';
export type HealthLabel = 'excellent' | 'good' | 'warning' | 'critical' | 'unknown';

// ── Dashboard ─────────────────────────────────────────────────────────────────

export type DashboardKpis = {
  accuracy_pct: number | null;
  matched_products: number;
  total_counted_products: number;
  open_sessions: number;
  products_with_variance: number;
  adjustment_value_month: number;
  shrinkage_value_month: number;
  last_count_date: string | null;
  health: HealthLabel;
};

export type VarianceProductRow = {
  product_id: string;
  product_name: string;
  product_sku: string;
  variance_qty: number;
  variance_value: number;
};

export type RecentSession = {
  id: string;
  count_number: string;
  status: string;
  completed_at: string | null;
  warehouse_name: string;
  accuracy_pct: number | null;
};

export type DashboardData = {
  kpis: DashboardKpis;
  top_negative: VarianceProductRow[];
  top_positive: VarianceProductRow[];
  recent_sessions: RecentSession[];
};

// ── ABC Classification ────────────────────────────────────────────────────────

export type AbcProductRef = {
  id: string;
  name: string;
  sku: string;
};

export type AbcClassification = {
  id: string;
  product_id: string;
  product: AbcProductRef | null;
  classification: AbcClass;
  annual_consumption_value: string;
  cumulative_percentage: string;
  calculated_at: string;
  updated_at: string | null;
};

export type AbcClassificationsQuery = {
  class?: AbcClass;
  page?: number;
  per_page?: number;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type AbcClassificationsResult = {
  data: AbcClassification[];
  meta: PaginationMeta;
};

export type AbcRecalculateSummary = {
  summary: { total: number; A: number; B: number; C: number };
  recalculated_at: string;
};

// ── Cycle Count Plans ─────────────────────────────────────────────────────────

export type CycleCountPlan = {
  id: string;
  product_id: string;
  product: AbcProductRef | null;
  abc_class: AbcClass;
  frequency_days: number;
  last_counted_at: string | null;
  next_due_at: string | null;
  is_overdue: boolean;
  updated_at: string | null;
};

export type CycleCountPlansQuery = {
  overdue?: boolean;
  class?: AbcClass;
  page?: number;
  per_page?: number;
};

export type CycleCountPlansResult = {
  data: CycleCountPlan[];
  meta: PaginationMeta;
};

// ── Variance Analytics ────────────────────────────────────────────────────────

export type FrequentVarianceProduct = {
  product_id: string;
  product_name: string;
  product_sku: string;
  variance_count: number;
  total_variance_qty: number;
  total_variance_value: number;
};

export type WarehouseVariance = {
  warehouse_id: string;
  warehouse_name: string;
  adj_in_value: number;
  adj_out_value: number;
  net_variance_value: number;
};

export type CategoryVariance = {
  category_id: string;
  category_name: string;
  adj_in_value: number;
  adj_out_value: number;
  net_variance_value: number;
};

export type MonthlyTrend = {
  month: string;
  adj_in_value: number;
  adj_out_value: number;
  net_variance: number;
};

export type VarianceAnalytics = {
  frequently_missing: FrequentVarianceProduct[];
  frequently_overcounted: FrequentVarianceProduct[];
  by_warehouse: WarehouseVariance[];
  by_category: CategoryVariance[];
  monthly_trend: MonthlyTrend[];
};

export type VarianceAnalyticsQuery = {
  limit?: number;
};

// ── Warehouse Performance ─────────────────────────────────────────────────────

export type WarehousePerformance = {
  warehouse_id: string;
  warehouse_name: string;
  accuracy_pct: number | null;
  avg_variance_pct: number | null;
  adj_in_value: number;
  adj_out_value: number;
  count_completion_rate: number | null;
  open_counts: number;
  total_sessions: number;
};

export type WarehousePerformanceQuery = {
  months?: number;
};
