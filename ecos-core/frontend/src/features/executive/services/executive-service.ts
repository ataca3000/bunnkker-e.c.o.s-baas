import { api } from '@/lib/axios';

import type {
  AdminExecutiveDashboard,
  CrmExecutiveKpis,
  ExecutiveFilters,
  FinanceExecutiveKpi,
  FinanceTrendsPayload,
  InventoryDashboard,
  LogisticsExecutiveSummary,
  SupplierStats,
} from '../types/executive';

/**
 * The Executive Platform reads EXISTING endpoints only.
 *
 * ┌─ NO BACKEND WAS ADDED OR CHANGED FOR THIS UI ───────────────────────────┐
 * │ Each call below was verified present in the live route table before it    │
 * │ was written. Where a domain has no dedicated executive endpoint —          │
 * │ Procurement, for instance — this reads the stats endpoint that does exist  │
 * │ rather than inventing an aggregate the server does not serve.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Every call is a GET. The executive surface reads; it never writes.
 */

/** Filters are passed as query params where the endpoint accepts them. */
function params(filters: ExecutiveFilters): Record<string, string | undefined> {
  return {
    company_id: filters.companyId,
    branch_id: filters.branchId,
    from: filters.from,
    to: filters.to,
  };
}

/**
 * The Finance trends endpoint is month-granular. Convert the filter window to
 * a whole-month count so the panel covers the same period as the KPI cards.
 * With no window selected, fall back to the server's own default of 12.
 */
function monthsBetween(filters: ExecutiveFilters): number {
  if (!filters.from || !filters.to) return 12;

  const from = new Date(filters.from);
  const to = new Date(filters.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 12;

  const months =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;

  // Clamp: a zero/negative range would make the server return an empty series,
  // and an unbounded one would pull years of rows into an executive summary.
  return Math.min(Math.max(months, 1), 60);
}

/** Some payloads are bare, others wrapped in `data` — normalise once, here. */
function unwrap<T>(body: unknown): T {
  if (body !== null && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }

  return body as T;
}

export const executiveService = {
  /** GET api/admin/executive-dashboard — company-wide sales/marketing/shipping/ops. */
  async companyDashboard(filters: ExecutiveFilters = {}): Promise<AdminExecutiveDashboard> {
    const { data } = await api.get('/admin/executive-dashboard', { params: params(filters) });

    return unwrap<AdminExecutiveDashboard>(data);
  },

  /** GET api/finance/intelligence/dashboards/executive-kpi */
  async financeKpis(filters: ExecutiveFilters = {}): Promise<FinanceExecutiveKpi> {
    const { data } = await api.get('/finance/intelligence/dashboards/executive-kpi', {
      params: params(filters),
    });

    return unwrap<FinanceExecutiveKpi>(data);
  },

  /** GET api/crm/executive/kpis */
  async crmKpis(filters: ExecutiveFilters = {}): Promise<CrmExecutiveKpis> {
    const { data } = await api.get('/crm/executive/kpis', { params: params(filters) });

    return unwrap<CrmExecutiveKpis>(data);
  },

  /** GET api/logistics/operations/summary/executive */
  async logisticsSummary(filters: ExecutiveFilters = {}): Promise<LogisticsExecutiveSummary> {
    const { data } = await api.get('/logistics/operations/summary/executive', {
      params: params(filters),
    });

    return unwrap<LogisticsExecutiveSummary>(data);
  },

  /** GET api/inventory/dashboard */
  async inventoryDashboard(filters: ExecutiveFilters = {}): Promise<InventoryDashboard> {
    const { data } = await api.get('/inventory/dashboard', { params: params(filters) });

    return unwrap<InventoryDashboard>(data);
  },

  /** GET api/suppliers/stats — the only procurement aggregate that exists. */
  async procurementStats(filters: ExecutiveFilters = {}): Promise<SupplierStats> {
    const { data } = await api.get('/suppliers/stats', { params: params(filters) });

    return unwrap<SupplierStats>(data);
  },

  // ── Insights / Alerts / Trends / Recommendations ──────────────────────────

  /** GET api/logistics/intelligence/insights */
  async insights(filters: ExecutiveFilters = {}): Promise<unknown> {
    const { data } = await api.get('/logistics/intelligence/insights', { params: params(filters) });

    return unwrap<unknown>(data);
  },

  /** GET api/logistics/operations/exceptions/alerts/summary */
  async alerts(filters: ExecutiveFilters = {}): Promise<unknown> {
    const { data } = await api.get('/logistics/operations/exceptions/alerts/summary', {
      params: params(filters),
    });

    return unwrap<unknown>(data);
  },

  /**
   * GET api/finance/intelligence/trends
   *
   * This endpoint does NOT take from/to — it takes `company_id` and `months`
   * (FinancialIntelligenceController::trends). Sending from/to would be
   * silently ignored and the panel would show 12 months while the rest of the
   * board showed the selected window, so the date range is converted to a
   * whole-month count here instead.
   */
  async trends(filters: ExecutiveFilters = {}): Promise<FinanceTrendsPayload> {
    const { data } = await api.get('/finance/intelligence/trends', {
      params: { company_id: filters.companyId, months: monthsBetween(filters) },
    });

    return unwrap<FinanceTrendsPayload>(data);
  },

  /** GET api/logistics/intelligence/decisions/recommendations */
  async recommendations(filters: ExecutiveFilters = {}): Promise<unknown> {
    const { data } = await api.get('/logistics/intelligence/decisions/recommendations', {
      params: params(filters),
    });

    return unwrap<unknown>(data);
  },
};
