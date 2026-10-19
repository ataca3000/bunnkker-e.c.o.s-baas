import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, Check, Repeat2 } from 'lucide-react';

import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { useToast } from '@/components/ds/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/features/authorization';

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
  useAcknowledgeException,
  useAlerts,
  useAlertSummary,
  useEscalateOverdueExceptions,
  useReconcileResolvedConflicts,
  useExceptions,
} from '../hooks/use-operations';
import type { ExceptionSeverity, ExceptionStatus, OperationalAlert } from '../types/operations';
import { ExceptionStatusBadge, SeverityIcon, SourceBadge } from '../components/operations-badges';
import { ExceptionDrawer } from '../components/exception-drawer';

const SEVERITY_FILTERS: Array<{ key: ExceptionSeverity | 'all'; labelKey: LogisticsLabel }> = [
  { key: 'all', labelKey: ($) => $.common.all },
  { key: 'critical', labelKey: ($) => $.common.critical },
  { key: 'warning', labelKey: ($) => $.operations.alertCenter.severity.warning },
  { key: 'info', labelKey: ($) => $.operations.alertCenter.severity.info },
];

/**
 * Live alerts, prioritised loudest-first by the server.
 *
 * An alert IS an exception a Phase 4 rule matched — there is no second engine
 * and no second table here. Acknowledging routes straight to the Phase 4
 * exception, and resolving it makes the alert disappear on its own.
 */
function LiveTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const [severity, setSeverity] = useState<ExceptionSeverity | 'all'>('all');
  const { data: alerts, isLoading } = useAlerts();
  const acknowledge = useAcknowledgeException();

  const rows = useMemo(() => {
    const all = alerts ?? [];
    return severity === 'all' ? all : all.filter((a) => a.severity === severity);
  }, [alerts, severity]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {SEVERITY_FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={severity === f.key ? 'secondary' : 'ghost'}
            className="h-8 text-xs"
            onClick={() => setSeverity(f.key)}
          >
            {t(f.labelKey)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center">
          <BellRing className="mx-auto mb-3 size-10 text-muted-foreground/20" />
          <p className="text-sm font-medium">{t($ => $.operations.alertCenter.empty.title)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t($ => $.operations.alertCenter.empty.hint)}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <ul className="divide-y">
            {rows.map((alert: OperationalAlert) => (
              <li key={alert.exception_id} className="flex items-start gap-2 p-3">
                <SeverityIcon severity={alert.severity} />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-start"
                  onClick={() => onOpen(alert.exception_id)}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{alert.title}</span>
                    <SourceBadge source={alert.source} label={alert.source} />
                    {alert.rule && (
                      <Badge variant="outline" className="text-[10px]">
                        {alert.rule}
                      </Badge>
                    )}
                    {alert.occurrence_count > 1 && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Repeat2 className="size-2.5" />
                        {alert.occurrence_count}×
                      </Badge>
                    )}
                    {alert.is_overdue && (
                      <Badge variant="destructive" className="text-[10px]">
                        {t($ => $.operations.alertCenter.overdue)}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t($ => $.operations.alertCenter.meta.open, { minutes: alert.age_minutes })}
                    {alert.unacknowledged_minutes !== null
                      ? t($ => $.operations.alertCenter.meta.unacknowledgedFor, {
                          minutes: alert.unacknowledged_minutes,
                        })
                      : t($ => $.operations.alertCenter.meta.acknowledged)}
                    {alert.escalation_level > 0
                      ? t($ => $.operations.alertCenter.meta.level, { level: alert.escalation_level })
                      : ''}
                  </p>
                </button>
                {alert.unacknowledged_minutes !== null && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 shrink-0 text-xs"
                    disabled={acknowledge.isPending}
                    onClick={() =>
                      acknowledge.mutate(alert.exception_id, {
                        onSuccess: () => toast({ title: t($ => $.operations.alertCenter.toast.acknowledged) }),
                        onError: () =>
                          toast({
                            title: t($ => $.operations.alertCenter.toast.acknowledgeFailed),
                            variant: 'destructive',
                          }),
                      })
                    }
                  >
                    <Check className="me-1 size-3.5" />
                    {t($ => $.operations.alertCenter.ack)}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const HISTORY_STATUSES: Array<{ key: ExceptionStatus; labelKey: LogisticsLabel }> = [
  { key: 'resolved', labelKey: ($) => $.operations.alertCenter.historyStatus.resolved },
  { key: 'auto_resolved', labelKey: ($) => $.operations.alertCenter.historyStatus.autoResolved },
  { key: 'suppressed', labelKey: ($) => $.operations.alertCenter.historyStatus.suppressed },
];

function HistoryTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTranslation('logistics');
  const [status, setStatus] = useState<ExceptionStatus>('resolved');
  const { data, isLoading } = useExceptions({ status });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {HISTORY_STATUSES.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant={status === s.key ? 'secondary' : 'ghost'}
            className="h-8 text-xs"
            onClick={() => setStatus(s.key)}
          >
            {t(s.labelKey)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t($ => $.operations.alertCenter.history.empty)}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <ul className="divide-y">
            {rows.map((exception) => (
              <li key={exception.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 p-3 text-start hover:bg-muted/40"
                  onClick={() => onOpen(exception.id)}
                >
                  <SeverityIcon severity={exception.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{exception.title}</span>
                      <SourceBadge source={exception.source} label={exception.source_label} />
                      <ExceptionStatusBadge status={exception.status} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {exception.resolution_reason ?? exception.resolution ?? '—'}
                      {exception.resolved_by_name ? ` · ${exception.resolved_by_name}` : ''}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Live Alert Center.
 *
 * Reuses the Phase 4 Exception Registry end to end — live alerts, ack, filter,
 * prioritisation and history are all views over ops_exceptions. No second alert
 * engine exists.
 */
/**
 * Exception maintenance.
 *
 * Two idempotent sweeps that the API exposes and nothing else surfaced: escalate
 * everything past its escalation deadline, and close conflict records whose
 * conflict is already resolved. Each reports a count, which is shown — a sweep
 * that silently did nothing is indistinguishable from one that failed.
 */
function MaintenancePanel() {
  const { t } = useTranslation('logistics');
  const { can } = usePermission();
  const escalate = useEscalateOverdueExceptions();
  const reconcile = useReconcileResolvedConflicts();

  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Two distinct permissions, deliberately so on the backend: escalating
  // commits somebody else's time, reconciling only closes stale records. Each
  // button is gated on its own, and the panel appears if either is granted.
  const canEscalate = can('operations.exception.escalate');
  const canReconcile = can('operations.exception.manage');

  if (!canEscalate && !canReconcile) return null;

  async function runEscalate() {
    setError(null);
    setResult(null);
    try {
      const count = await escalate.mutateAsync();
      setResult(t(($) => $.operations.alertCenter.maintenance.escalateOverdueDone, { count }));
    } catch {
      setError(t(($) => $.operations.alertCenter.maintenance.escalateFailed));
    }
  }

  async function runReconcile() {
    setError(null);
    setResult(null);
    try {
      const count = await reconcile.mutateAsync();
      setResult(t(($) => $.operations.alertCenter.maintenance.reconcileDone, { count }));
    } catch {
      setError(t(($) => $.operations.alertCenter.maintenance.reconcileFailed));
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium">
        {t(($) => $.operations.alertCenter.maintenance.title)}
      </h3>
      <p className="text-[11px] text-muted-foreground">
        {t(($) => $.operations.alertCenter.maintenance.note)}
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {result && <p className="text-xs text-muted-foreground">{result}</p>}

      <div className="flex flex-wrap gap-2">
        {canEscalate && (
        <Button
          size="sm"
          variant="secondary"
          disabled={escalate.isPending}
          onClick={() => void runEscalate()}
        >
          {t(($) => $.operations.alertCenter.maintenance.escalateOverdue)}
        </Button>
        )}
        {canReconcile && (
        <Button
          size="sm"
          variant="outline"
          disabled={reconcile.isPending}
          onClick={() => void runReconcile()}
        >
          {t(($) => $.operations.alertCenter.maintenance.reconcile)}
        </Button>
        )}
      </div>
    </div>
  );
}

export function AlertCenterPage() {
  const { t } = useTranslation('logistics');
  const { data: summary, refetch, isFetching } = useAlertSummary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const open = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  const metrics = [
    { id: 'total', icon: BellRing, label: t($ => $.operations.alertCenter.metrics.live), value: summary?.total ?? 0, isLoading: !summary },
    { id: 'critical', icon: BellRing, label: t($ => $.common.critical), value: summary?.critical ?? 0, isLoading: !summary, colorClass: 'text-destructive' },
    { id: 'unack', icon: BellRing, label: t($ => $.operations.alertCenter.metrics.unacknowledged), value: summary?.unacknowledged ?? 0, isLoading: !summary, colorClass: 'text-amber-600' },
    { id: 'overdue', icon: BellRing, label: t($ => $.operations.alertCenter.overdue), value: summary?.overdue ?? 0, isLoading: !summary, colorClass: 'text-destructive' },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[
          { label: t($ => $.operations.alertCenter.breadcrumbRoot) },
          { label: t($ => $.operations.alertCenter.breadcrumbSection) },
        ]}
        title={t($ => $.operations.alertCenter.title)}
        description={t($ => $.operations.alertCenter.description)}
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar onRefresh={() => refetch()} isFetching={isFetching} />
          </div>
        }
      >
        <div className="flex flex-col gap-4 px-4 pb-6 sm:px-6">
          <MaintenancePanel />

          <Tabs defaultValue="live" className="w-full">
            <TabsList>
              <TabsTrigger value="live">
                {t($ => $.operations.alertCenter.tabs.live)}
                {summary && summary.total > 0 ? ` (${summary.total})` : ''}
              </TabsTrigger>
              <TabsTrigger value="history">{t($ => $.common.history)}</TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="pt-4">
              <LiveTab onOpen={open} />
            </TabsContent>
            <TabsContent value="history" className="pt-4">
              <HistoryTab onOpen={open} />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspacePage>

      <ExceptionDrawer exceptionId={selectedId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
