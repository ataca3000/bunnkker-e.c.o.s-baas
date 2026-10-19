import { useState } from 'react';
import { useIntelligenceTrends } from '../../hooks/use-intelligence';
import { IntelligenceFilterBar } from '../components/intelligence-filter-bar';
import { LineChart } from '../components/line-chart';
import { KpiCard, KpiCardSkeleton } from '../components/kpi-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TrendsFilters } from '../../types/intelligence';
import { useFormatter } from '@/hooks/use-formatter';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

type Metric = {
  key:    keyof import('../../types/intelligence').TrendDataPoint;
  label:  string;
  color:  string;
  format: (v: number) => string;
};

const ACTIVE_METRICS_DEFAULT = ['spend', 'revenue', 'roas', 'purchases'];

export function PerformanceTrendsPage() {
  const { money, moneyCompact } = useFormatter();
  const [filters, setFilters] = useState<TrendsFilters>({
    date_preset:  'last_30d',
    granularity:  'day',
    level:        'campaign',
  });
  const [activeMetrics, setActiveMetrics] = useState<string[]>(ACTIVE_METRICS_DEFAULT);

  // Currency metrics route through the centralized formatter (company currency).
  const METRICS: Metric[] = [
    { key: 'spend',       label: 'Spend',       color: '#6366F1', format: (v) => moneyCompact(v) },
    { key: 'revenue',     label: 'Revenue',     color: '#16A34A', format: (v) => moneyCompact(v) },
    { key: 'roas',        label: 'ROAS',        color: '#0891B2', format: (v) => `${v.toFixed(2)}x` },
    { key: 'ctr',         label: 'CTR',         color: '#D97706', format: (v) => `${(v * 100).toFixed(2)}%` },
    { key: 'cpa',         label: 'CPA',         color: '#DC2626', format: (v) => money(v) },
    { key: 'purchases',   label: 'Purchases',   color: '#7C3AED', format: (v) => v.toLocaleString() },
    { key: 'leads',       label: 'Leads',       color: '#059669', format: (v) => v.toLocaleString() },
    { key: 'impressions', label: 'Impressions', color: '#64748B', format: (v) => `${(v / 1000).toFixed(0)}K` },
    { key: 'clicks',      label: 'Clicks',      color: '#F59E0B', format: (v) => v.toLocaleString() },
  ];

  const { data, isLoading, isFetching, refetch } = useIntelligenceTrends(filters);

  const trendData = data?.data ?? [];
  const summary   = data?.meta?.summary;

  function toggleMetric(key: string) {
    setActiveMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Performance Trends</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data?.meta?.data_points ?? 0} data points · {data?.meta?.date_from ?? '–'} to {data?.meta?.date_to ?? '–'}
          </p>
        </div>
        <IntelligenceFilterBar
          filters={filters}
          onFilterChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          onRefresh={() => refetch()}
          isFetching={isFetching}
        >
          <Select
            value={filters.granularity ?? 'day'}
            onValueChange={(v) => setFilters((f) => ({ ...f, granularity: v as 'day' | 'week' | 'month' }))}
          >
            <SelectTrigger className="w-24 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.level ?? 'campaign'}
            onValueChange={(v) => setFilters((f) => ({ ...f, level: v as 'campaign' | 'adset' | 'ad' }))}
          >
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="campaign">Campaign</SelectItem>
              <SelectItem value="adset">Ad Set</SelectItem>
              <SelectItem value="ad">Ad</SelectItem>
            </SelectContent>
          </Select>
        </IntelligenceFilterBar>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Total Spend"     value={moneyCompact(summary?.total_spend)}   accent="default" />
            <KpiCard label="Total Revenue"   value={moneyCompact(summary?.total_revenue)} accent="green"   />
            <KpiCard label="Avg ROAS"        value={summary?.avg_roas != null ? `${summary.avg_roas.toFixed(2)}x` : null} accent="blue" />
            <KpiCard label="Total Purchases" value={fmt(summary?.total_purchases)}    accent="default" />
            <KpiCard label="Total Leads"     value={fmt(summary?.total_leads)}        accent="default" />
          </>
        )}
      </div>

      {/* Metric Toggles */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Toggle metrics:</p>
        <div className="flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key as string)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                activeMetrics.includes(m.key as string)
                  ? 'text-white border-transparent'
                  : 'bg-background border-border text-muted-foreground'
              }`}
              style={activeMetrics.includes(m.key as string) ? { background: m.color, borderColor: m.color } : {}}
              aria-pressed={activeMetrics.includes(m.key as string)}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: activeMetrics.includes(m.key as string) ? '#fff' : m.color }}
              />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 animate-pulse">
              <div className="h-3 w-20 rounded bg-muted mb-4" />
              <div className="h-36 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : trendData.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No trend data for the selected period. Try a wider date range.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {METRICS.filter((m) => activeMetrics.includes(m.key as string)).map((metric) => {
            const chartData = trendData.map((d) => ({
              label: d.period,
              value: d[metric.key] as number | null,
            }));
            const hasData = chartData.some((d) => d.value != null && d.value > 0);

            return (
              <div key={metric.key as string} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: metric.color }}
                    />
                    {metric.label}
                  </h3>
                  {hasData && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {metric.format(chartData.reduce((s, d) => s + (d.value ?? 0), 0) / Math.max(1, chartData.filter((d) => d.value != null).length))} avg
                    </span>
                  )}
                </div>
                {hasData ? (
                  <LineChart
                    data={chartData}
                    color={metric.color}
                    height={140}
                    formatValue={metric.format}
                  />
                ) : (
                  <div className="h-36 flex items-center justify-center text-xs text-muted-foreground">
                    No {metric.label.toLowerCase()} data
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
