import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, DollarSign, Target, Zap, AlertTriangle } from 'lucide-react';
import { useIntelligenceDashboard } from '../../hooks/use-intelligence';
import { IntelligenceFilterBar } from '../components/intelligence-filter-bar';
import { KpiCard, KpiCardSkeleton } from '../components/kpi-card';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/router/routes';
import type { IntelligenceFilters } from '../../types/intelligence';

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtMoney(n: number | null | undefined): string {
  return fmt(n, '$');
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(2)}%`;
}

export function ExecutiveDashboardPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState<IntelligenceFilters>({ date_preset: 'last_30d' });

  const { data, isLoading, isFetching, refetch } = useIntelligenceDashboard(filters);

  const kpis   = data?.kpis;
  const growth = data?.growth;
  const health = data?.health;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Marketing Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Executive performance overview
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <IntelligenceFilterBar
            filters={filters}
            onFilterChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onRefresh={() => refetch()}
            isFetching={isFetching}
          />
          <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.marketingCampaignAnalytics)}>
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Campaigns
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.marketingTrends)}>
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Trends
          </Button>
        </div>
      </div>

      {/* Health Score */}
      {isLoading ? (
        <div className="h-16 rounded-lg border bg-card animate-pulse" />
      ) : health ? (
        <div className="rounded-lg border bg-card p-4 flex items-center gap-6">
          <div className="flex-shrink-0">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold"
              style={{ background: health.color }}
            >
              {health.score}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              Health Score: <span style={{ color: health.color }}>{health.label}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(health.breakdown).map(([k, v]) => (
                <span key={k} className="text-xs text-muted-foreground">
                  {k.replace(/_/g, ' ')}: <span className="font-medium text-foreground">{v}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="hidden sm:block text-xs text-muted-foreground text-right">
            {data?.period && (
              <>
                <div>{new Date(data.period.date_from).toLocaleDateString()} –</div>
                <div>{new Date(data.period.date_to).toLocaleDateString()}</div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Primary KPIs */}
      <section>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Key Performance Indicators
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <KpiCardSkeleton key={i} />)
          ) : (
            <>
              <KpiCard label="Spend"       value={fmtMoney(kpis?.spend)}       growth={growth?.spend_growth_pct}    accent="default" />
              <KpiCard label="Revenue"     value={fmtMoney(kpis?.revenue)}     growth={growth?.revenue_growth_pct}  accent="green"   />
              <KpiCard label="ROAS"        value={kpis?.roas != null ? kpis.roas.toFixed(2) + 'x' : null} growth={growth?.roas_growth_pct}     accent="blue"    />
              <KpiCard label="CPA"         value={fmtMoney(kpis?.cpa)}         accent="default" />
              <KpiCard label="Purchases"   value={fmt(kpis?.purchases)}        growth={growth?.purchases_growth_pct} accent="green"   />
              <KpiCard label="CTR"         value={fmtPct(kpis?.ctr_pct)}       accent="default" />
            </>
          )}
        </div>
      </section>

      {/* Secondary KPIs */}
      <section>
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Volume Metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
          ) : (
            <>
              <KpiCard label="Impressions" value={fmt(kpis?.impressions)}  />
              <KpiCard label="Clicks"      value={fmt(kpis?.clicks)}       />
              <KpiCard label="Reach"       value={fmt(kpis?.reach)}        />
              <KpiCard label="Leads"       value={fmt(kpis?.leads)}        accent="blue" />
              <KpiCard label="CPC"         value={fmtMoney(kpis?.cpc)}     />
            </>
          )}
        </div>
      </section>

      {/* Top / Worst Campaigns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CampaignRankCard
          title="Top Campaigns"
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          rows={data?.top_5_campaigns ?? []}
          isLoading={isLoading}
          accent="green"
        />
        <CampaignRankCard
          title="Underperforming"
          icon={<AlertTriangle className="h-4 w-4 text-yellow-600" />}
          rows={data?.worst_5_campaigns ?? []}
          isLoading={isLoading}
          accent="yellow"
        />
      </div>

      {/* Top Creatives */}
      {!isLoading && (data?.top_5_creatives?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Top Creatives
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.top_5_creatives ?? []).slice(0, 3).map((c) => (
              <div key={c.creative_id} className="rounded-lg border bg-card p-3 flex gap-3">
                {(c.thumbnail_url || c.image_url) ? (
                  <img
                    src={c.thumbnail_url ?? c.image_url ?? ''}
                    alt={c.name ?? ''}
                    className="w-14 h-14 object-cover rounded flex-shrink-0 bg-muted"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-14 h-14 rounded flex-shrink-0 bg-muted flex items-center justify-center">
                    <Zap className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name ?? '—'}</p>
                  {c.headline && <p className="text-xs text-muted-foreground truncate">{c.headline}</p>}
                  <div className="mt-1 flex gap-3 text-xs">
                    <span className="text-green-600 font-medium">{fmtMoney(c.total_revenue)} rev</span>
                    <span className="text-muted-foreground">{fmtMoney(c.total_spend)} spend</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.marketingCampaignAnalytics)}>
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Campaign Analytics
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.marketingAdAnalytics)}>
            <Target className="h-3.5 w-3.5 mr-1.5" /> Ad Analytics
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.marketingCreativeAnalytics)}>
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Creative Analytics
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.marketingTrends)}>
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" /> Performance Trends
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.marketingBudget)}>
            <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Budget Analysis
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.marketingReports)}>
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Reports
          </Button>
        </div>
      </section>
    </div>
  );
}

function CampaignRankCard({
  title, icon, rows, isLoading, accent,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Array<{ entity_id: string; name?: string | null; total_spend: number; total_revenue: number; total_purchases: number }>;
  isLoading: boolean;
  accent: 'green' | 'yellow';
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <div className="divide-y">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3 animate-pulse">
              <div className="h-3 flex-1 rounded bg-muted" />
              <div className="h-3 w-16 rounded bg-muted" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">No data available.</p>
        ) : (
          rows.map((row, i) => (
            <div key={row.entity_id} className="px-4 py-2.5 flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}</span>
              <span className="flex-1 text-sm truncate">{row.name ?? '—'}</span>
              <div className="text-right text-xs">
                <div className={accent === 'green' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                  ${(row.total_revenue / 1000).toFixed(1)}K rev
                </div>
                <div className="text-muted-foreground">${(row.total_spend / 1000).toFixed(1)}K spend</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
