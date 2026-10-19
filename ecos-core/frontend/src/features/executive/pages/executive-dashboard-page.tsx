import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, LayoutDashboard, Lock } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkspaceHeader } from '@/components/workspace';
import type { WorkspaceMetric } from '@/components/workspace';
import { useBranchesQuery } from '@/features/branches/hooks/use-branches';
import { useCompaniesQuery } from '@/features/companies/hooks/use-companies';
import { useFormatter } from '@/hooks/use-formatter';
import { ExecutiveFilterBar } from '../components/executive-filters';
import { ExecutiveUnavailableCard } from '../components/executive-unavailable-card';
import { ExecutiveKpiCard } from '../components/executive-kpi-card';
import { ExecutiveTrendPanel } from '../components/executive-trend-panel';
import {
  useCompanyKpisQuery,
  useCrmKpisQuery,
  useExecutiveAlertsQuery,
  useExecutiveInsightsQuery,
  useExecutiveRecommendationsQuery,
  useExecutiveTrendsQuery,
  useExecutivePermissions,
  useFinancialKpisQuery,
  useInventoryKpisQuery,
  useLogisticsKpisQuery,
  useProcurementKpisQuery,
} from '../hooks/use-executive';
import {
  companyKpis,
  crmKpis,
  financialKpis,
  inventoryKpis,
  logisticsKpis,
  procurementKpis,
  salesKpis,
  toAlerts,
  toInsights,
  toRecommendations,
  toTrends,
} from '../lib/normalize';
import type { ExecutiveDomain, ExecutiveFilters, ExecutiveKpi, ExecutiveSavedView } from '../types/executive';

const SAVED_VIEWS_KEY = 'ecos:executive:savedViews';

/**
 * The Executive Platform board.
 *
 * ┌─ READS ONLY, AND ONLY WHAT ALREADY EXISTS ──────────────────────────────┐
 * │ Every panel is backed by an endpoint that was already in the route table. │
 * │ Nothing here writes, and no backend change was made for this screen.      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * One filter object drives all seven domains, so the board is always describing
 * a single company, branch and window.
 */
export function ExecutiveDashboardPage() {
  const { t } = useTranslation('executive');
  const { number } = useFormatter();
  const { permitted, can } = useExecutivePermissions();

  const [filters, setFilters] = useState<ExecutiveFilters>({});
  const [activeViewId, setActiveViewId] = useState('default');

  const { data: companies } = useCompaniesQuery({ per_page: 100 });
  // Branches narrow to the selected company so the two filters can never
  // describe a branch that does not belong to the company beside it.
  const { data: branches } = useBranchesQuery({
    per_page: 100,
    company_id: filters.companyId,
  });

  const company = useCompanyKpisQuery(filters);
  const finance = useFinancialKpisQuery(filters);
  const crm = useCrmKpisQuery(filters);
  const logistics = useLogisticsKpisQuery(filters);
  const inventory = useInventoryKpisQuery(filters);
  const procurement = useProcurementKpisQuery(filters);

  const insights = useExecutiveInsightsQuery(filters);
  const alerts = useExecutiveAlertsQuery(filters);
  const recommendations = useExecutiveRecommendationsQuery(filters);
  const trends = useExecutiveTrendsQuery(filters);

  // ── KPI label resolution ──────────────────────────────────────────────────
  // Selector mode validates a path, not a string, so the mapping from a
  // normaliser's labelKey to a translated string lives here, explicitly.
  const labels = useMemo<Record<string, string>>(
    () => ({
      'kpi.revenue': t(($) => $.kpi.revenue),
      'kpi.orders': t(($) => $.kpi.orders),
      'kpi.averageOrderValue': t(($) => $.kpi.averageOrderValue),
      'kpi.customers': t(($) => $.kpi.customers),
      'kpi.salesRevenue': t(($) => $.kpi.salesRevenue),
      'kpi.ordersPlaced': t(($) => $.kpi.ordersPlaced),
      'kpi.shipped': t(($) => $.kpi.shipped),
      'kpi.delivered': t(($) => $.kpi.delivered),
      'kpi.grossRevenue': t(($) => $.kpi.grossRevenue),
      'kpi.grossProfit': t(($) => $.kpi.grossProfit),
      'kpi.margin': t(($) => $.kpi.margin),
      'kpi.expenses': t(($) => $.kpi.expenses),
      'kpi.activeCustomers': t(($) => $.kpi.activeCustomers),
      'kpi.newCustomers': t(($) => $.kpi.newCustomers),
      'kpi.retention': t(($) => $.kpi.retention),
      'kpi.lifetimeValue': t(($) => $.kpi.lifetimeValue),
      'kpi.activeTrips': t(($) => $.kpi.activeTrips),
      'kpi.onTimeRate': t(($) => $.kpi.onTimeRate),
      'kpi.openExceptions': t(($) => $.kpi.openExceptions),
      'kpi.capacityUtilisation': t(($) => $.kpi.capacityUtilisation),
      'kpi.stockValue': t(($) => $.kpi.stockValue),
      'kpi.activeSkus': t(($) => $.kpi.activeSkus),
      'kpi.lowStock': t(($) => $.kpi.lowStock),
      'kpi.outOfStock': t(($) => $.kpi.outOfStock),
      'kpi.activeSuppliers': t(($) => $.kpi.activeSuppliers),
      'kpi.outstandingPayables': t(($) => $.kpi.outstandingPayables),
      'kpi.totalPurchases': t(($) => $.kpi.totalPurchases),
      'kpi.supplierOnTime': t(($) => $.kpi.supplierOnTime),
    }),
    [t],
  );

  const groups = useMemo(
    () => [
      { domain: 'company' as ExecutiveDomain, title: t(($) => $.groups.company), kpis: companyKpis(company.data as never), q: company },
      { domain: 'financial' as ExecutiveDomain, title: t(($) => $.groups.financial), kpis: financialKpis(finance.data as never), q: finance },
      { domain: 'sales' as ExecutiveDomain, title: t(($) => $.groups.sales), kpis: salesKpis(company.data as never), q: company },
      { domain: 'crm' as ExecutiveDomain, title: t(($) => $.groups.crm), kpis: crmKpis(crm.data as never), q: crm },
      { domain: 'logistics' as ExecutiveDomain, title: t(($) => $.groups.logistics), kpis: logisticsKpis(logistics.data as never), q: logistics },
      { domain: 'inventory' as ExecutiveDomain, title: t(($) => $.groups.inventory), kpis: inventoryKpis(inventory.data as never), q: inventory },
      { domain: 'procurement' as ExecutiveDomain, title: t(($) => $.groups.procurement), kpis: procurementKpis(procurement.data as never), q: procurement },
    ],
    [t, company, finance, crm, logistics, inventory, procurement],
  );

  const insightRows = useMemo(() => toInsights(insights.data, 'logistics'), [insights.data]);
  const alertRows = useMemo(() => toAlerts(alerts.data, 'logistics'), [alerts.data]);
  const recommendationRows = useMemo(
    () => toRecommendations(recommendations.data, 'logistics'),
    [recommendations.data],
  );

  // Selector mode cannot resolve a dynamic key, so the four series labels are
  // translated here and handed to the panel already rendered. Every numeric
  // field stays exactly as the server sent it.
  const trendSeries = useMemo(() => {
    const label: Record<string, string> = {
      revenue: t(($) => $.trends.revenue),
      expense: t(($) => $.trends.expense),
      profit: t(($) => $.trends.profit),
      margin: t(($) => $.trends.margin),
    };

    return toTrends(trends.data).map((s) => ({
      ...s,
      label: label[s.id] ?? s.id,
    }));
  }, [t, trends.data]);

  // ── Saved views ───────────────────────────────────────────────────────────
  const savedViews = useMemo<ExecutiveSavedView[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY);

      return raw ? (JSON.parse(raw) as ExecutiveSavedView[]) : [];
    } catch {
      // A corrupted entry must not take the board down.
      return [];
    }
  }, []);

  const applyView = useCallback(
    (id: string) => {
      setActiveViewId(id);

      if (id === 'default') {
        setFilters({});

        return;
      }

      const view = savedViews.find((v) => v.id === id);
      if (view) setFilters(view.filters);
    },
    [savedViews],
  );

  // ── Export ────────────────────────────────────────────────────────────────
  // Exports what is ON SCREEN, from the same normalised KPIs the cards render —
  // so the file and the board can never disagree.
  const exportCsv = useCallback(() => {
    const rows: string[][] = [['domain', 'kpi', 'value', 'format']];

    groups.forEach((group) => {
      if (!permitted[group.domain]) return;

      group.kpis.forEach((k: ExecutiveKpi) => {
        rows.push([group.title, labels[k.labelKey] ?? k.labelKey, String(k.value ?? ''), k.format]);
      });
    });

    // Trends are on the board, so they belong in the export. One row per month
    // the server returned — the same points the sparkline plots.
    if (can('finance.analytics.view')) {
      const section = t(($) => $.sections.trends);

      trendSeries.forEach((s) => {
        s.points.forEach((point) => {
          rows.push([section, `${s.label} — ${point.label}`, String(point.value), s.format]);
        });
      });
    }

    const csv = rows
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `executive-board-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }, [groups, labels, permitted, can, t, trendSeries]);

  const headerMetrics: WorkspaceMetric[] = useMemo(
    () => [
      {
        id: 'insights',
        icon: LayoutDashboard,
        label: t(($) => $.sections.insights),
        value: number(insightRows.length),
        isLoading: insights.isPending,
      },
      {
        id: 'alerts',
        icon: LayoutDashboard,
        label: t(($) => $.sections.alerts),
        value: number(alertRows.length),
        isLoading: alerts.isPending,
      },
      {
        id: 'recommendations',
        icon: LayoutDashboard,
        label: t(($) => $.sections.recommendations),
        value: number(recommendationRows.length),
        isLoading: recommendations.isPending,
      },
    ],
    [t, number, insightRows, alertRows, recommendationRows, insights.isPending, alerts.isPending, recommendations.isPending],
  );

  return (
    <div className="flex flex-col">
      <WorkspaceHeader
        title={t(($) => $.title)}
        description={t(($) => $.subtitle)}
        metrics={headerMetrics}
        primaryAction={{
          key: 'export',
          label: t(($) => $.actions.export),
          icon: Download,
          onClick: exportCsv,
        }}
        savedViews={{
          views: [
            { id: 'default', label: t(($) => $.views.default) },
            ...savedViews.map((v) => ({ id: v.id, label: v.name })),
          ],
          activeId: activeViewId,
          onViewChange: applyView,
        }}
        toolbarSlot={
          <ExecutiveFilterBar
            filters={filters}
            companies={(companies?.items ?? []).map((c) => ({ id: c.id, name: c.name }))}
            branches={(branches?.items ?? []).map((b) => ({ id: b.id, name: b.name }))}
            onChange={setFilters}
            onReset={() => setFilters({})}
          />
        }
      />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {groups.map((group) => (
          <section key={group.domain} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">{group.title}</h2>

            {!permitted[group.domain] ? (
              <Card>
                <CardContent className="text-muted-foreground flex items-center gap-2 pt-6 text-sm">
                  <Lock className="size-4" />
                  {t(($) => $.restricted)}
                </CardContent>
              </Card>
            ) : group.q.isError ? (
              <ExecutiveUnavailableCard
                message={t(($) => $.unavailable)}
                retryLabel={t(($) => $.retry)}
                onRetry={() => void group.q.refetch()}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {group.kpis.map((k: ExecutiveKpi) => (
                  <ExecutiveKpiCard
                    key={k.id}
                    kpi={k}
                    label={labels[k.labelKey] ?? k.labelKey}
                    isLoading={group.q.isPending}
                  />
                ))}
              </div>
            )}
          </section>
        ))}

        <div className="grid gap-4 lg:grid-cols-2">
          <ListPanel
            title={t(($) => $.sections.insights)}
            empty={t(($) => $.empty.insights)}
            rows={insightRows.map((r) => ({ id: r.id, title: r.title, detail: r.detail, tone: r.severity }))}
          />
          <ListPanel
            title={t(($) => $.sections.alerts)}
            empty={t(($) => $.empty.alerts)}
            rows={alertRows.map((r) => ({
              id: r.id,
              title: r.title,
              detail: r.count === null ? null : number(r.count),
              tone: r.severity,
            }))}
          />
          <ListPanel
            title={t(($) => $.sections.recommendations)}
            empty={t(($) => $.empty.recommendations)}
            rows={recommendationRows.map((r) => ({
              id: r.id,
              title: r.title,
              detail: r.detail ?? r.impact,
              tone: 'info' as const,
            }))}
          />
          <ExecutiveTrendPanel
            title={t(($) => $.sections.trends)}
            empty={t(($) => $.empty.trends)}
            restricted={t(($) => $.restricted)}
            unavailable={t(($) => $.unavailable)}
            series={trendSeries}
            isLoading={trends.isPending && !trends.isError}
            isRestricted={!can('finance.analytics.view')}
            isError={trends.isError}
          />
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  info: 'border-s-blue-500',
  warning: 'border-s-amber-500',
  critical: 'border-s-destructive',
};

function ListPanel({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; title: string; detail?: string | null; tone: 'info' | 'warning' | 'critical' }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id} className={`border-s-2 ps-3 ${TONE[row.tone] ?? TONE.info}`}>
                <p className="text-sm font-medium">{row.title}</p>
                {row.detail ? <p className="text-muted-foreground text-xs">{row.detail}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
