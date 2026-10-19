import { BarChart2, CheckCircle2, Clock, RefreshCw, TrendingDown, XCircle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn }    from '@/lib/utils';
import { usePipelineAnalytics }  from '../hooks/use-engineering';
import { STAGE_LABELS }           from '../types/engineering';
import type { PipelineStatus }    from '../types/engineering';

const STATUS_BADGE: Record<PipelineStatus, { label: string; className: string }> = {
  pending:   { label: 'Pending',   className: 'bg-muted text-muted-foreground' },
  running:   { label: 'Running',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  failed:    { label: 'Failed',    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
};

function fmt(secs: number | null | undefined): string {
  if (secs == null || secs === 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function KpiCard({ label, value, sub, icon: Icon, className }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-border/60 bg-card p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <Icon className="h-5 w-5 text-muted-foreground/60 mt-0.5" />
      </div>
    </div>
  );
}

export function EngineeringAnalyticsPage() {
  const { data, isLoading, refetch, isFetching } = usePipelineAnalytics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <BarChart2 className="h-10 w-10 opacity-20" />
        <p className="text-sm">No analytics data available yet.</p>
      </div>
    );
  }

  const slowestLabel = data.slowest_stage
    ? (STAGE_LABELS[data.slowest_stage.stage as keyof typeof STAGE_LABELS] ?? data.slowest_stage.stage)
    : '—';

  const stageDurationEntries = Object.entries(data.stage_durations)
    .sort(([, a], [, b]) => b.avg_seconds - a.avg_seconds);

  const maxAvg = stageDurationEntries[0]?.[1]?.avg_seconds ?? 1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Pipeline Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Last {data.lookback_days} days — {data.total_in_window} pipeline{data.total_in_window !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="In Queue"          value={data.queue_size}     icon={Clock}         />
          <KpiCard label="Running"           value={data.running_count}  icon={Zap}           />
          <KpiCard label="Success Rate"      value={`${data.success_rate}%`} icon={CheckCircle2} className={data.success_rate >= 80 ? 'border-green-200' : 'border-amber-200'} />
          <KpiCard label="Failure Rate"      value={`${data.failure_rate}%`} icon={XCircle}      className={data.failure_rate > 20 ? 'border-red-200' : ''} />
          <KpiCard label="Avg Duration"      value={fmt(data.avg_duration_seconds)} icon={Clock} />
          <KpiCard label="Total Retries"     value={data.total_retries}  icon={RefreshCw}     sub={`last ${data.lookback_days}d`} />
        </div>

        {/* Stage duration breakdown */}
        {stageDurationEntries.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Stage Duration Breakdown
              {data.slowest_stage && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  Slowest: <strong className="text-foreground">{slowestLabel}</strong> ({fmt(data.slowest_stage.avg_seconds)} avg)
                </span>
              )}
            </h2>

            <div className="space-y-3">
              {stageDurationEntries.map(([handler, stat]) => {
                const label = STAGE_LABELS[handler as keyof typeof STAGE_LABELS] ?? handler;
                const pct   = maxAvg > 0 ? (stat.avg_seconds / maxAvg) * 100 : 0;

                return (
                  <div key={handler}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{stat.total_runs} runs</span>
                        <span className="font-mono text-foreground">{fmt(stat.avg_seconds)} avg</span>
                        <span className="text-muted-foreground/60">max {fmt(stat.max_seconds)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent pipelines */}
        {data.recent_pipelines.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border/60">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-primary" />
                Recent Pipelines
              </h2>
            </div>

            <div className="divide-y divide-border/60">
              {data.recent_pipelines.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.task_name}</p>
                    <p className="text-xs text-muted-foreground">{p.branch} · {p.initiated_by}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground font-mono">{fmt(p.duration_seconds)}</span>
                    <Badge className={cn('text-xs border-0', STATUS_BADGE[p.status].className)}>
                      {STATUS_BADGE[p.status].label}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {data.total_in_window === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <BarChart2 className="h-10 w-10 opacity-20" />
            <p className="text-sm">No pipelines run in the last {data.lookback_days} days.</p>
          </div>
        )}

      </div>
    </div>
  );
}
