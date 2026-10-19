import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, PiggyBank, TrendingUp, Wallet } from 'lucide-react';

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
import { WorkspacePage } from '@/components/page';
import { WorkspaceHeader, type WorkspaceMetric } from '@/components/workspace';
import { usePermission } from '@/features/authorization';
import { useFormatter } from '@/hooks/use-formatter';

import { Field, NoAccess, Panel, Stat } from '../components/finance-panels';
import { useAccounts } from '../hooks/use-finance-gl';
import {
  useAddBudgetLine,
  useApproveBudget,
  useBudgetAlerts,
  useBudgetAvailability,
  useBudgetVsActual,
  useBudgets,
  useCommitBudget,
  useCreateBudget,
  useCreateControlRule,
  useEvaluateSpend,
  useFiscalYears,
  useNewBudgetVersion,
  useReleaseCommitment,
} from '../hooks/use-finance-control';
import {
  BUDGET_DIMENSIONS,
  type Budget,
  type BudgetContext,
  type BudgetDimension,
  type BudgetVsActualLine,
} from '../types/finance-control';
import { backendMessage } from '../utils/backend-message';

/**
 * EPIC-FINANCE-UI-001 · Phase 7 — Budgets & Budget Control.
 *
 * Budgets never touch the ledger: they are authored here, and the control
 * engine reads actuals from posted journals to answer one question — how much
 * of this budget line is still available. Every figure on this page (budget,
 * actual, committed, available, consumption %, the ok/warn/over verdict and the
 * warn/block thresholds) is computed by that engine. None of it is re-derived
 * in the browser, because a second consumption figure would disagree with the
 * one the engine uses to block a spend.
 *
 * No backend changes. IAM-gated per route permission; EN/AR; responsive.
 */
export function BudgetsPage() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();

  const budgets = useBudgets();
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const vsActual = useBudgetVsActual(selectedBudgetId);

  const canView = can('finance.budget.view');

  const metrics = useMemo<WorkspaceMetric[]>(() => {
    const totals = vsActual.data?.totals;
    return [
      {
        id: 'budgets',
        icon: PiggyBank,
        label: t(($) => $.budget.kpi.budgets),
        value: budgets.data?.length ?? 0,
        isLoading: budgets.isLoading,
      },
      {
        id: 'approved',
        icon: Wallet,
        label: t(($) => $.budget.kpi.approved),
        value: budgets.data?.filter((b) => b.status === 'approved').length ?? 0,
        isLoading: budgets.isLoading,
      },
      {
        id: 'available',
        icon: TrendingUp,
        label: t(($) => $.budget.kpi.available),
        value: totals ? totals.available : '—',
        isLoading: vsActual.isLoading,
      },
      {
        id: 'consumption',
        icon: AlertTriangle,
        label: t(($) => $.budget.kpi.consumption),
        value: totals ? `${totals.consumption_pct}%` : '—',
        isLoading: vsActual.isLoading,
        colorClass: totals && totals.consumption_pct >= 100 ? 'text-red-600' : undefined,
      },
    ];
  }, [budgets.data, budgets.isLoading, vsActual.data, vsActual.isLoading, t]);

  const header = (
    <WorkspaceHeader
      breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.budget.title) }]}
      title={t(($) => $.budget.title)}
      description={t(($) => $.budget.subtitle)}
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
        <Tabs defaultValue="budgets">
          <TabsList>
            <TabsTrigger value="budgets">{t(($) => $.budget.tab.budgets)}</TabsTrigger>
            <TabsTrigger value="control">{t(($) => $.budget.tab.control)}</TabsTrigger>
          </TabsList>

          <TabsContent value="budgets" className="mt-4">
            <BudgetsTab selectedBudgetId={selectedBudgetId} onSelectBudget={setSelectedBudgetId} />
          </TabsContent>

          <TabsContent value="control" className="mt-4">
            <ControlTab />
          </TabsContent>
        </Tabs>
      </WorkspacePage>
    </>
  );
}

// ── Budgets ──────────────────────────────────────────────────────────────────

function BudgetsTab({
  selectedBudgetId,
  onSelectBudget,
}: {
  selectedBudgetId: string | null;
  onSelectBudget: (id: string) => void;
}) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();
  const { toast } = useToast();

  const budgets = useBudgets();
  const approve = useApproveBudget();

  const columns = useMemo<DataGridColumnDef<Budget>[]>(
    () => [
      {
        key: 'name',
        label: t(($) => $.budget.name),
        pin: 'left',
        cell: (b) => <span className="font-medium">{b.name}</span>,
      },
      { key: 'version', label: t(($) => $.budget.version), cell: (b) => b.version },
      { key: 'scenario', label: t(($) => $.budget.scenario), cell: (b) => b.scenario },
      { key: 'status', label: t(($) => $.budget.status), cell: (b) => b.status },
      { key: 'currency', label: t(($) => $.budget.currency), cell: (b) => b.currency },
      {
        key: 'total',
        label: t(($) => $.budget.total),
        align: 'end',
        cell: (b) => <span className="tabular-nums">{fmt.money(b.total, b.currency)}</span>,
      },
      {
        key: 'approved_at',
        label: t(($) => $.budget.approvedAt),
        cell: (b) => (b.approved_at ? fmt.dateTime(b.approved_at) : '—'),
      },
    ],
    [t, fmt],
  );

  return (
    <div className="space-y-4">
      <UniversalDataGrid
        data={budgets.data ?? []}
        columns={columns}
        rowId={(b) => b.id}
        loading={budgets.isLoading}
        error={budgets.isError}
        onRowClick={(b) => onSelectBudget(b.id)}
        emptyState={
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t(($) => $.budget.empty)}
          </p>
        }
      />

      {can('finance.budget.manage') && <CreateBudgetPanel />}

      {selectedBudgetId !== null && (
        <>
          {can('finance.budget.manage') && <AddLinePanel budgetId={selectedBudgetId} />}
          {can('finance.budget.manage') && <NewVersionPanel budgetId={selectedBudgetId} />}

          {can('finance.budget.approve') && (
            <Panel
              title={t(($) => $.budget.approveTitle)}
              hint={t(($) => $.budget.approveDescription)}
            >
              <Button
                size="sm"
                className="self-start"
                disabled={approve.isPending}
                onClick={async () => {
                  try {
                    await approve.mutateAsync(selectedBudgetId);
                    toast({ title: t(($) => $.budget.toast.approved) });
                  } catch (error) {
                    toast({
                      title: t(($) => $.budget.approveFailed),
                      description: backendMessage(error),
                      variant: 'destructive',
                    });
                  }
                }}
              >
                {t(($) => $.budget.approve)}
              </Button>
            </Panel>
          )}

          <VsActualPanel budgetId={selectedBudgetId} />
          <AlertsPanel budgetId={selectedBudgetId} />
        </>
      )}

      {selectedBudgetId === null && (
        <p className="text-xs text-muted-foreground">{t(($) => $.budget.selectHint)}</p>
      )}
    </div>
  );
}

function CreateBudgetPanel() {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const years = useFiscalYears();
  const create = useCreateBudget();

  const [yearId, setYearId] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [scenario, setScenario] = useState('');

  const ready = yearId !== '' && name.trim() !== '';

  return (
    <Panel title={t(($) => $.budget.newTitle)} hint={t(($) => $.budget.newDescription)}>
      <div className="grid gap-3 md:grid-cols-4">
        <Field id="budget-year" label={t(($) => $.budget.fiscalYear)}>
          <Select value={yearId} onValueChange={setYearId}>
            <SelectTrigger id="budget-year" className="h-9 text-sm">
              <SelectValue placeholder={t(($) => $.budget.selectYear)} />
            </SelectTrigger>
            <SelectContent>
              {(years.data ?? []).map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  {year.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="budget-name" label={t(($) => $.budget.name)}>
          <Input id="budget-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field id="budget-version" label={t(($) => $.budget.version)}>
          <Input
            id="budget-version"
            value={version}
            placeholder={t(($) => $.budget.versionDefault)}
            onChange={(e) => setVersion(e.target.value)}
          />
        </Field>

        <Field id="budget-scenario" label={t(($) => $.budget.scenario)}>
          <Input
            id="budget-scenario"
            value={scenario}
            placeholder={t(($) => $.budget.scenarioDefault)}
            onChange={(e) => setScenario(e.target.value)}
          />
        </Field>
      </div>

      <Button
        size="sm"
        className="self-start"
        disabled={!ready || create.isPending}
        onClick={async () => {
          try {
            await create.mutateAsync({
              fiscal_year_id: yearId,
              name: name.trim(),
              version: version.trim() === '' ? undefined : version.trim(),
              scenario: scenario.trim() === '' ? undefined : scenario.trim(),
            });
            toast({ title: t(($) => $.budget.toast.created) });
            setName('');
            setVersion('');
            setScenario('');
          } catch (error) {
            toast({
              title: t(($) => $.budget.createFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {create.isPending ? t(($) => $.treasury.common.saving) : t(($) => $.budget.create)}
      </Button>
    </Panel>
  );
}

/** The dimension a budget line — or a control probe — is measured on. */
function DimensionSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: BudgetDimension;
  onChange: (value: BudgetDimension) => void;
}) {
  const { t } = useTranslation('finance');

  return (
    <Select value={value} onValueChange={(v) => onChange(v as BudgetDimension)}>
      <SelectTrigger id={id} className="h-9 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BUDGET_DIMENSIONS.map((dimension) => (
          <SelectItem key={dimension} value={dimension}>
            {t(($) => $.budget.dimension[dimension])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AccountSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation('finance');
  const accounts = useAccounts({ postable_only: true });

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-9 text-sm">
        <SelectValue placeholder={t(($) => $.budget.selectAccount)} />
      </SelectTrigger>
      <SelectContent>
        {(accounts.data ?? []).map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.code} · {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AddLinePanel({ budgetId }: { budgetId: string }) {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const addLine = useAddBudgetLine();

  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [dimension, setDimension] = useState<BudgetDimension>('company');
  const [dimensionId, setDimensionId] = useState('');
  const [periodNumber, setPeriodNumber] = useState('');

  const ready = accountId !== '' && amount !== '';

  return (
    <Panel title={t(($) => $.budget.lineTitle)} hint={t(($) => $.budget.lineDescription)}>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Field id="line-account" label={t(($) => $.budget.account)}>
          <AccountSelect id="line-account" value={accountId} onChange={setAccountId} />
        </Field>
        <Field id="line-amount" label={t(($) => $.budget.amount)}>
          <Input
            id="line-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field id="line-dimension" label={t(($) => $.budget.dimensionLabel)}>
          <DimensionSelect id="line-dimension" value={dimension} onChange={setDimension} />
        </Field>
        <Field id="line-dimension-id" label={t(($) => $.budget.dimensionId)}>
          <Input
            id="line-dimension-id"
            value={dimensionId}
            disabled={dimension === 'company'}
            onChange={(e) => setDimensionId(e.target.value)}
          />
        </Field>
        <Field id="line-period" label={t(($) => $.budget.periodNumber)}>
          <Input
            id="line-period"
            type="number"
            min={1}
            max={12}
            value={periodNumber}
            placeholder={t(($) => $.budget.periodAll)}
            onChange={(e) => setPeriodNumber(e.target.value)}
          />
        </Field>
      </div>

      <Button
        size="sm"
        className="self-start"
        disabled={!ready || addLine.isPending}
        onClick={async () => {
          try {
            await addLine.mutateAsync({
              budgetId,
              payload: {
                account_id: accountId,
                amount: Number(amount),
                dimension_type: dimension,
                dimension_id:
                  dimension === 'company' || dimensionId.trim() === '' ? null : dimensionId.trim(),
                period_number: periodNumber === '' ? null : Number(periodNumber),
              },
            });
            toast({ title: t(($) => $.budget.toast.lineAdded) });
            setAmount('');
          } catch (error) {
            toast({
              title: t(($) => $.budget.lineFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {t(($) => $.budget.addLine)}
      </Button>
    </Panel>
  );
}

function NewVersionPanel({ budgetId }: { budgetId: string }) {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const newVersion = useNewBudgetVersion();

  const [version, setVersion] = useState('');

  return (
    <Panel title={t(($) => $.budget.versionTitle)} hint={t(($) => $.budget.versionDescription)}>
      <Field id="new-version" label={t(($) => $.budget.version)}>
        <Input id="new-version" value={version} onChange={(e) => setVersion(e.target.value)} />
      </Field>

      <Button
        size="sm"
        className="self-start"
        disabled={version.trim() === '' || newVersion.isPending}
        onClick={async () => {
          try {
            await newVersion.mutateAsync({ budgetId, version: version.trim() });
            toast({ title: t(($) => $.budget.toast.versionCreated) });
            setVersion('');
          } catch (error) {
            toast({
              title: t(($) => $.budget.versionFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {t(($) => $.budget.createVersion)}
      </Button>
    </Panel>
  );
}

/** ok | warn | over — the engine's verdict, rendered, never recomputed. */
function LineStatus({ status }: { status: BudgetVsActualLine['status'] }) {
  const { t } = useTranslation('finance');
  const tone =
    status === 'over' ? 'text-red-600' : status === 'warn' ? 'text-amber-600' : 'text-emerald-600';

  return (
    <span className={`text-xs font-medium ${tone}`}>{t(($) => $.budget.lineStatus[status])}</span>
  );
}

function VsActualPanel({ budgetId }: { budgetId: string }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const vsActual = useBudgetVsActual(budgetId);

  const columns = useMemo<DataGridColumnDef<BudgetVsActualLine>[]>(
    () => [
      {
        key: 'account_code',
        label: t(($) => $.budget.account),
        pin: 'left',
        cell: (l) => <span className="font-medium">{l.account_code ?? '—'}</span>,
      },
      {
        key: 'dimension_type',
        label: t(($) => $.budget.dimensionLabel),
        cell: (l) => (
          <span>
            {t(($) => $.budget.dimension[l.dimension_type])}
            {l.dimension_id ? ` · ${l.dimension_id}` : ''}
          </span>
        ),
      },
      {
        key: 'period_number',
        label: t(($) => $.budget.periodNumber),
        align: 'end',
        cell: (l) => (
          <span className="tabular-nums">{l.period_number ?? t(($) => $.budget.periodAll)}</span>
        ),
      },
      {
        key: 'budget',
        label: t(($) => $.budget.budgeted),
        align: 'end',
        cell: (l) => <span className="tabular-nums">{fmt.money(l.budget)}</span>,
      },
      {
        key: 'actual',
        label: t(($) => $.budget.actual),
        align: 'end',
        cell: (l) => <span className="tabular-nums">{fmt.money(l.actual)}</span>,
      },
      {
        key: 'committed',
        label: t(($) => $.budget.committed),
        align: 'end',
        cell: (l) => <span className="tabular-nums">{fmt.money(l.committed)}</span>,
      },
      {
        key: 'available',
        label: t(($) => $.budget.available),
        align: 'end',
        cell: (l) => <span className="tabular-nums font-medium">{fmt.money(l.available)}</span>,
      },
      {
        key: 'consumption_pct',
        label: t(($) => $.budget.consumption),
        align: 'end',
        cell: (l) => <span className="tabular-nums">{l.consumption_pct}%</span>,
      },
      {
        key: 'status',
        label: t(($) => $.budget.status),
        cell: (l) => <LineStatus status={l.status} />,
      },
    ],
    [t, fmt],
  );

  const totals = vsActual.data?.totals;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t(($) => $.budget.vsActual)}
      </h3>

      <UniversalDataGrid
        data={vsActual.data?.lines ?? []}
        columns={columns}
        rowId={(l) => l.line_id}
        loading={vsActual.isLoading}
        error={vsActual.isError}
        emptyState={
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t(($) => $.budget.noLines)}
          </p>
        }
      />

      {totals && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label={t(($) => $.budget.budgeted)} value={fmt.money(totals.budget)} />
          <Stat label={t(($) => $.budget.actual)} value={fmt.money(totals.actual)} />
          <Stat label={t(($) => $.budget.committed)} value={fmt.money(totals.committed)} />
          <Stat label={t(($) => $.budget.available)} value={fmt.money(totals.available)} />
          <Stat
            label={t(($) => $.budget.consumption)}
            value={`${totals.consumption_pct}%`}
            tone={
              totals.consumption_pct >= 100
                ? 'danger'
                : totals.consumption_pct >= 90
                  ? 'warn'
                  : 'default'
            }
          />
        </div>
      )}
    </div>
  );
}

function AlertsPanel({ budgetId }: { budgetId: string }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const alerts = useBudgetAlerts(budgetId);

  const rows = alerts.data ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t(($) => $.budget.alerts)}
      </h3>

      {alerts.isLoading ? (
        <p className="text-sm text-muted-foreground">{t(($) => $.loading)}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(($) => $.budget.noAlerts)}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((line) => (
            <li
              key={line.line_id}
              className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-4 py-2 text-sm"
            >
              <LineStatus status={line.status} />
              <span className="font-medium">{line.account_code ?? '—'}</span>
              <span className="text-muted-foreground">
                {t(($) => $.budget.consumption)}: {line.consumption_pct}%
              </span>
              <span className="text-muted-foreground">
                {t(($) => $.budget.available)}: {fmt.money(line.available)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Budget control ───────────────────────────────────────────────────────────

function ControlTab() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();

  const years = useFiscalYears();
  const { toast } = useToast();

  const availability = useBudgetAvailability();
  const evaluate = useEvaluateSpend();
  const commit = useCommitBudget();
  const release = useReleaseCommitment();

  const [yearId, setYearId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [dimension, setDimension] = useState<BudgetDimension>('company');
  const [periodNumber, setPeriodNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [commitmentId, setCommitmentId] = useState('');

  const context: BudgetContext = {
    fiscal_year_id: yearId,
    account_id: accountId,
    dimension_type: dimension,
    period_number: periodNumber === '' ? null : Number(periodNumber),
  };

  const contextReady = yearId !== '' && accountId !== '';
  const amountReady = amount !== '' && Number(amount) > 0;

  const verdict = evaluate.data;

  return (
    <div className="space-y-4">
      <Panel title={t(($) => $.budget.control.title)} hint={t(($) => $.budget.control.description)}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field id="ctl-year" label={t(($) => $.budget.fiscalYear)}>
            <Select value={yearId} onValueChange={setYearId}>
              <SelectTrigger id="ctl-year" className="h-9 text-sm">
                <SelectValue placeholder={t(($) => $.budget.selectYear)} />
              </SelectTrigger>
              <SelectContent>
                {(years.data ?? []).map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="ctl-account" label={t(($) => $.budget.account)}>
            <AccountSelect id="ctl-account" value={accountId} onChange={setAccountId} />
          </Field>

          <Field id="ctl-dimension" label={t(($) => $.budget.dimensionLabel)}>
            <DimensionSelect id="ctl-dimension" value={dimension} onChange={setDimension} />
          </Field>

          <Field id="ctl-period" label={t(($) => $.budget.periodNumber)}>
            <Input
              id="ctl-period"
              type="number"
              min={1}
              max={12}
              value={periodNumber}
              placeholder={t(($) => $.budget.periodAll)}
              onChange={(e) => setPeriodNumber(e.target.value)}
            />
          </Field>
        </div>

        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          disabled={!contextReady || availability.isPending}
          onClick={async () => {
            try {
              await availability.mutateAsync(context);
            } catch (error) {
              toast({
                title: t(($) => $.budget.control.availabilityFailed),
                description: backendMessage(error),
                variant: 'destructive',
              });
            }
          }}
        >
          {t(($) => $.budget.control.checkAvailability)}
        </Button>

        {availability.data && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label={t(($) => $.budget.budgeted)} value={availability.data.budget} />
            <Stat label={t(($) => $.budget.actual)} value={availability.data.actual} />
            <Stat label={t(($) => $.budget.committed)} value={availability.data.committed} />
            <Stat label={t(($) => $.budget.available)} value={availability.data.available} />
            <Stat
              label={t(($) => $.budget.consumption)}
              value={`${availability.data.consumption_pct}%`}
            />
          </div>
        )}
      </Panel>

      <Panel
        title={t(($) => $.budget.control.evaluateTitle)}
        hint={t(($) => $.budget.control.evaluateDescription)}
      >
        <Field id="ctl-amount" label={t(($) => $.budget.amount)}>
          <Input
            id="ctl-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!contextReady || !amountReady || evaluate.isPending}
            onClick={async () => {
              try {
                await evaluate.mutateAsync({ ...context, amount: Number(amount) });
              } catch (error) {
                toast({
                  title: t(($) => $.budget.control.evaluateFailed),
                  description: backendMessage(error),
                  variant: 'destructive',
                });
              }
            }}
          >
            {t(($) => $.budget.control.evaluate)}
          </Button>

          {can('finance.budget.control') && (
            <Button
              size="sm"
              variant="secondary"
              disabled={!contextReady || !amountReady || commit.isPending}
              onClick={async () => {
                try {
                  await commit.mutateAsync({ ...context, amount: Number(amount) });
                  toast({ title: t(($) => $.budget.toast.committed) });
                  setAmount('');
                } catch (error) {
                  toast({
                    title: t(($) => $.budget.control.commitFailed),
                    description: backendMessage(error),
                    variant: 'destructive',
                  });
                }
              }}
            >
              {t(($) => $.budget.control.commit)}
            </Button>
          )}
        </div>

        {verdict && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label={t(($) => $.budget.control.verdict)}
              value={t(($) => $.budget.control.verdictValue[verdict.verdict])}
              tone={
                verdict.verdict === 'blocked'
                  ? 'danger'
                  : verdict.verdict === 'warn'
                    ? 'warn'
                    : 'default'
              }
            />
            <Stat
              label={t(($) => $.budget.control.projected)}
              value={`${verdict.projected_consumption_pct}%`}
            />
            <Stat label={t(($) => $.budget.available)} value={verdict.available} />
            <Stat
              label={t(($) => $.budget.control.thresholds)}
              value={`${verdict.warn_threshold_pct}% / ${verdict.block_threshold_pct}%`}
            />
          </div>
        )}
      </Panel>

      {can('finance.budget.control') && (
        <>
          <Panel
            title={t(($) => $.budget.control.releaseTitle)}
            hint={t(($) => $.budget.control.releaseDescription)}
          >
            <Field id="ctl-commitment" label={t(($) => $.budget.control.commitmentId)}>
              <Input
                id="ctl-commitment"
                dir="ltr"
                value={commitmentId}
                onChange={(e) => setCommitmentId(e.target.value)}
              />
            </Field>

            <Button
              size="sm"
              className="self-start"
              disabled={commitmentId.trim() === '' || release.isPending}
              onClick={async () => {
                try {
                  await release.mutateAsync(commitmentId.trim());
                  toast({ title: t(($) => $.budget.toast.released) });
                  setCommitmentId('');
                } catch (error) {
                  toast({
                    title: t(($) => $.budget.control.releaseFailed),
                    description: backendMessage(error),
                    variant: 'destructive',
                  });
                }
              }}
            >
              {t(($) => $.budget.control.release)}
            </Button>
          </Panel>

          <ControlRulePanel />
        </>
      )}
    </div>
  );
}

function ControlRulePanel() {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const createRule = useCreateControlRule();

  const [scope, setScope] = useState<'global' | 'account' | 'dimension'>('global');
  const [accountId, setAccountId] = useState('');
  const [warn, setWarn] = useState('90');
  const [block, setBlock] = useState('100');
  const [action, setAction] = useState<'warn' | 'block' | 'none'>('warn');

  return (
    <Panel
      title={t(($) => $.budget.control.ruleTitle)}
      hint={t(($) => $.budget.control.ruleDescription)}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Field id="rule-scope" label={t(($) => $.budget.control.scope)}>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger id="rule-scope" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">{t(($) => $.budget.control.scopeGlobal)}</SelectItem>
              <SelectItem value="account">{t(($) => $.budget.control.scopeAccount)}</SelectItem>
              <SelectItem value="dimension">{t(($) => $.budget.control.scopeDimension)}</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field id="rule-account" label={t(($) => $.budget.account)}>
          <AccountSelect id="rule-account" value={accountId} onChange={setAccountId} />
        </Field>

        <Field id="rule-warn" label={t(($) => $.budget.control.warnThreshold)}>
          <Input
            id="rule-warn"
            type="number"
            min={0}
            max={999}
            value={warn}
            onChange={(e) => setWarn(e.target.value)}
          />
        </Field>

        <Field id="rule-block" label={t(($) => $.budget.control.blockThreshold)}>
          <Input
            id="rule-block"
            type="number"
            min={0}
            max={999}
            value={block}
            onChange={(e) => setBlock(e.target.value)}
          />
        </Field>

        <Field id="rule-action" label={t(($) => $.budget.control.action)}>
          <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
            <SelectTrigger id="rule-action" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="warn">{t(($) => $.budget.control.actionWarn)}</SelectItem>
              <SelectItem value="block">{t(($) => $.budget.control.actionBlock)}</SelectItem>
              <SelectItem value="none">{t(($) => $.budget.control.actionNone)}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Button
        size="sm"
        className="self-start"
        disabled={(scope === 'account' && accountId === '') || createRule.isPending}
        onClick={async () => {
          try {
            await createRule.mutateAsync({
              scope,
              account_id: scope === 'account' && accountId !== '' ? accountId : null,
              warn_threshold_pct: warn === '' ? undefined : Number(warn),
              block_threshold_pct: block === '' ? undefined : Number(block),
              action,
            });
            toast({ title: t(($) => $.budget.toast.ruleCreated) });
          } catch (error) {
            toast({
              title: t(($) => $.budget.control.ruleFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {t(($) => $.budget.control.createRule)}
      </Button>

      <p className="text-xs text-muted-foreground">{t(($) => $.budget.control.noRuleList)}</p>
    </Panel>
  );
}

export default BudgetsPage;
