import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, XCircle } from 'lucide-react';

import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { Pagination } from '@/components/crud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  useActivityTimeline,
  useAssignmentHistory,
  useAuditExplorer,
  useCapacityHistory,
  useSessionHistory,
} from '../hooks/use-operations-analytics';
import type { ActivityItem, ActivitySource } from '../types/analytics';

function SeverityDot({ severity }: { severity: ActivityItem['severity'] }) {
  if (severity === 'critical') return <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />;
  if (severity === 'warning') return <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />;
  return <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />;
}

const SOURCE_LABEL_KEY: Record<ActivitySource, LogisticsLabel> = {
  dispatch_timeline: ($) => $.operations.activityCenter.source.dispatchTimeline,
  dispatch_audit: ($) => $.operations.activityCenter.source.dispatchAudit,
  capacity_audit: ($) => $.operations.activityCenter.source.capacityAudit,
  escalation: ($) => $.operations.activityCenter.source.escalation,
  note: ($) => $.operations.activityCenter.source.note,
};

/** A vertical time-ordered list — the Timeline component pattern. */
function ActivityList({ items }: { items: ActivityItem[] }) {
  const { t } = useTranslation('logistics');

  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t($ => $.operations.activityCenter.emptyWindow)}
      </p>
    );
  }

  return (
    <ol className="relative space-y-4 border-s ps-5">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -start-[26px] top-0.5 rounded-full bg-background p-0.5">
            <SeverityDot severity={item.severity} />
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{item.title}</span>
            <Badge variant="outline" className="text-[10px]">
              {t(SOURCE_LABEL_KEY[item.source])}
            </Badge>
          </div>
          {item.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {item.occurred_at ? new Date(item.occurred_at).toLocaleString() : '—'}
            {item.actor_name ? ` · ${item.actor_name}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}

const SOURCE_FILTERS: Array<{ key: ActivitySource | 'all'; labelKey: LogisticsLabel }> = [
  { key: 'all', labelKey: ($) => $.common.all },
  { key: 'dispatch_timeline', labelKey: ($) => $.operations.activityCenter.source.dispatchTimeline },
  { key: 'capacity_audit', labelKey: ($) => $.operations.activityCenter.source.capacityAudit },
  { key: 'escalation', labelKey: ($) => $.operations.activityCenter.filter.escalations },
  { key: 'note', labelKey: ($) => $.operations.activityCenter.filter.notes },
];

function TimelineTab() {
  const { t } = useTranslation('logistics');
  const [source, setSource] = useState<ActivitySource | 'all'>('all');
  const { data, isLoading } = useActivityTimeline(
    source === 'all' ? undefined : { source },
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {SOURCE_FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={source === f.key ? 'secondary' : 'ghost'}
            className="h-8 text-xs"
            onClick={() => setSource(f.key)}
          >
            {t(f.labelKey)}
          </Button>
        ))}
      </div>

      {/* Truncation is never silent — say what was dropped. */}
      {data && data.window_truncated && (
        <Alert>
          <AlertDescription className="text-xs">
            {t($ => $.operations.activityCenter.truncated.showing, {
              returned: data.returned,
              available: data.available,
            })}
            {data.truncated_sources.length > 0
              ? t($ => $.operations.activityCenter.truncated.cappedSources, {
                  sources: data.truncated_sources.join(', '),
                })
              : ''}
            {t($ => $.operations.activityCenter.truncated.narrow)}
          </AlertDescription>
        </Alert>
      )}

      {isLoading || !data ? <Skeleton className="h-64 w-full" /> : <ActivityList items={data.items} />}
    </div>
  );
}

function AuditTab() {
  const { t } = useTranslation('logistics');
  const { data, isLoading } = useAuditExplorer();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t($ => $.operations.activityCenter.auditIntro)}</p>
      {isLoading || !data ? <Skeleton className="h-64 w-full" /> : <ActivityList items={data.items} />}
    </div>
  );
}

function AssignmentsTab() {
  const { t } = useTranslation('logistics');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAssignmentHistory({ page });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-3">
      {isLoading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t($ => $.operations.activityCenter.assignments.empty)}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <th className="h-10 px-3 font-medium">{t($ => $.common.status)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.operations.activityCenter.assignments.colMode)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.common.vehicle)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.common.driver)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.operations.activityCenter.assignments.colFleetVerdict)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.operations.activityCenter.assignments.colAllocated)}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-[10px]">
                      {row.status_label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 capitalize text-muted-foreground">{row.mode}</td>
                  <td className="px-3 py-2.5 tabular-nums">{row.vehicle_id ?? '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums">{row.driver_id ?? '—'}</td>
                  {/* Fleet's verdict at allocation time, quoted. */}
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {row.fleet_verdict ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {row.allocated_at ? new Date(row.allocated_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.meta.total > 0 && (
        <Pagination
          meta={{
            page: data.meta.current_page,
            perPage: data.meta.per_page,
            total: data.meta.total,
            lastPage: data.meta.last_page,
          }}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function SessionsTab() {
  const { t } = useTranslation('logistics');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSessionHistory({ page });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-3">
      {isLoading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t($ => $.operations.activityCenter.sessions.empty)}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <th className="h-10 px-3 font-medium">{t($ => $.operations.activityCenter.sessions.colOperator)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.common.status)}</th>
                <th className="h-10 px-3 text-end font-medium">{t($ => $.common.assigned)}</th>
                <th className="h-10 px-3 text-end font-medium">{t($ => $.operations.activityCenter.sessions.colReleased)}</th>
                <th className="h-10 px-3 text-end font-medium">{t($ => $.operations.activityCenter.sessions.colConflicts)}</th>
                <th className="h-10 px-3 text-end font-medium">{t($ => $.operations.activityCenter.sessions.colDuration)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.operations.activityCenter.sessions.colStarted)}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5">{row.operator_name ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-[10px]">
                      {row.status_label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{row.assigned_count}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{row.released_count}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{row.conflict_count}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-muted-foreground">
                    {row.duration_minutes !== null
                      ? t($ => $.operations.activityCenter.sessions.minutesShort, {
                          minutes: row.duration_minutes,
                        })
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {row.started_at ? new Date(row.started_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.meta.total > 0 && (
        <Pagination
          meta={{
            page: data.meta.current_page,
            perPage: data.meta.per_page,
            total: data.meta.total,
            lastPage: data.meta.last_page,
          }}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function CapacityHistoryTab() {
  const { t } = useTranslation('logistics');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCapacityHistory({ page });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-3">
      {isLoading && !data ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t($ => $.operations.activityCenter.capacity.empty)}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <th className="h-10 px-3 font-medium">{t($ => $.operations.activityCenter.capacity.colPurpose)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.common.status)}</th>
                <th className="h-10 px-3 text-end font-medium">{t($ => $.operations.activityCenter.capacity.colOrders)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.common.reason)}</th>
                <th className="h-10 px-3 font-medium">{t($ => $.operations.activityCenter.capacity.colRequested)}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2.5">{row.purpose ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-[10px]">
                      {row.status_label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums">{row.requested_orders}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {/* Network's own words when it refused. */}
                    {row.failure_reason ?? row.release_reason ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {row.requested_at ? new Date(row.requested_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.meta.total > 0 && (
        <Pagination
          meta={{
            page: data.meta.current_page,
            perPage: data.meta.per_page,
            total: data.meta.total,
            lastPage: data.meta.last_page,
          }}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

/**
 * Activity Center.
 *
 * One merged feed and the history views, all read from the append-only records
 * the owning modules keep. Nothing here writes; the past is shown, never edited.
 */
export function ActivityCenterPage() {
  const { t } = useTranslation('logistics');

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[
          { label: t($ => $.operations.activityCenter.breadcrumbRoot) },
          { label: t($ => $.operations.activityCenter.breadcrumbSection) },
        ]}
        title={t($ => $.operations.activityCenter.title)}
        description={t($ => $.operations.activityCenter.description)}
        metrics={[]}
      />

      <WorkspacePage>
        <div className="px-4 pb-6 pt-2 sm:px-6">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList>
              <TabsTrigger value="timeline">{t($ => $.common.timeline)}</TabsTrigger>
              <TabsTrigger value="audit">{t($ => $.operations.activityCenter.tabs.audit)}</TabsTrigger>
              <TabsTrigger value="assignments">
                {t($ => $.operations.activityCenter.tabs.assignments)}
              </TabsTrigger>
              <TabsTrigger value="sessions">
                {t($ => $.operations.activityCenter.tabs.sessions)}
              </TabsTrigger>
              <TabsTrigger value="capacity">{t($ => $.common.capacity)}</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="pt-4">
              <TimelineTab />
            </TabsContent>
            <TabsContent value="audit" className="pt-4">
              <AuditTab />
            </TabsContent>
            <TabsContent value="assignments" className="pt-4">
              <AssignmentsTab />
            </TabsContent>
            <TabsContent value="sessions" className="pt-4">
              <SessionsTab />
            </TabsContent>
            <TabsContent value="capacity" className="pt-4">
              <CapacityHistoryTab />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspacePage>
    </>
  );
}
