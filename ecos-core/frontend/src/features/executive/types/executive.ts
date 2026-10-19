/**
 * Executive Platform types.
 *
 * Every shape here mirrors an EXISTING backend payload — no endpoint was added
 * or changed for this UI. Where a domain exposes no executive endpoint, the type
 * reflects the stats endpoint that does exist rather than a shape we wish for.
 */

/** The cross-module filter every panel reads. */
export interface ExecutiveFilters {
  companyId?: string;
  branchId?: string;
  from?: string;
  to?: string;
}

/** A KPI as the cards render it — deliberately domain-agnostic. */
export interface ExecutiveKpi {
  id: string;
  /** i18n key under the `executive` namespace, resolved at render. */
  labelKey: string;
  value: number | string | null;
  format: 'number' | 'currency' | 'percent' | 'text';
  /** Signed change vs the previous window, when the source supplies one. */
  delta?: number | null;
  /** Whether an increase is good — decides the colour, not the arrow. */
  higherIsBetter?: boolean;
  /** Shown under the value; already-translated text or a plain count. */
  hint?: string | null;
}

export type ExecutiveDomain =
  | 'company'
  | 'financial'
  | 'sales'
  | 'crm'
  | 'logistics'
  | 'inventory'
  | 'procurement';

/** One domain's KPI block, plus whether the viewer may see it. */
export interface ExecutiveKpiGroup {
  domain: ExecutiveDomain;
  kpis: ExecutiveKpi[];
  isLoading: boolean;
  isError: boolean;
  /** False when IAM withholds the underlying permission. */
  permitted: boolean;
}

// ── Raw payloads from existing endpoints ────────────────────────────────────

/** GET api/admin/executive-dashboard */
export interface AdminExecutiveDashboard {
  sales?: Record<string, number | string | null>;
  marketing?: Record<string, number | string | null>;
  shipping?: Record<string, number | string | null>;
  monthly?: Array<Record<string, number | string | null>>;
  operations?: Record<string, number | string | null>;
}

/** GET api/finance/intelligence/dashboards/executive-kpi */
export type FinanceExecutiveKpi = Record<string, unknown>;

/** GET api/crm/executive/kpis */
export type CrmExecutiveKpis = Record<string, unknown>;

/** GET api/logistics/operations/summary/executive */
export type LogisticsExecutiveSummary = Record<string, unknown>;

/** GET api/inventory/dashboard */
export type InventoryDashboard = Record<string, unknown>;

/** GET api/suppliers/stats */
export type SupplierStats = Record<string, unknown>;

// ── Insights / Alerts / Trends / Recommendations ────────────────────────────

export interface ExecutiveInsight {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail?: string | null;
  source: string;
}

export interface ExecutiveAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  count?: number | null;
  source: string;
}

export interface ExecutiveTrendPoint {
  /** The `month` the server returned, verbatim (e.g. "2026-03"). */
  label: string;
  value: number;
}

/**
 * One trend series exactly as `GET /finance/intelligence/trends` returns it.
 *
 * The server computes first/last/average/change/change_pct/direction itself
 * (TrendAnalysisService::trend). This UI displays those numbers; it does not
 * recompute them. If the two ever disagreed, the board would be contradicting
 * the system of record — so there is deliberately no client-side arithmetic.
 */
export interface ExecutiveTrendSeries {
  /** 'revenue' | 'expense' | 'profit' | 'margin' — the payload key. */
  id: string;
  /** Translation key under `executive.trends.*`. */
  labelKey: string;
  points: ExecutiveTrendPoint[];
  first: number | null;
  last: number | null;
  average: number | null;
  change: number | null;
  changePct: number | null;
  direction: 'up' | 'down' | 'flat' | null;
  /** The server's own plain-English explanation string. Displayed verbatim. */
  explanation: string | null;
  /** Percentages render with a % suffix; the rest are currency-scale numbers. */
  format: 'number' | 'percent';
}

/** `{ data: { revenue: {...}, expense: {...}, profit: {...}, margin: {...} } }` */
export type FinanceTrendsPayload = Record<string, unknown>;

export interface ExecutiveRecommendation {
  id: string;
  title: string;
  detail?: string | null;
  impact?: string | null;
  source: string;
}

/** A saved filter combination, persisted per user in localStorage. */
export interface ExecutiveSavedView {
  id: string;
  name: string;
  filters: ExecutiveFilters;
}
