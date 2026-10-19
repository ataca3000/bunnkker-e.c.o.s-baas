import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of
 * key strings can never type-check. The selector is the same expression
 * the compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

import {
  useDiagnostics,
  useExecutiveSummary,
  useFleetSummary,
  useHealthScore,
  useReadinessChecklist,
  useReadinessDashboard,
  useReadinessModules,
  useCapacitySummary,
  useDispatchSummary,
  useExceptionsSummary,
  useTodaySummary,
} from '../hooks/use-readiness';
import type { ChecklistItem, ModuleStatus } from '../types/readiness';

// ── Status vocabulary ────────────────────────────────────────────────────────

const STATUS: Record<ModuleStatus, { labelKey: LogisticsLabel; className: string }> = {
  ready: {
    labelKey: ($) => $.operations.readiness.status.ready,
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  degraded: {
    labelKey: ($) => $.operations.readiness.status.degraded,
    className: 'bg-amber-500 hover:bg-amber-500 text-white',
  },
  not_ready: {
    labelKey: ($) => $.operations.readiness.status.notReady,
    className: 'bg-destructive hover:bg-destructive text-destructive-foreground',
  },
};

function StatusBadge({ status }: { status: ModuleStatus }) {
  const { t } = useTranslation('logistics');
  const { labelKey, className } = STATUS[status];
  return <Badge className={`text-xs ${className}`}>{t(labelKey)}</Badge>;
}

function scoreTone(score: number): string {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-destructive';
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

/** A ring showing the health score — the single number a manager wants. */
function HealthRing({ score, grade }: { score: number; grade: string }) {
  const { t } = useTranslation('logistics');
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);
  const stroke =
    score >= 75 ? 'stroke-emerald-600' : score >= 40 ? 'stroke-amber-500' : 'stroke-destructive';

  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r="42" className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="42"
          className={`fill-none ${stroke}`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-semibold tabular-nums ${scoreTone(score)}`}>{score}</span>
        <span className="text-xs text-muted-foreground">
          {t($ => $.operations.readiness.gradeValue, { grade })}
        </span>
      </div>
    </div>
  );
}

function CheckIcon({ item }: { item: ChecklistItem }) {
  if (item.passed) return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />;
  if (item.severity === 'blocking') return <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />;
  return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />;
}

// ── Readiness tab ────────────────────────────────────────────────────────────

function ReadinessTab() {
  const { t } = useTranslation('logistics');
  const { data, isLoading } = useReadinessDashboard();
  const { data: checklist } = useReadinessChecklist();

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <Panel title={t($ => $.operations.readiness.panel.healthScore)}>
        <div className="flex flex-wrap items-center gap-6">
          <HealthRing score={data.health_score} grade={gradeFor(data.health_score)} />
          <div className="space-y-2">
            <StatusBadge status={data.overall_status} />
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="text-emerald-600">
                {t($ => $.operations.readiness.countReady, { count: data.ready_count })}
              </span>
              <span className="text-amber-600">
                {t($ => $.operations.readiness.countDegraded, { count: data.degraded_count })}
              </span>
              <span className="text-destructive">
                {t($ => $.operations.readiness.countNotReady, { count: data.not_ready_count })}
              </span>
            </div>
            <p className="max-w-md text-xs text-muted-foreground">
              {t($ => $.operations.readiness.weightingNote)}
            </p>
          </div>
        </div>
      </Panel>

      <Panel title={t($ => $.operations.readiness.panel.moduleReadiness)}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.modules.map((module) => (
            <div key={module.module} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{module.label}</span>
                <StatusBadge status={module.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t($ => $.operations.readiness.checksWeight, {
                  passed: module.passed_checks,
                  total: module.total_checks,
                  weight: module.weight,
                })}
              </p>
              {module.headline && (
                <p className="mt-1 text-xs text-amber-600">{module.headline}</p>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={t($ => $.operations.readiness.panel.checklist)}>
        {checklist && checklist.blocking_failures.length > 0 && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
            {t($ => $.operations.readiness.blockingChecks, {
              count: checklist.blocking_failures.length,
            })}
          </div>
        )}
        <ul className="space-y-1.5">
          {data.checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              <CheckIcon item={item} />
              <div className="min-w-0 flex-1">
                <span className={item.passed ? '' : 'font-medium'}>
                  {item.module_label}: {item.label}
                </span>
                <span className="ms-1.5 text-xs text-muted-foreground">{item.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function gradeFor(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ── Diagnostics tab ──────────────────────────────────────────────────────────

function DiagnosticsTab() {
  const { t } = useTranslation('logistics');
  const { data, isLoading } = useDiagnostics();

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const projections: Array<{ key: string; label: string; status: ModuleStatus }> = [
    { key: 'queue', label: t($ => $.operations.readiness.projection.queue), status: data.queue.status },
    { key: 'capacity', label: t($ => $.common.capacity), status: data.capacity.status },
    { key: 'dispatch', label: t($ => $.operations.readiness.projection.dispatch), status: data.dispatch.status },
    { key: 'exceptions', label: t($ => $.operations.readiness.projection.exceptions), status: data.exceptions.status },
  ];

  return (
    <div className="space-y-4">
      <Panel title={t($ => $.operations.readiness.panel.systemHealth)}>
        <div className="flex flex-wrap items-center gap-4">
          <StatusBadge status={data.system.status} />
          {data.system.is_quiet && (
            <span className="text-sm text-emerald-600">{t($ => $.operations.readiness.quiet)}</span>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{t($ => $.operations.readiness.countReady, { count: data.system.modules_ready })}</span>
            <span>
              {t($ => $.operations.readiness.countDegraded, { count: data.system.modules_degraded })}
            </span>
            <span>
              {t($ => $.operations.readiness.countNotReady, { count: data.system.modules_not_ready })}
            </span>
          </div>
        </div>
      </Panel>

      <Panel title={t($ => $.operations.readiness.panel.dependencyHealth)}>
        <div className="space-y-1.5">
          {data.dependencies.dependencies.map((dep) => (
            <div key={dep.name} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{dep.label}</span>
                {dep.reason && (
                  <span className="ms-2 text-xs text-muted-foreground">{dep.reason}</span>
                )}
              </div>
              <StatusBadge status={dep.status} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={t($ => $.operations.readiness.panel.projections)}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {projections.map((p) => (
            <div key={p.key} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{p.label}</span>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── Summary tab ──────────────────────────────────────────────────────────────

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
}

function SummaryTab() {
  const { t } = useTranslation('logistics');
  const { data: exec } = useExecutiveSummary();
  const { data: today } = useTodaySummary();
  const { data: fleet } = useFleetSummary();
  const { data: capacity } = useCapacitySummary();
  const { data: dispatchSummary } = useDispatchSummary();
  const { data: exceptions } = useExceptionsSummary();

  if (!exec || !today || !fleet) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-4">
      <Panel title={t($ => $.operations.readiness.panel.executive)}>
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryStat
            label={t($ => $.operations.readiness.stat.healthScore)}
            value={`${exec.health_score} (${exec.grade})`}
          />
          <SummaryStat
            label={t($ => $.operations.readiness.stat.criticalAlerts)}
            value={exec.headline.critical_alerts}
          />
          <SummaryStat
            label={t($ => $.operations.readiness.stat.canFieldToday)}
            value={exec.headline.fieldable_units}
          />
        </div>
      </Panel>

      <Panel title={t($ => $.operations.readiness.panel.todaysOperations)}>
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryStat
            label={t($ => $.operations.readiness.stat.activeSessions)}
            value={today.sessions_active}
          />
          <SummaryStat
            label={t($ => $.operations.readiness.stat.confirmed)}
            value={today.allocations_confirmed}
          />
          <SummaryStat
            label={t($ => $.operations.readiness.stat.confirmationRate)}
            value={pct(today.confirmation_rate)}
          />
          <SummaryStat
            label={t($ => $.operations.readiness.stat.queueDepth)}
            value={today.queue_depth}
          />
        </div>
      </Panel>

      <Panel title={t($ => $.operations.readiness.panel.fleet)}>
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryStat
            label={t($ => $.operations.readiness.stat.assignableVehicles)}
            value={fleet.vehicles.assignable}
          />
          <SummaryStat
            label={t($ => $.operations.readiness.stat.availableDrivers)}
            value={fleet.drivers.available}
          />
          <SummaryStat
            label={t($ => $.operations.readiness.stat.fieldableUnits)}
            value={fleet.fieldable_units}
          />
          <SummaryStat
            label={t($ => $.operations.readiness.stat.vehicleUseNow)}
            value={pct(fleet.vehicles.utilisation_now)}
          />
        </div>
      </Panel>
      <Panel title={t(($) => $.operations.readiness.modules.summaries.capacity)}>
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.slots)}
            value={capacity?.slots ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.avgUtilisation)}
            value={capacity?.avg_utilisation ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.exhausted)}
            value={capacity?.exhausted ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.currentlyHolding)}
            value={capacity?.currently_holding ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.refused)}
            value={capacity?.refused ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.refusalRate)}
            value={capacity?.refusal_rate ?? '—'}
          />
        </div>
      </Panel>

      <Panel title={t(($) => $.operations.readiness.modules.summaries.dispatch)}>
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.sessionsActive)}
            value={dispatchSummary?.sessions_active ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.allocationsConfirmed)}
            value={dispatchSummary?.allocations_confirmed ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.allocationsFailed)}
            value={dispatchSummary?.allocations_failed ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.confirmationRate)}
            value={dispatchSummary?.confirmation_rate ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.automaticShare)}
            value={dispatchSummary?.automatic_share ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.avgSessionMinutes)}
            value={dispatchSummary?.avg_session_minutes ?? '—'}
          />
        </div>
      </Panel>

      <Panel title={t(($) => $.operations.readiness.modules.summaries.exceptions)}>
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.outstanding)}
            value={exceptions?.outstanding ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.needsAttention)}
            value={exceptions?.needs_attention ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.critical)}
            value={exceptions?.critical ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.escalated)}
            value={exceptions?.escalated ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.recurring)}
            value={exceptions?.recurring ?? '—'}
          />
          <SummaryStat
            label={t(($) => $.operations.readiness.modules.summaries.overdue)}
            value={exceptions?.overdue_for_escalation ?? '—'}
          />
        </div>
      </Panel>

    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

/**
 * Enterprise Readiness.
 *
 * The completion layer: is the whole operation ready, why or why not, and the
 * executive digest. Every number belongs to Fleet, Network, Dispatch or
 * Operations — reported and interpreted here, never recomputed.
 */
/**
 * Per-module readiness.
 *
 * The diagnostics centre reports how many modules are ready, degraded or not
 * ready; this is the only endpoint that says which ones, and why.
 */
function ModulesTab() {
  const { t } = useTranslation('logistics');
  const { data, isLoading } = useReadinessModules();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data || data.modules.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        {t(($) => $.operations.readiness.modules.empty)}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-start font-medium">
                {t(($) => $.operations.readiness.modules.module)}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t(($) => $.operations.readiness.modules.status)}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t(($) => $.operations.readiness.modules.checks)}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t(($) => $.operations.readiness.modules.headline)}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.modules.map((row) => (
              <tr key={row.module}>
                <td className="px-3 py-2 font-medium">{row.label}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2 tabular-nums">
                  {row.passed_checks} / {row.total_checks}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.headline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t(($) => $.operations.readiness.modules.diagnosticsNote)}
      </p>
    </div>
  );
}

export function EnterpriseReadinessPage() {
  const { t } = useTranslation('logistics');
  const { data: score, refetch, isFetching } = useHealthScore();

  const metrics = [
    {
      id: 'score',
      icon: CheckCircle2,
      label: t($ => $.operations.readiness.metrics.healthScore),
      value: score?.score ?? 0,
      isLoading: !score,
      colorClass: score ? scoreTone(score.score) : undefined,
    },
    {
      id: 'status',
      icon: score?.overall_status === 'ready' ? CheckCircle2 : AlertTriangle,
      label: t($ => $.operations.readiness.metrics.overall),
      value: score ? t(STATUS[score.overall_status].labelKey) : '—',
      isLoading: !score,
    },
    {
      id: 'grade',
      icon: CheckCircle2,
      label: t($ => $.operations.readiness.metrics.grade),
      value: score?.grade ?? '—',
      isLoading: !score,
    },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[
          { label: t($ => $.operations.readiness.breadcrumbRoot) },
          { label: t($ => $.operations.readiness.breadcrumbSection) },
        ]}
        title={t($ => $.operations.readiness.title)}
        description={t($ => $.operations.readiness.description)}
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar onRefresh={() => refetch()} isFetching={isFetching} />
          </div>
        }
      >
        <div className="px-4 pb-6 sm:px-6">
          <Tabs defaultValue="readiness" className="w-full">
            <TabsList>
              <TabsTrigger value="readiness">Readiness</TabsTrigger>
              <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="modules">
                {t(($) => $.operations.readiness.modules.tab)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="readiness" className="pt-4">
              <ReadinessTab />
            </TabsContent>
            <TabsContent value="diagnostics" className="pt-4">
              <DiagnosticsTab />
            </TabsContent>
            <TabsContent value="summary" className="pt-4">
              <SummaryTab />
            </TabsContent>
            <TabsContent value="modules" className="pt-4">
              <ModulesTab />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspacePage>
    </>
  );
}
