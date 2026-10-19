import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange, CheckCircle2, FileWarning, Gauge } from 'lucide-react';

import { UniversalDataGrid, type DataGridColumnDef } from '@/components/data-grid';
import { useToast } from '@/components/ds/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ecos-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { WorkspacePage } from '@/components/page';
import { WorkspaceHeader, type WorkspaceMetric } from '@/components/workspace';
import { usePermission } from '@/features/authorization';
import { useFormatter } from '@/hooks/use-formatter';

import { Field, NoAccess, Panel, Stat } from '../components/finance-panels';
import { useAccounts } from '../hooks/use-finance-gl';
import {
  useCloseClosingRun,
  useCloseYear,
  useClosingWorkspace,
  useClosureHistory,
  useCreateFiscalYear,
  useFinalizeYearEnd,
  useFiscalYears,
  usePeriodClose,
  usePeriodTransition,
  useReopenPeriod,
  useStartClosingRun,
  useValidateClosingRun,
  useYearEnd,
} from '../hooks/use-finance-control';
import type { ClosingRun, FiscalPeriod, FiscalYear, PeriodStatus } from '../types/finance-control';
import { backendMessage } from '../utils/backend-message';

/**
 * EPIC-FINANCE-UI-001 · Phase 7 — Fiscal Calendar, Period Closing & Year-End.
 *
 * The fiscal period status is the single most consequential flag in the ledger:
 * only an `open` period accepts postings, and `locked` is permanent. This
 * workspace exposes those transitions with the backend's own guard rails
 * intact — it offers no transition the API would reject, and every refusal is
 * shown in the backend's words rather than restated as a house message.
 *
 * The close-readiness score, the checklist verdicts and the closing progress
 * are all server-computed. Nothing here re-derives them.
 *
 * No backend changes. IAM-gated per route permission; EN/AR; responsive.
 */
export function FiscalClosingPage() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();

  const years = useFiscalYears();

  const canView = can('finance.gl.view');
  const canClose = can('finance.closing.manage') || can('finance.period.close');
  const canYearEnd = can('finance.yearend.manage');

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const workspace = useClosingWorkspace(
    can('finance.closing.workspace.view') ? selectedPeriodId : null,
  );

  const openPeriods = useMemo(
    () =>
      (years.data ?? []).reduce(
        (total, year) => total + year.periods.filter((p) => p.status === 'open').length,
        0,
      ),
    [years.data],
  );

  const metrics = useMemo<WorkspaceMetric[]>(
    () => [
      {
        id: 'years',
        icon: CalendarRange,
        label: t(($) => $.fiscal.kpi.years),
        value: years.data?.length ?? 0,
        isLoading: years.isLoading,
      },
      {
        id: 'open-periods',
        icon: CheckCircle2,
        label: t(($) => $.fiscal.kpi.openPeriods),
        value: openPeriods,
        isLoading: years.isLoading,
      },
      {
        id: 'pending-journals',
        icon: FileWarning,
        label: t(($) => $.fiscal.kpi.pendingJournals),
        value: workspace.data?.pending_journals ?? '—',
        isLoading: workspace.isLoading,
      },
      {
        id: 'readiness',
        icon: Gauge,
        label: t(($) => $.fiscal.kpi.readiness),
        value: workspace.data === undefined ? '—' : `${workspace.data.close_readiness_score}`,
        isLoading: workspace.isLoading,
      },
    ],
    [years.data, years.isLoading, openPeriods, workspace.data, workspace.isLoading, t],
  );

  const header = (
    <WorkspaceHeader
      breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.fiscal.title) }]}
      title={t(($) => $.fiscal.title)}
      description={t(($) => $.fiscal.subtitle)}
      metrics={canView ? metrics : undefined}
    />
  );

  if (!canView) {
    return (
      <>
        {header}
        <WorkspacePage>
          <NoAccess />
        </WorkspacePage>
      </>
    );
  }

  return (
    <>
      {header}
      <WorkspacePage>
        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">{t(($) => $.fiscal.tab.calendar)}</TabsTrigger>
            {canClose && (
              <TabsTrigger value="closing">{t(($) => $.fiscal.tab.closing)}</TabsTrigger>
            )}
            {canYearEnd && (
              <TabsTrigger value="year-end">{t(($) => $.fiscal.tab.yearEnd)}</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <CalendarTab
              years={years.data ?? []}
              isLoading={years.isLoading}
              isError={years.isError}
              selectedPeriodId={selectedPeriodId}
              onSelectPeriod={setSelectedPeriodId}
            />
          </TabsContent>

          {canClose && (
            <TabsContent value="closing" className="mt-4">
              <ClosingTab
                years={years.data ?? []}
                selectedPeriodId={selectedPeriodId}
                onSelectPeriod={setSelectedPeriodId}
              />
            </TabsContent>
          )}

          {canYearEnd && (
            <TabsContent value="year-end" className="mt-4">
              <YearEndTab years={years.data ?? []} />
            </TabsContent>
          )}
        </Tabs>
      </WorkspacePage>
    </>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────

function PeriodStatusLabel({ status }: { status: PeriodStatus }) {
  const { t } = useTranslation('finance');
  const label = t(($) => $.fiscal.periodStatus[status]);
  const tone =
    status === 'open'
      ? 'text-emerald-600'
      : status === 'locked'
        ? 'text-red-600'
        : status === 'closed'
          ? 'text-amber-600'
          : 'text-muted-foreground';

  return <span className={`text-xs font-medium ${tone}`}>{label}</span>;
}

function CalendarTab({
  years,
  isLoading,
  isError,
  selectedPeriodId,
  onSelectPeriod,
}: {
  years: FiscalYear[];
  isLoading: boolean;
  isError: boolean;
  selectedPeriodId: string | null;
  onSelectPeriod: (id: string) => void;
}) {
  const { can } = usePermission();
  const [yearId, setYearId] = useState<string | null>(null);

  const activeYear = years.find((y) => y.id === yearId) ?? years[0];

  return (
    <div className="space-y-4">
      <YearGrid years={years} isLoading={isLoading} isError={isError} onSelect={setYearId} />

      {can('finance.period.manage') && <CreateYearPanel />}

      {/* The grid above already states "no fiscal years" in its own empty
          state; a second copy here said the same thing twice on a fresh
          tenant. The period grid simply does not render until a year exists. */}
      {activeYear && (
        <PeriodGrid
          year={activeYear}
          selectedPeriodId={selectedPeriodId}
          onSelectPeriod={onSelectPeriod}
        />
      )}
    </div>
  );
}

function YearGrid({
  years,
  isLoading,
  isError,
  onSelect,
}: {
  years: FiscalYear[];
  isLoading: boolean;
  isError: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();

  const columns = useMemo<DataGridColumnDef<FiscalYear>[]>(
    () => [
      {
        key: 'name',
        label: t(($) => $.fiscal.year.name),
        pin: 'left',
        cell: (y) => <span className="font-medium">{y.name}</span>,
      },
      { key: 'status', label: t(($) => $.fiscal.year.status), cell: (y) => y.status },
      {
        key: 'start_date',
        label: t(($) => $.fiscal.year.start),
        cell: (y) => (y.start_date ? fmt.date(y.start_date) : '—'),
      },
      {
        key: 'end_date',
        label: t(($) => $.fiscal.year.end),
        cell: (y) => (y.end_date ? fmt.date(y.end_date) : '—'),
      },
      {
        key: 'periods',
        label: t(($) => $.fiscal.year.periods),
        align: 'end',
        cell: (y) => <span className="tabular-nums">{y.periods.length}</span>,
      },
    ],
    [t, fmt],
  );

  return (
    <UniversalDataGrid
      data={years}
      columns={columns}
      rowId={(y) => y.id}
      loading={isLoading}
      error={isError}
      onRowClick={(y) => onSelect(y.id)}
      emptyState={
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t(($) => $.fiscal.year.empty)}
        </p>
      }
    />
  );
}

function CreateYearPanel() {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const create = useCreateFiscalYear();

  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [periodCount, setPeriodCount] = useState('12');

  const ready = name.trim() !== '' && start !== '' && end !== '' && end > start;

  return (
    <Panel title={t(($) => $.fiscal.year.newTitle)} hint={t(($) => $.fiscal.year.newDescription)}>
      <div className="grid gap-3 md:grid-cols-4">
        <Field id="year-name" label={t(($) => $.fiscal.year.nameLabel)}>
          <Input id="year-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="year-start" label={t(($) => $.fiscal.year.start)}>
          <Input
            id="year-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field id="year-end" label={t(($) => $.fiscal.year.end)}>
          <Input id="year-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field id="year-periods" label={t(($) => $.fiscal.year.periodCount)}>
          <Input
            id="year-periods"
            type="number"
            min={1}
            max={13}
            value={periodCount}
            onChange={(e) => setPeriodCount(e.target.value)}
          />
        </Field>
      </div>

      {start !== '' && end !== '' && end <= start && (
        <p className="text-xs text-destructive">{t(($) => $.fiscal.year.endAfterStart)}</p>
      )}

      <Button
        size="sm"
        className="self-start"
        disabled={!ready || create.isPending}
        onClick={async () => {
          try {
            await create.mutateAsync({
              name: name.trim(),
              start_date: start,
              end_date: end,
              period_count: periodCount === '' ? undefined : Number(periodCount),
            });
            toast({ title: t(($) => $.fiscal.toast.yearCreated) });
            setName('');
            setStart('');
            setEnd('');
          } catch (error) {
            toast({
              title: t(($) => $.fiscal.year.createFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {create.isPending ? t(($) => $.treasury.common.saving) : t(($) => $.fiscal.year.create)}
      </Button>
    </Panel>
  );
}

function PeriodGrid({
  year,
  selectedPeriodId,
  onSelectPeriod,
}: {
  year: FiscalYear;
  selectedPeriodId: string | null;
  onSelectPeriod: (id: string) => void;
}) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();
  const { toast } = useToast();
  const transition = usePeriodTransition();

  const canManage = can('finance.period.manage');

  const run = async (periodId: string, action: 'open' | 'close' | 'lock', failureTitle: string) => {
    try {
      await transition.mutateAsync({ periodId, action });
      toast({ title: t(($) => $.fiscal.toast.periodUpdated) });
    } catch (error) {
      toast({ title: failureTitle, description: backendMessage(error), variant: 'destructive' });
    }
  };

  // Not memoised: the action cells close over `run`, which closes over the
  // mutation. Memoising would need `run` in the deps and re-create the array on
  // every mutation state change anyway — for at most 13 rows that is noise.
  const columns: DataGridColumnDef<FiscalPeriod>[] = [
    {
      key: 'period_number',
      label: t(($) => $.fiscal.period.number),
      pin: 'left',
      align: 'end',
      cell: (p) => <span className="tabular-nums">{p.period_number}</span>,
    },
    {
      key: 'name',
      label: t(($) => $.fiscal.period.name),
      cell: (p) => <span className="font-medium">{p.name}</span>,
    },
    {
      key: 'status',
      label: t(($) => $.fiscal.period.status),
      cell: (p) => <PeriodStatusLabel status={p.status} />,
    },
    {
      key: 'start_date',
      label: t(($) => $.fiscal.period.start),
      cell: (p) => (p.start_date ? fmt.date(p.start_date) : '—'),
    },
    {
      key: 'end_date',
      label: t(($) => $.fiscal.period.end),
      cell: (p) => (p.end_date ? fmt.date(p.end_date) : '—'),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: t(($) => $.fiscal.period.actions),
            cell: (p: FiscalPeriod) => (
              <div className="flex flex-wrap gap-1">
                {/* Only transitions the backend's state machine allows are offered. */}
                {(p.status === 'future' || p.status === 'closed') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={transition.isPending}
                    onClick={() =>
                      run(
                        p.id,
                        'open',
                        t(($) => $.fiscal.period.openFailed),
                      )
                    }
                  >
                    {t(($) => $.fiscal.period.open)}
                  </Button>
                )}
                {p.status === 'open' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={transition.isPending}
                    onClick={() =>
                      run(
                        p.id,
                        'close',
                        t(($) => $.fiscal.period.closeFailed),
                      )
                    }
                  >
                    {t(($) => $.fiscal.period.close)}
                  </Button>
                )}
                {p.status === 'closed' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    disabled={transition.isPending}
                    onClick={() =>
                      run(
                        p.id,
                        'lock',
                        t(($) => $.fiscal.period.lockFailed),
                      )
                    }
                  >
                    {t(($) => $.fiscal.period.lock)}
                  </Button>
                )}
              </div>
            ),
          } satisfies DataGridColumnDef<FiscalPeriod>,
        ]
      : []),
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">
        {t(($) => $.fiscal.period.title, { year: year.name })}
      </h3>
      <p className="text-xs text-muted-foreground">{t(($) => $.fiscal.period.selectHint)}</p>

      <UniversalDataGrid
        data={year.periods}
        columns={columns}
        rowId={(p) => p.id}
        onRowClick={(p) => onSelectPeriod(p.id)}
        emptyState={
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t(($) => $.fiscal.period.empty)}
          </p>
        }
      />

      {selectedPeriodId !== null && (
        <p className="text-xs text-muted-foreground">
          {t(($) => $.fiscal.period.selected, {
            name: year.periods.find((p) => p.id === selectedPeriodId)?.name ?? selectedPeriodId,
          })}
        </p>
      )}
    </div>
  );
}

// ── Closing ──────────────────────────────────────────────────────────────────

function PeriodPicker({
  years,
  value,
  onChange,
}: {
  years: FiscalYear[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation('finance');

  return (
    <Field id="closing-period" label={t(($) => $.fiscal.period.name)}>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger id="closing-period" className="h-9 text-sm">
          <SelectValue placeholder={t(($) => $.fiscal.period.selectHint)} />
        </SelectTrigger>
        <SelectContent>
          {years.flatMap((year) =>
            year.periods.map((period) => (
              <SelectItem key={period.id} value={period.id}>
                {year.name} · {period.name}
              </SelectItem>
            )),
          )}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ClosingTab({
  years,
  selectedPeriodId,
  onSelectPeriod,
}: {
  years: FiscalYear[];
  selectedPeriodId: string | null;
  onSelectPeriod: (id: string) => void;
}) {
  const { t } = useTranslation('finance');
  const { can } = usePermission();

  return (
    <div className="space-y-4">
      <Panel
        title={t(($) => $.fiscal.closing.selectTitle)}
        hint={t(($) => $.fiscal.closing.selectDescription)}
      >
        <PeriodPicker years={years} value={selectedPeriodId} onChange={onSelectPeriod} />
      </Panel>

      {selectedPeriodId !== null && (
        <>
          {can('finance.closing.workspace.view') && (
            <ClosingWorkspacePanel periodId={selectedPeriodId} />
          )}
          {can('finance.closing.manage') && <ClosingRunPanel periodId={selectedPeriodId} />}
          {can('finance.period.close') && <PeriodClosePanel periodId={selectedPeriodId} />}
          {can('finance.period.close') && <ClosureHistoryPanel periodId={selectedPeriodId} />}
        </>
      )}
    </div>
  );
}

function ClosingWorkspacePanel({ periodId }: { periodId: string }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const workspace = useClosingWorkspace(periodId);
  const data = workspace.data;

  if (workspace.isLoading) {
    return <p className="text-sm text-muted-foreground">{t(($) => $.loading)}</p>;
  }
  if (workspace.isError || !data) {
    return <p className="text-sm text-destructive">{t(($) => $.error)}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={t(($) => $.fiscal.closing.readiness)}
          value={`${data.close_readiness_score}`}
          tone={data.close_readiness_score < 100 ? 'warn' : 'default'}
        />
        <Stat
          label={t(($) => $.fiscal.closing.progress)}
          value={`${data.closing_progress.passed}/${data.closing_progress.total} · ${data.closing_progress.pct}%`}
        />
        <Stat
          label={t(($) => $.fiscal.closing.pendingJournals)}
          value={data.pending_journals}
          tone={data.pending_journals > 0 ? 'warn' : 'default'}
        />
        <Stat
          label={t(($) => $.fiscal.closing.criticalExceptions)}
          value={`${data.control_exceptions.critical}/${data.control_exceptions.open_total}`}
          tone={data.control_exceptions.critical > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label={t(($) => $.fiscal.closing.openVatPeriods)}
          value={data.vat_status.open_periods}
          tone={data.vat_status.open_periods > 0 ? 'warn' : 'default'}
        />
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t(($) => $.fiscal.closing.reconciliation)}
          </p>
          <div className="mt-1 flex flex-col gap-0.5 text-sm">
            {Object.entries(data.reconciliation_status).map(([subledger, status]) => (
              <span key={subledger}>
                <span className="text-muted-foreground">{subledger}: </span>
                {status.reconciled === null
                  ? (status.note ?? t(($) => $.treasury.common.none))
                  : status.reconciled
                    ? t(($) => $.fiscal.closing.reconciled)
                    : `${t(($) => $.fiscal.closing.unreconciled)} · ${fmt.money(status.difference ?? 0)}`}
              </span>
            ))}
          </div>
        </div>
      </div>

      {data.open_tasks.length > 0 && (
        <Panel
          title={t(($) => $.fiscal.closing.openTasks)}
          hint={t(($) => $.fiscal.closing.openTasksHint)}
        >
          <ul className="flex flex-col gap-1.5 text-sm">
            {data.open_tasks.map((task) => (
              <li key={task.key} className="flex flex-col">
                <span className="font-medium">{task.label}</span>
                {task.detail && (
                  <span className="text-xs text-muted-foreground">{task.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function ClosingRunPanel({ periodId }: { periodId: string }) {
  const { t } = useTranslation('finance');
  const { can } = usePermission();
  const { toast } = useToast();

  const start = useStartClosingRun();
  const validate = useValidateClosingRun();
  const closeRun = useCloseClosingRun();

  const [run, setRun] = useState<ClosingRun | null>(null);
  const [reason, setReason] = useState('');

  /** Takes the in-flight call, not a thunk, so the three run actions share one
   *  success/refusal path without each restating it. */
  const act = async (pending: Promise<ClosingRun>, successTitle: string, failureTitle: string) => {
    try {
      setRun(await pending);
      toast({ title: successTitle });
    } catch (error) {
      toast({ title: failureTitle, description: backendMessage(error), variant: 'destructive' });
    }
  };

  return (
    <Panel
      title={t(($) => $.fiscal.closing.runTitle)}
      hint={t(($) => $.fiscal.closing.runDescription)}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={start.isPending}
          onClick={() =>
            act(
              start.mutateAsync(periodId),
              t(($) => $.fiscal.toast.runStarted),
              t(($) => $.fiscal.closing.startFailed),
            )
          }
        >
          {t(($) => $.fiscal.closing.start)}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={run === null || validate.isPending}
          onClick={() =>
            run &&
            act(
              validate.mutateAsync(run.id),
              t(($) => $.fiscal.toast.runValidated),
              t(($) => $.fiscal.closing.validateFailed),
            )
          }
        >
          {t(($) => $.fiscal.closing.validate)}
        </Button>
      </div>

      {run && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t(($) => $.fiscal.closing.runStatus)} value={run.status} />
            <Stat
              label={t(($) => $.fiscal.closing.readiness)}
              value={run.readiness_score ?? '—'}
              tone={run.readiness_score !== null && run.readiness_score < 100 ? 'warn' : 'default'}
            />
            <Stat label={t(($) => $.fiscal.closing.runId)} value={run.id} />
          </div>

          {run.items && run.items.length > 0 && <ChecklistTable items={run.items} />}

          {can('finance.closing.approve') && (
            <div className="flex flex-col gap-2 border-t pt-3">
              <Field id="close-reason" label={t(($) => $.fiscal.closing.reason)}>
                <Textarea
                  id="close-reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                {t(($) => $.fiscal.closing.makerChecker)}
              </p>
              <Button
                size="sm"
                className="self-start"
                disabled={closeRun.isPending}
                onClick={() =>
                  act(
                    closeRun.mutateAsync({
                      runId: run.id,
                      reason: reason.trim() === '' ? undefined : reason.trim(),
                    }),
                    t(($) => $.fiscal.toast.runClosed),
                    t(($) => $.fiscal.closing.closeFailed),
                  )
                }
              >
                {t(($) => $.fiscal.closing.closeRun)}
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function ChecklistTable({ items }: { items: NonNullable<ClosingRun['items']> }) {
  const { t } = useTranslation('finance');

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="p-2 text-start font-medium">{t(($) => $.fiscal.closing.check)}</th>
            <th className="p-2 text-start font-medium">{t(($) => $.fiscal.closing.category)}</th>
            <th className="p-2 text-start font-medium">{t(($) => $.fiscal.closing.checkStatus)}</th>
            <th className="p-2 text-start font-medium">{t(($) => $.fiscal.closing.blocking)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.key}>
              <td className="p-2">
                <span className="font-medium">{item.label}</span>
                {item.detail && (
                  <span className="block text-xs text-muted-foreground">{item.detail}</span>
                )}
              </td>
              <td className="p-2 text-muted-foreground">
                {item.category ?? t(($) => $.treasury.common.none)}
              </td>
              <td className="p-2">
                <span
                  className={
                    item.status === 'passed'
                      ? 'text-emerald-600'
                      : item.status === 'failed'
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                  }
                >
                  {item.status}
                </span>
              </td>
              <td className="p-2 text-muted-foreground">
                {item.is_blocking
                  ? t(($) => $.fiscal.closing.blockingYes)
                  : t(($) => $.fiscal.closing.blockingNo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodClosePanel({ periodId }: { periodId: string }) {
  const { t } = useTranslation('finance');
  const { can } = usePermission();
  const { toast } = useToast();

  const close = usePeriodClose();
  const reopen = useReopenPeriod();

  const [reason, setReason] = useState('');

  const closeWith = async (hard: boolean) => {
    try {
      await close.mutateAsync({
        periodId,
        hard,
        reason: reason.trim() === '' ? undefined : reason.trim(),
      });
      toast({ title: t(($) => $.fiscal.toast.periodUpdated) });
      setReason('');
    } catch (error) {
      toast({
        title: hard
          ? t(($) => $.fiscal.closing.hardCloseFailed)
          : t(($) => $.fiscal.closing.softCloseFailed),
        description: backendMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <Panel
      title={t(($) => $.fiscal.closing.periodCloseTitle)}
      hint={t(($) => $.fiscal.closing.periodCloseDescription)}
    >
      <Field id="period-close-reason" label={t(($) => $.fiscal.closing.reason)}>
        <Textarea
          id="period-close-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={close.isPending}
          onClick={() => closeWith(false)}
        >
          {t(($) => $.fiscal.closing.softClose)}
        </Button>
        <Button size="sm" disabled={close.isPending} onClick={() => closeWith(true)}>
          {t(($) => $.fiscal.closing.hardClose)}
        </Button>

        {can('finance.period.reopen') && (
          <Button
            size="sm"
            variant="ghost"
            className="text-amber-600"
            /* The API requires a reason on reopen: it is an audited exception. */
            disabled={reason.trim() === '' || reopen.isPending}
            onClick={async () => {
              try {
                await reopen.mutateAsync({ periodId, reason: reason.trim() });
                toast({ title: t(($) => $.fiscal.toast.periodReopened) });
                setReason('');
              } catch (error) {
                toast({
                  title: t(($) => $.fiscal.closing.reopenFailed),
                  description: backendMessage(error),
                  variant: 'destructive',
                });
              }
            }}
          >
            {t(($) => $.fiscal.closing.reopen)}
          </Button>
        )}
      </div>

      {can('finance.period.reopen') && reason.trim() === '' && (
        <p className="text-xs text-muted-foreground">
          {t(($) => $.fiscal.closing.reopenRequiresReason)}
        </p>
      )}
    </Panel>
  );
}

function ClosureHistoryPanel({ periodId }: { periodId: string }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const history = useClosureHistory(periodId);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t(($) => $.fiscal.closing.history)}
      </h3>

      {history.isLoading ? (
        <p className="text-sm text-muted-foreground">{t(($) => $.loading)}</p>
      ) : (history.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">{t(($) => $.fiscal.closing.noHistory)}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-start font-medium">{t(($) => $.fiscal.closing.when)}</th>
                <th className="p-2 text-start font-medium">{t(($) => $.fiscal.closing.action)}</th>
                <th className="p-2 text-start font-medium">
                  {t(($) => $.fiscal.closing.transition)}
                </th>
                <th className="p-2 text-start font-medium">{t(($) => $.fiscal.closing.reason)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(history.data ?? []).map((entry, index) => (
                <tr key={`${entry.at ?? ''}-${index}`}>
                  <td className="whitespace-nowrap p-2">
                    {entry.at ? fmt.dateTime(entry.at) : t(($) => $.treasury.common.none)}
                  </td>
                  <td className="p-2">
                    {entry.action}
                    {entry.close_type ? ` · ${entry.close_type}` : ''}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {entry.from} → {entry.to}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {entry.reason ?? t(($) => $.treasury.common.none)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Year-end ─────────────────────────────────────────────────────────────────

function YearEndTab({ years }: { years: FiscalYear[] }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();
  const { toast } = useToast();

  const accounts = useAccounts({ postable_only: true });
  const [yearId, setYearId] = useState<string | null>(null);
  const [retainedAccount, setRetainedAccount] = useState('');
  const [nextYearId, setNextYearId] = useState('');

  const yearEnd = useYearEnd(yearId);
  const closeYear = useCloseYear();
  const finalize = useFinalizeYearEnd();

  const closing = yearEnd.data ?? null;

  return (
    <div className="space-y-4">
      <Panel title={t(($) => $.fiscal.yearEnd.title)} hint={t(($) => $.fiscal.yearEnd.description)}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field id="ye-year" label={t(($) => $.fiscal.year.name)}>
            <Select value={yearId ?? ''} onValueChange={setYearId}>
              <SelectTrigger id="ye-year" className="h-9 text-sm">
                <SelectValue placeholder={t(($) => $.fiscal.yearEnd.selectYear)} />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="ye-retained" label={t(($) => $.fiscal.yearEnd.retainedEarnings)}>
            <Select value={retainedAccount} onValueChange={setRetainedAccount}>
              <SelectTrigger id="ye-retained" className="h-9 text-sm">
                <SelectValue placeholder={t(($) => $.fiscal.yearEnd.selectAccount)} />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="ye-next" label={t(($) => $.fiscal.yearEnd.nextYear)}>
            <Select value={nextYearId} onValueChange={setNextYearId}>
              <SelectTrigger id="ye-next" className="h-9 text-sm">
                <SelectValue placeholder={t(($) => $.fiscal.yearEnd.nextYearOptional)} />
              </SelectTrigger>
              <SelectContent>
                {years
                  .filter((year) => year.id !== yearId)
                  .map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Button
          size="sm"
          className="self-start"
          disabled={yearId === null || retainedAccount === '' || closeYear.isPending}
          onClick={async () => {
            if (yearId === null) return;
            try {
              await closeYear.mutateAsync({
                yearId,
                payload: {
                  retained_earnings_account_id: retainedAccount,
                  next_fiscal_year_id: nextYearId === '' ? null : nextYearId,
                },
              });
              toast({ title: t(($) => $.fiscal.toast.yearClosed) });
            } catch (error) {
              toast({
                title: t(($) => $.fiscal.yearEnd.closeFailed),
                description: backendMessage(error),
                variant: 'destructive',
              });
            }
          }}
        >
          {t(($) => $.fiscal.yearEnd.close)}
        </Button>
      </Panel>

      {yearId !== null && yearEnd.isLoading && (
        <p className="text-sm text-muted-foreground">{t(($) => $.loading)}</p>
      )}

      {yearId !== null && !yearEnd.isLoading && closing === null && (
        <p className="text-sm text-muted-foreground">{t(($) => $.fiscal.yearEnd.neverClosed)}</p>
      )}

      {closing && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label={t(($) => $.fiscal.yearEnd.status)} value={closing.status} />
            <Stat
              label={t(($) => $.fiscal.yearEnd.netIncome)}
              value={fmt.money(closing.net_income)}
            />
            <Stat label={t(($) => $.fiscal.yearEnd.runCount)} value={closing.run_count} />
            <Stat
              label={t(($) => $.fiscal.yearEnd.finalized)}
              value={
                closing.finalized_at
                  ? fmt.dateTime(closing.finalized_at)
                  : t(($) => $.fiscal.yearEnd.notFinalized)
              }
            />
          </div>

          {can('finance.yearend.finalize') && closing.finalized_at === null && (
            <Panel
              title={t(($) => $.fiscal.yearEnd.finalizeTitle)}
              hint={t(($) => $.fiscal.yearEnd.finalizeDescription)}
            >
              <Button
                size="sm"
                className="self-start"
                disabled={finalize.isPending}
                onClick={async () => {
                  try {
                    await finalize.mutateAsync(closing.id);
                    toast({ title: t(($) => $.fiscal.toast.yearFinalized) });
                  } catch (error) {
                    toast({
                      title: t(($) => $.fiscal.yearEnd.finalizeFailed),
                      description: backendMessage(error),
                      variant: 'destructive',
                    });
                  }
                }}
              >
                {t(($) => $.fiscal.yearEnd.finalize)}
              </Button>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

export default FiscalClosingPage;
