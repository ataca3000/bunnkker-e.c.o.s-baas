import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react';

import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import {
  useBottlenecks,
  useCapacityForecast,
  useCapacityWarnings,
  useConflictRecommendations,
  useDecisionPriorities,
  useDecisionSummary,
  useDispatchForecast,
  useOperationalInsights,
  useOptimization,
  useSmartSuggestions,
  useWorkloadForecast,
} from '../hooks/use-intelligence';
import {
  OPTIMIZATION_KINDS,
  type OptimizationKind,
  type Recommendation,
} from '../types/intelligence';

type LogisticsLabel = ($: typeof enLogistics) => string;

const OPTIMIZATION_LABEL: Record<OptimizationKind, LogisticsLabel> = {
  vehicle: ($) => $.intelligence.optimization.vehicle,
  capacity: ($) => $.intelligence.optimization.capacity,
  route: ($) => $.intelligence.optimization.route,
  assignment: ($) => $.intelligence.optimization.assignment,
};

/**
 * Severity is a free string on the engines, so it is rendered as sent and only
 * the few values the platform actually emits get a colour. An unknown severity
 * still shows its own text rather than falling into a wrong bucket.
 */
const SEVERITY_CLASS: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'bg-muted text-muted-foreground',
  info: 'bg-muted text-muted-foreground',
};

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function RecommendationList({
  items,
  emptyLabel,
}: {
  items: Recommendation[] | undefined;
  emptyLabel: string;
}) {
  const { t } = useTranslation('logistics');
  const list = items ?? [];

  if (list.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;

  return (
    <ul className="flex flex-col gap-2">
      {list.map((item, index) => (
        <li key={`${item.title}-${index}`} className="flex flex-col gap-1 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{item.title}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={SEVERITY_CLASS[item.severity] ?? ''}>
                {item.severity}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {t(($) => $.intelligence.decisions.priority)} {item.priority}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{item.action}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              {t(($) => $.intelligence.decisions.category)}: {item.category}
            </span>
            <span>
              {t(($) => $.intelligence.decisions.sourceModule)}: {item.source_module}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Optimisation payloads differ per endpoint; render whatever keys arrive. */
function OptimizationPanel({ kind }: { kind: OptimizationKind }) {
  const { t } = useTranslation('logistics');
  const { data, isLoading } = useOptimization(kind);

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const entries = Object.entries(data ?? {});
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t(($) => $.intelligence.optimization.empty)}</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, value]) => (
        <Stat
          key={key}
          label={key}
          value={
            typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value ?? '—')
          }
        />
      ))}
    </div>
  );
}

/**
 * Logistics Intelligence.
 *
 * Read-only by construction — the whole surface is GET, and the page says so.
 * Nothing is computed here: rankings, tightness scores and projections all come
 * from the engines, and each forecast's own method and caveat are shown beside
 * its numbers rather than dropped.
 */
export function LogisticsIntelligencePage() {
  const { t, i18n } = useTranslation('logistics');
  const [tab, setTab] = useState('decisions');
  const [optimizationKind, setOptimizationKind] = useState<OptimizationKind>('assignment');

  const decisions = useDecisionSummary();
  const priorities = useDecisionPriorities();
  const conflicts = useConflictRecommendations();
  const suggestions = useSmartSuggestions();
  const bottlenecks = useBottlenecks();
  const warnings = useCapacityWarnings();
  const insights = useOperationalInsights();
  const capacity = useCapacityForecast();
  const dispatch = useDispatchForecast();
  const workload = useWorkloadForecast();

  const isFetching =
    decisions.isFetching || suggestions.isFetching || capacity.isFetching || dispatch.isFetching;
  const isError = decisions.isError || suggestions.isError;

  const dateTime = (value: string | undefined) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';
  const num = (value: number | undefined) =>
    value === undefined ? '—' : new Intl.NumberFormat(i18n.language).format(value);

  function refreshAll() {
    void decisions.refetch();
    void priorities.refetch();
    void conflicts.refetch();
    void suggestions.refetch();
    void bottlenecks.refetch();
    void warnings.refetch();
    void insights.refetch();
    void capacity.refetch();
    void dispatch.refetch();
    void workload.refetch();
  }

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.title) }, { label: t(($) => $.intelligence.title) }]}
        title={t(($) => $.intelligence.title)}
        description={t(($) => $.intelligence.subtitle)}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar
              onRefresh={refreshAll}
              isFetching={isFetching}
              refreshLabel={t(($) => $.intelligence.refresh)}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-5 px-4 pb-6 sm:px-6">
          <p className="text-[11px] text-muted-foreground">
            {t(($) => $.intelligence.readOnlyNote)}
          </p>

          {isError && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.intelligence.error)}</AlertDescription>
            </Alert>
          )}

          <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
            <TabsList className="flex-wrap">
              <TabsTrigger value="decisions">
                {t(($) => $.intelligence.tabs.decisions)}
              </TabsTrigger>
              <TabsTrigger value="insights">{t(($) => $.intelligence.tabs.insights)}</TabsTrigger>
              <TabsTrigger value="forecasts">
                {t(($) => $.intelligence.tabs.forecasts)}
              </TabsTrigger>
              <TabsTrigger value="optimization">
                {t(($) => $.intelligence.tabs.optimization)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="decisions" className="flex flex-col gap-5">
              {decisions.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                decisions.data && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat
                      label={t(($) => $.intelligence.decisions.overallStatus)}
                      value={decisions.data.overall_status}
                    />
                    <Stat
                      label={t(($) => $.intelligence.decisions.count)}
                      value={decisions.data.recommendation_count}
                    />
                    <Stat
                      label={t(($) => $.intelligence.decisions.topPriority)}
                      value={decisions.data.top_priority?.title ?? '—'}
                    />
                    <Stat
                      label={t(($) => $.intelligence.generatedAt)}
                      value={dateTime(decisions.data.generated_at)}
                    />
                  </div>
                )
              )}

              <Section title={t(($) => $.intelligence.decisions.recommendations)}>
                <RecommendationList
                  items={decisions.data?.recommendations}
                  emptyLabel={t(($) => $.intelligence.decisions.noRecommendations)}
                />
              </Section>

              <Section title={t(($) => $.intelligence.decisions.conflicts)}>
                <RecommendationList
                  items={conflicts.data}
                  emptyLabel={t(($) => $.intelligence.decisions.noConflicts)}
                />
              </Section>

              <Section title={t(($) => $.intelligence.decisions.priorities)}>
                {(priorities.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t(($) => $.intelligence.decisions.noRecommendations)}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border bg-card">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2 text-start font-medium">
                            {t(($) => $.intelligence.decisions.priority)}
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            {t(($) => $.intelligence.decisions.severity)}
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            {t(($) => $.intelligence.decisions.action)}
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            {t(($) => $.intelligence.decisions.sourceModule)}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(priorities.data ?? []).map((row, index) => (
                          <tr key={`${row.title}-${index}`}>
                            <td className="px-3 py-2 tabular-nums">{row.priority}</td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="secondary"
                                className={SEVERITY_CLASS[row.severity] ?? ''}
                              >
                                {row.severity}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">{row.title}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.source_module}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="insights" className="flex flex-col gap-5">
              <Section title={t(($) => $.intelligence.insights.suggestions)}>
                {(suggestions.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t(($) => $.intelligence.insights.noSuggestions)}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {(suggestions.data ?? []).map((item, index) => (
                      <li
                        key={`${item.title}-${index}`}
                        className="flex flex-col gap-1 rounded-md border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            {item.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className={SEVERITY_CLASS[item.severity] ?? ''}
                          >
                            {item.severity}
                          </Badge>
                        </div>
                        <p className="text-sm">{item.suggestion}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t(($) => $.intelligence.insights.why)}: {item.why}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t(($) => $.intelligence.insights.owningModule)}: {item.owning_module}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title={t(($) => $.intelligence.insights.bottlenecks)}
                note={t(($) => $.intelligence.insights.tightnessNote)}
              >
                {(bottlenecks.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t(($) => $.intelligence.insights.noBottlenecks)}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {(bottlenecks.data ?? []).map((item, index) => (
                      <li
                        key={`${item.module}-${index}`}
                        className="flex flex-col gap-1 rounded-md border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">{item.reason}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {t(($) => $.intelligence.insights.tightness)} {item.tightness}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.action}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t(($) => $.intelligence.insights.module)}: {item.module}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={t(($) => $.intelligence.insights.warnings)}>
                {(warnings.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t(($) => $.intelligence.insights.noWarnings)}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {(warnings.data ?? []).map((item, index) => (
                      <li
                        key={`${item.level}-${index}`}
                        className="flex items-center gap-2 rounded-md border p-3 text-sm"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span>{item.message}</span>
                        <Badge variant="outline" className="ms-auto text-[10px]">
                          {item.level}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={t(($) => $.intelligence.insights.operational)}>
                {(insights.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t(($) => $.intelligence.insights.noInsights)}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {(insights.data ?? []).map((item, index) => (
                      <li
                        key={`${item.topic}-${index}`}
                        className="flex flex-col gap-1 rounded-md border p-3"
                      >
                        <span className="text-sm font-medium">{item.topic}</span>
                        <p className="text-sm text-muted-foreground">{item.insight}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t(($) => $.intelligence.insights.signal)}: {item.signal}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="forecasts" className="flex flex-col gap-5">
              <p className="text-[11px] text-muted-foreground">
                {t(($) => $.intelligence.forecasts.methodNote)}
              </p>

              <Section title={t(($) => $.intelligence.forecasts.capacity)}>
                {capacity.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  capacity.data && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Stat
                          label={t(($) => $.intelligence.forecasts.projected)}
                          value={
                            <span className="flex items-center gap-2">
                              <TrendingUp className="h-3.5 w-3.5" />
                              {capacity.data.projected_status}
                            </span>
                          }
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.avgUtilisation)}
                          value={num(capacity.data.avg_utilisation)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.headroomShare)}
                          value={num(capacity.data.headroom_share)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.exhaustedSlots)}
                          value={num(capacity.data.exhausted_slots)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.nearCapacitySlots)}
                          value={num(capacity.data.near_capacity_slots)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.refusalRate)}
                          value={num(capacity.data.refusal_rate)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.method)}
                          value={capacity.data.method}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.horizon)}
                          value={capacity.data.horizon}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{capacity.data.note}</p>
                    </>
                  )
                )}
              </Section>

              <Section title={t(($) => $.intelligence.forecasts.dispatch)}>
                {dispatch.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  dispatch.data && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Stat
                          label={t(($) => $.intelligence.forecasts.projected)}
                          value={dispatch.data.projected_pressure}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.queueDepth)}
                          value={num(dispatch.data.queue_depth)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.needsAction)}
                          value={num(dispatch.data.needs_action)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.stuck)}
                          value={num(dispatch.data.stuck)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.oldestWait)}
                          value={num(dispatch.data.oldest_wait_minutes)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.confirmationRate)}
                          value={num(dispatch.data.confirmation_rate)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.method)}
                          value={dispatch.data.method}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.horizon)}
                          value={dispatch.data.horizon}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{dispatch.data.note}</p>
                    </>
                  )
                )}
              </Section>

              <Section title={t(($) => $.intelligence.forecasts.workload)}>
                {workload.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  workload.data && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Stat
                          label={t(($) => $.intelligence.forecasts.projected)}
                          value={workload.data.projected_level}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.queueNeedsAction)}
                          value={num(workload.data.queue_needs_action)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.exceptionsNeedingAttention)}
                          value={num(workload.data.exceptions_needing_attention)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.criticalExceptions)}
                          value={num(workload.data.critical_exceptions)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.openWorkItems)}
                          value={num(workload.data.open_work_items)}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.method)}
                          value={workload.data.method}
                        />
                        <Stat
                          label={t(($) => $.intelligence.forecasts.horizon)}
                          value={workload.data.horizon}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{workload.data.note}</p>
                    </>
                  )
                )}
              </Section>
            </TabsContent>

            <TabsContent value="optimization" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {OPTIMIZATION_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setOptimizationKind(kind)}
                    className={
                      optimizationKind === kind
                        ? 'rounded-md border bg-secondary px-3 py-1.5 text-xs font-medium'
                        : 'rounded-md border px-3 py-1.5 text-xs text-muted-foreground'
                    }
                  >
                    {t(OPTIMIZATION_LABEL[kind])}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground">
                {t(($) => $.intelligence.optimization.shapeNote)}
              </p>

              <OptimizationPanel kind={optimizationKind} />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspacePage>
    </>
  );
}

export default LogisticsIntelligencePage;
