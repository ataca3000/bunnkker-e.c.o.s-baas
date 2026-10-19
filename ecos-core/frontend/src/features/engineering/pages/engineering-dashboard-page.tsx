import { useState } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Activity, Clock, ListChecks } from 'lucide-react';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { QuickStatCard } from '@/components/ds/quick-stat-card';
import { useEngineeringDashboard } from '../hooks/use-engineering';
import { QualityScoreGauge } from '../components/QualityScoreGauge';
import { ScoreTrendChart } from '../components/ScoreTrendChart';
import { CategoryStatusGrid } from '../components/CategoryStatusGrid';
import { SeverityBadge } from '../components/SeverityBadge';
import { RunDetailDrawer } from '../components/RunDetailDrawer';

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function EngineeringDashboardPage() {
  const { data, isLoading, isFetching, refetch } = useEngineeringDashboard();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const latest = data?.latest_run ?? null;
  const trend = data?.score_trend ?? [];
  const counts = data?.findings_count ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

  return (
    <div className="flex flex-col gap-6 p-6">
      <WorkspaceHeader
        title="Engineering OS"
        description="Real-time certification quality score and release readiness"
        primaryAction={{
          key: 'refresh',
          label: isFetching ? 'Refreshing…' : 'Refresh',
          icon: RefreshCw,
          onClick: () => refetch(),
          disabled: isFetching,
        }}
      />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading certification data…
        </div>
      ) : !data?.has_data ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Activity className="h-10 w-10 opacity-30" />
          <p className="font-medium">No certification runs yet</p>
          <p className="text-sm">Run <code>bash engineering/certification/certification.sh</code> then import with <code>php artisan engineering:import</code></p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <QuickStatCard
              icon={Activity}
              title="Quality Score"
              value={`${latest?.overall_score ?? 0}/100`}
              colorClassName={
                (latest?.overall_score ?? 0) >= 90 ? 'text-green-600' :
                (latest?.overall_score ?? 0) >= 80 ? 'text-yellow-600' :
                'text-red-600'
              }
            />
            <QuickStatCard
              icon={latest?.release_ready ? CheckCircle2 : XCircle}
              title="Release Status"
              value={latest?.release_ready ? 'Ready' : 'Blocked'}
              colorClassName={latest?.release_ready ? 'text-green-600' : 'text-red-600'}
            />
            <QuickStatCard
              icon={ListChecks}
              title="Total Runs"
              value={data?.total_runs ?? 0}
              colorClassName="text-blue-600"
            />
            <QuickStatCard
              icon={Clock}
              title="Last Run"
              value={latest ? formatRelativeTime(latest.certified_at) : '—'}
              colorClassName="text-muted-foreground"
            />
          </div>

          {/* Main content grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Gauge + release card */}
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-card p-4 flex flex-col items-center gap-3">
                <p className="text-sm font-semibold text-muted-foreground">Overall Score</p>
                <QualityScoreGauge score={latest?.overall_score ?? 0} size={160} />
                {latest?.release_ready ? (
                  <div className="flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Release Ready
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 w-full">
                    <div className="flex items-center gap-2 rounded-full bg-red-100 px-4 py-1.5 text-sm font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <XCircle className="h-4 w-4" />
                      Not Release Ready
                    </div>
                    {(latest?.blockers ?? []).length > 0 && (
                      <ul className="mt-1 w-full space-y-0.5">
                        {latest!.blockers.map((b, i) => (
                          <li key={i} className="text-xs text-red-600 dark:text-red-400 truncate">• {b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Findings summary */}
              <div className="rounded-lg border bg-card p-4">
                <p className="mb-3 text-sm font-semibold text-muted-foreground">Latest Run Findings</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
                    <div key={sev} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                      <SeverityBadge severity={sev} />
                      <span className="text-sm font-bold tabular-nums">{counts[sev]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Score trend + categories */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              <div className="rounded-lg border bg-card p-4">
                <p className="mb-3 text-sm font-semibold text-muted-foreground">
                  Score Trend (last {trend.length} runs)
                </p>
                <ScoreTrendChart data={trend} height={90} />
              </div>

              {latest?.categories && (
                <div className="rounded-lg border bg-card p-4">
                  <p className="mb-3 text-sm font-semibold text-muted-foreground">Category Breakdown</p>
                  <CategoryStatusGrid categories={latest.categories} />
                </div>
              )}
            </div>
          </div>

          {/* Recent runs */}
          {trend.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-3 text-sm font-semibold text-muted-foreground">Recent Runs</p>
              <div className="space-y-2">
                {trend.slice(-5).reverse().map((point, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <span className="text-muted-foreground text-xs">{point.date}</span>
                    <span className="flex-1 font-medium tabular-nums">{point.score}/100</span>
                    {point.release_ready ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <RunDetailDrawer runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
    </div>
  );
}
