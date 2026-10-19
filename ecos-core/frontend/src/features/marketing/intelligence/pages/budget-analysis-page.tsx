import { useState } from 'react';
import { AlertTriangle, DollarSign } from 'lucide-react';
import { useIntelligenceBudget } from '../../hooks/use-intelligence';
import { IntelligenceFilterBar } from '../components/intelligence-filter-bar';
import { KpiCard, KpiCardSkeleton } from '../components/kpi-card';
import { Badge } from '@/components/ui/badge';
import type { IntelligenceFilters, BudgetCampaignRow } from '../../types/intelligence';

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function UtilizationBar({ pct, overspending }: { pct: number | null; overspending: boolean }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">—</span>;
  const capped = Math.min(pct, 120);
  const color   = overspending ? 'bg-red-500' : pct >= 90 ? 'bg-yellow-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${capped}%` }} />
      </div>
      <span className={`text-xs tabular-nums font-medium ${overspending ? 'text-red-600' : ''}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function CampaignBudgetRow({ row, rank }: { row: BudgetCampaignRow; rank: number }) {
  return (
    <div className={`px-4 py-3 flex items-center gap-3 border-b last:border-0 ${row.is_overspending ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
      <span className="text-xs text-muted-foreground w-5 tabular-nums flex-shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">{row.campaign_name ?? '—'}</span>
          {row.is_overspending && (
            <Badge variant="destructive" className="text-[10px] py-0 px-1.5 flex-shrink-0">
              Overspending
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 flex-shrink-0">
            {row.budget_type}
          </Badge>
        </div>
        <UtilizationBar pct={row.utilization_pct} overspending={row.is_overspending} />
      </div>
      <div className="text-right text-xs flex-shrink-0 min-w-[100px]">
        <div className="tabular-nums font-medium">{fmt(row.spend, '$')} spent</div>
        <div className="tabular-nums text-muted-foreground">{fmt(row.budget, '$')} budget</div>
        {row.remaining != null && (
          <div className={`tabular-nums ${row.remaining <= 0 ? 'text-red-600' : 'text-green-600'}`}>
            {row.remaining > 0 ? '+' : ''}{fmt(row.remaining, '$')} left
          </div>
        )}
      </div>
      {row.spend_share_pct != null && (
        <div className="text-xs text-muted-foreground tabular-nums flex-shrink-0 w-12 text-right">
          {row.spend_share_pct.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export function BudgetAnalysisPage() {
  const [filters, setFilters] = useState<IntelligenceFilters>({ date_preset: 'last_30d' });

  const { data, isLoading, isFetching, refetch } = useIntelligenceBudget(filters);

  const summary = data?.summary;
  const campaigns = data?.campaigns ?? [];
  const alerts    = data?.overspending_alerts ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Budget Analysis</h1>
          {data?.period && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.period.date_from} – {data.period.date_to}
            </p>
          )}
        </div>
        <IntelligenceFilterBar
          filters={filters}
          onFilterChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Total Budget"      value={fmt(summary?.total_budget, '$')}     accent="default" />
            <KpiCard label="Total Spend"       value={fmt(summary?.total_spend, '$')}      accent="default" />
            <KpiCard label="Remaining Budget"  value={fmt(summary?.remaining_budget, '$')} accent="green"   />
            <KpiCard
              label="Utilization"
              value={summary?.utilization_pct != null ? `${summary.utilization_pct.toFixed(1)}%` : null}
              accent={summary?.utilization_pct != null && summary.utilization_pct > 90 ? 'yellow' : 'default'}
            />
            <KpiCard
              label="Overspending"
              value={String(summary?.overspending_count ?? 0)}
              accent={(summary?.overspending_count ?? 0) > 0 ? 'red' : 'green'}
              sub="campaigns"
            />
          </>
        )}
      </div>

      {/* Budget Utilization Gauge */}
      {!isLoading && summary && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">Overall Budget Utilization</h2>
            <span className="text-sm font-semibold tabular-nums">
              {summary.utilization_pct.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                summary.utilization_pct > 100 ? 'bg-red-500' :
                summary.utilization_pct > 85  ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(summary.utilization_pct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
            <span>{fmt(summary.total_spend, '$')} spent</span>
            <span>{fmt(summary.total_budget, '$')} total</span>
          </div>
        </div>
      )}

      {/* Overspending Alerts */}
      {!isLoading && alerts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h2 className="text-sm font-semibold text-red-600">
              {alerts.length} Campaign{alerts.length > 1 ? 's' : ''} Overspending
            </h2>
          </div>
          <div className="rounded-lg border border-red-200 dark:border-red-900 overflow-hidden">
            {alerts.map((row, i) => (
              <CampaignBudgetRow key={row.campaign_id} row={row} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* Campaign Breakdown */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Campaign Budget Distribution</h2>
          {!isLoading && summary && (
            <span className="text-xs text-muted-foreground ml-auto">
              {summary.campaign_count} campaigns
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-lg border animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b flex items-center gap-3">
                <div className="h-3 flex-1 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No campaign budget data available.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            {/* Table header */}
            <div className="px-4 py-2 bg-muted/40 grid grid-cols-[1fr_auto] gap-3 text-xs font-medium text-muted-foreground border-b">
              <span>Campaign</span>
              <span className="text-right">Spend / Budget</span>
            </div>
            {campaigns.map((row, i) => (
              <CampaignBudgetRow key={row.campaign_id} row={row} rank={i + 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
