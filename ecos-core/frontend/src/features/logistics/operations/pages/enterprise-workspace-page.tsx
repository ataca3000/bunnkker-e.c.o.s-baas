import { AlertTriangle, CheckCircle2, Cpu, Gauge, TrendingUp, XCircle } from 'lucide-react';

import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useExecutiveDashboard, useOperationsDashboard } from '../hooks/use-enterprise';
import type { ModuleStatus } from '../types/readiness';
import type { Severity } from '../types/enterprise';

// ── Shared vocabulary ────────────────────────────────────────────────────────

const STATUS: Record<ModuleStatus, { label: string; className: string }> = {
  ready: { label: 'Ready', className: 'bg-emerald-600 text-white' },
  degraded: { label: 'Degraded', className: 'bg-amber-500 text-white' },
  not_ready: { label: 'Not ready', className: 'bg-destructive text-destructive-foreground' },
};

const SEVERITY: Record<Severity, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-amber-500 text-white',
  medium: 'bg-sky-600 text-white',
  low: 'bg-muted text-muted-foreground',
};

/** A forecast/level word → tone, so it reads at a glance and by screen reader. */
const LEVEL_TONE: Record<string, string> = {
  exhausted: 'text-destructive',
  severe: 'text-destructive',
  at_risk: 'text-amber-600',
  high: 'text-amber-600',
  tightening: 'text-amber-600',
  moderate: 'text-amber-600',
  comfortable: 'text-emerald-600',
  low: 'text-emerald-600',
  no_data: 'text-muted-foreground',
};

function StatusBadge({ status }: { status: ModuleStatus }) {
  const { label, className } = STATUS[status];
  return <Badge className={`text-xs ${className}`}>{label}</Badge>;
}

function scoreTone(score: number): string {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-destructive';
}

function Panel({
  title,
  children,
  labelledBy,
}: {
  title: string;
  children: React.ReactNode;
  labelledBy: string;
}) {
  return (
    <section aria-labelledby={labelledBy} className="rounded-lg border bg-card p-4">
      <h3 id={labelledBy} className="mb-3 text-sm font-medium">
        {title}
      </h3>
      {children}
    </section>
  );
}

// ── Executive ────────────────────────────────────────────────────────────────

function ExecutiveTab() {
  const { data, isLoading } = useExecutiveDashboard();

  if (isLoading || !data) return <Skeleton className="h-96 w-full" aria-label="Loading executive dashboard" />;

  const headlineItems = [
    { label: 'Critical alerts', value: data.headline.critical_alerts, bad: data.headline.critical_alerts > 0 },
    { label: 'Open exceptions', value: data.headline.open_exceptions, warn: data.headline.open_exceptions > 0 },
    { label: 'Unhealthy pools', value: data.headline.unhealthy_pools, warn: data.headline.unhealthy_pools > 0 },
    { label: 'Exhausted slots', value: data.headline.exhausted_capacity_slots, warn: data.headline.exhausted_capacity_slots > 0 },
    { label: 'Can field today', value: data.headline.fieldable_units, good: true },
    { label: 'Overdue escalations', value: data.headline.overdue_escalations, bad: data.headline.overdue_escalations > 0 },
  ];

  return (
    <div className="space-y-4">
      <Panel title="Logistics health" labelledBy="exec-health">
        <div className="flex flex-wrap items-center gap-6">
          <div
            role="img"
            aria-label={`Health score ${data.health.score} out of 100, grade ${data.health.grade}, ${STATUS[data.health.overall_status].label}`}
            className="flex flex-col items-center"
          >
            <span className={`text-4xl font-semibold tabular-nums ${scoreTone(data.health.score)}`}>
              {data.health.score}
            </span>
            <span className="text-xs text-muted-foreground">Grade {data.health.grade}</span>
          </div>
          <div className="space-y-2">
            <StatusBadge status={data.health.overall_status} />
            {data.is_quiet && (
              <p className="text-sm text-emerald-600">
                The operation is healthy — nothing needs a person right now.
              </p>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Headline" labelledBy="exec-headline">
        <dl className="grid gap-3 sm:grid-cols-3">
          {headlineItems.map((item) => (
            <div key={item.label} className="rounded-md border p-3">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {item.label}
              </dt>
              <dd
                className={`mt-1 text-2xl tabular-nums ${
                  item.bad ? 'text-destructive' : item.warn ? 'text-amber-600' : item.good ? 'text-emerald-600' : ''
                }`}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Top decision" labelledBy="exec-decision">
          {data.decisions.top_priority === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No recommendation outstanding.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`text-xs ${SEVERITY[data.decisions.top_priority.severity]}`}>
                  {data.decisions.top_priority.severity}
                </Badge>
                <span className="text-sm font-medium">{data.decisions.top_priority.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{data.decisions.top_priority.detail}</p>
              <p className="text-xs">
                <span className="font-medium">Action:</span> {data.decisions.top_priority.action}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {data.decisions.total} recommendation{data.decisions.total === 1 ? '' : 's'} in total.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Forecasts" labelledBy="exec-forecasts">
          <dl className="space-y-2 text-sm">
            {[
              { label: 'Capacity', value: data.forecasts.capacity, icon: Gauge },
              { label: 'Dispatch pressure', value: data.forecasts.dispatch_pressure, icon: TrendingUp },
              { label: 'Workload', value: data.forecasts.workload, icon: Cpu },
            ].map((f) => (
              <div key={f.label} className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <f.icon className="size-4" aria-hidden="true" />
                  {f.label}
                </dt>
                <dd className={`font-medium capitalize ${LEVEL_TONE[f.value] ?? ''}`}>
                  {f.value.replace('_', ' ')}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Deterministic projections from current figures — not statistical predictions.
          </p>
        </Panel>
      </div>
    </div>
  );
}

// ── Operations ───────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === 'critical') return <XCircle className="size-3.5 shrink-0 text-destructive" aria-hidden="true" />;
  if (severity === 'high' || severity === 'medium')
    return <AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-hidden="true" />;
  return <CheckCircle2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

function OperationsTab() {
  const { data, isLoading } = useOperationsDashboard();

  if (isLoading || !data) return <Skeleton className="h-96 w-full" aria-label="Loading operations dashboard" />;

  return (
    <div className="space-y-4">
      <Panel title="Module readiness" labelledBy="ops-modules">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.modules.map((module) => (
            <li key={module.module} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{module.label}</span>
                <StatusBadge status={module.status} />
              </div>
              {module.headline && (
                <p className="mt-1 text-xs text-amber-600">{module.headline}</p>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {data.bottleneck && (
        <Panel title="Binding constraint" labelledBy="ops-bottleneck">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium capitalize">
                {data.bottleneck.module}: {data.bottleneck.reason}
              </p>
              <p className="text-xs text-muted-foreground">{data.bottleneck.action}</p>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Top suggestions" labelledBy="ops-suggestions">
        {data.suggestions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing to suggest — the operation is running clean.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.suggestions.map((suggestion, index) => (
              <li key={`${suggestion.title}-${index}`} className="flex items-start gap-2">
                <SeverityIcon severity={suggestion.severity} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{suggestion.title}</p>
                  <p className="text-xs text-muted-foreground">{suggestion.suggestion}</p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {suggestion.owning_module}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Capacity warnings" labelledBy="ops-warnings">
          {data.capacity_warnings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No capacity warnings.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.capacity_warnings.map((warning, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-block size-2 rounded-full ${
                      warning.level === 'critical' ? 'bg-destructive' : 'bg-amber-500'
                    }`}
                    aria-hidden="true"
                  />
                  {warning.message}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Automation" labelledBy="ops-automation">
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Event consumers</dt>
              <dd className="tabular-nums">{data.automation.consumer_count}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Active policies</dt>
              <dd className="tabular-nums">{data.automation.policy_count}</dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Domain events are consumed on background workers and turned into notifications.
          </p>
        </Panel>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

/**
 * Enterprise Workspace.
 *
 * The production completion surface: an executive dashboard and an operations
 * dashboard, each an aggregated read that composes the readiness, intelligence
 * and automation layers — one request per dashboard.
 */
export function EnterpriseWorkspacePage() {
  const { data, refetch, isFetching } = useExecutiveDashboard();

  const metrics = [
    {
      id: 'score',
      icon: CheckCircle2,
      label: 'Health Score',
      value: data?.health.score ?? 0,
      isLoading: !data,
      colorClass: data ? scoreTone(data.health.score) : undefined,
    },
    {
      id: 'grade',
      icon: TrendingUp,
      label: 'Grade',
      value: data?.health.grade ?? '—',
      isLoading: !data,
    },
    {
      id: 'decisions',
      icon: Cpu,
      label: 'Recommendations',
      value: data?.decisions.total ?? 0,
      isLoading: !data,
    },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Logistics OS' }, { label: 'Enterprise' }]}
        title="Enterprise Workspace"
        description="Executive and operations dashboards — readiness, intelligence and automation in one view"
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
          <Tabs defaultValue="executive" className="w-full">
            <TabsList aria-label="Enterprise dashboards">
              <TabsTrigger value="executive">Executive</TabsTrigger>
              <TabsTrigger value="operations">Operations</TabsTrigger>
            </TabsList>

            <TabsContent value="executive" className="pt-4">
              <ExecutiveTab />
            </TabsContent>
            <TabsContent value="operations" className="pt-4">
              <OperationsTab />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspacePage>
    </>
  );
}
