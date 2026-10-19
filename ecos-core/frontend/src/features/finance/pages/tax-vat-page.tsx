import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, ScrollText, Scale, Percent } from 'lucide-react';

import { UniversalDataGrid, type DataGridColumnDef } from '@/components/data-grid';
import { useToast } from '@/components/ds/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspacePage } from '@/components/page';
import { WorkspaceHeader, type WorkspaceMetric } from '@/components/workspace';
import { usePermission } from '@/features/authorization';
import { useFormatter } from '@/hooks/use-formatter';

import { Field, NoAccess, Panel, Stat } from '../components/finance-panels';
import {
  useCreateTaxCategory,
  useCreateVatPeriod,
  useGenerateVatReturn,
  useSettleVatPeriod,
  useTaxCategories,
  useTaxCodes,
  useVatPeriods,
  useVatReport,
} from '../hooks/use-finance-control';
import type { TaxCategory, TaxCode, VatPeriod, VatReturn } from '../types/finance-control';
import { backendMessage } from '../utils/backend-message';

/**
 * EPIC-FINANCE-UI-001 · Phase 7 — Tax & VAT.
 *
 * The VAT engine is independent: no ETA or e-invoicing integration, and it
 * writes no ledger directly — settlement posts through the Posting Engine. The
 * return figures are derived live from the ledger's VAT accounts over the
 * period window, so this page displays them and never sums them itself.
 *
 * One contract gap is stated on screen rather than worked around: creating a
 * tax code requires the NUMERIC category and account ids, while every read
 * endpoint exposes UUIDs only. Tax codes are therefore read-only here. Closing
 * that gap is a backend change and is out of this EPIC's scope.
 *
 * No backend changes. IAM-gated per route permission; EN/AR; responsive.
 */
export function TaxVatPage() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();

  const periods = useVatPeriods();
  const codes = useTaxCodes();

  const canVat = can('finance.vat.view');
  const canTax = can('finance.gl.view');

  const openPeriods = useMemo(
    () => (periods.data ?? []).filter((p) => p.status !== 'settled').length,
    [periods.data],
  );

  const metrics = useMemo<WorkspaceMetric[]>(
    () => [
      {
        id: 'vat-periods',
        icon: Receipt,
        label: t(($) => $.tax.kpi.vatPeriods),
        value: periods.data?.length ?? 0,
        isLoading: periods.isLoading,
      },
      {
        id: 'vat-open',
        icon: Scale,
        label: t(($) => $.tax.kpi.openPeriods),
        value: openPeriods,
        isLoading: periods.isLoading,
        colorClass: openPeriods > 0 ? 'text-amber-600' : undefined,
      },
      {
        id: 'tax-codes',
        icon: Percent,
        label: t(($) => $.tax.kpi.taxCodes),
        value: codes.data?.length ?? 0,
        isLoading: codes.isLoading,
      },
      {
        id: 'tax-active',
        icon: ScrollText,
        label: t(($) => $.tax.kpi.activeCodes),
        value: codes.data?.filter((c) => c.is_active).length ?? 0,
        isLoading: codes.isLoading,
      },
    ],
    [periods.data, periods.isLoading, openPeriods, codes.data, codes.isLoading, t],
  );

  const header = (
    <WorkspaceHeader
      breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.tax.title) }]}
      title={t(($) => $.tax.title)}
      description={t(($) => $.tax.subtitle)}
      metrics={canVat || canTax ? metrics : undefined}
    />
  );

  if (!canVat && !canTax) {
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
        <Tabs defaultValue={canVat ? 'vat' : 'tax'}>
          <TabsList>
            {canVat && <TabsTrigger value="vat">{t(($) => $.tax.tab.vat)}</TabsTrigger>}
            {canTax && <TabsTrigger value="tax">{t(($) => $.tax.tab.tax)}</TabsTrigger>}
          </TabsList>

          {canVat && (
            <TabsContent value="vat" className="mt-4">
              <VatTab />
            </TabsContent>
          )}
          {canTax && (
            <TabsContent value="tax" className="mt-4">
              <TaxTab />
            </TabsContent>
          )}
        </Tabs>
      </WorkspacePage>
    </>
  );
}

// ── VAT ──────────────────────────────────────────────────────────────────────

function VatTab() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();

  const periods = useVatPeriods();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const columns = useMemo<DataGridColumnDef<VatPeriod>[]>(
    () => [
      {
        key: 'name',
        label: t(($) => $.tax.vat.period),
        pin: 'left',
        cell: (p) => <span className="font-medium">{p.name}</span>,
      },
      {
        key: 'start_date',
        label: t(($) => $.tax.vat.start),
        cell: (p) => (p.start_date ? fmt.date(p.start_date) : '—'),
      },
      {
        key: 'end_date',
        label: t(($) => $.tax.vat.end),
        cell: (p) => (p.end_date ? fmt.date(p.end_date) : '—'),
      },
      { key: 'status', label: t(($) => $.tax.vat.status), cell: (p) => p.status },
      {
        key: 'settlement_journal_id',
        label: t(($) => $.tax.vat.settlementJournal),
        align: 'end',
        cell: (p) => (
          <span className="tabular-nums">
            {p.settlement_journal_id ?? t(($) => $.treasury.common.none)}
          </span>
        ),
      },
    ],
    [t, fmt],
  );

  return (
    <div className="space-y-4">
      <UniversalDataGrid
        data={periods.data ?? []}
        columns={columns}
        rowId={(p) => p.id}
        loading={periods.isLoading}
        error={periods.isError}
        onRowClick={(p) => setSelectedId(p.id)}
        emptyState={
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t(($) => $.tax.vat.empty)}
          </p>
        }
      />

      {can('finance.vat.manage') && <CreateVatPeriodPanel />}

      {selectedId === null ? (
        <p className="text-xs text-muted-foreground">{t(($) => $.tax.vat.selectHint)}</p>
      ) : (
        <VatPeriodDetail periodId={selectedId} />
      )}
    </div>
  );
}

function CreateVatPeriodPanel() {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const create = useCreateVatPeriod();

  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const ready = name.trim() !== '' && start !== '' && end !== '' && end >= start;

  return (
    <Panel title={t(($) => $.tax.vat.newTitle)} hint={t(($) => $.tax.vat.newDescription)}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field id="vat-name" label={t(($) => $.tax.vat.period)}>
          <Input id="vat-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="vat-start" label={t(($) => $.tax.vat.start)}>
          <Input
            id="vat-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field id="vat-end" label={t(($) => $.tax.vat.end)}>
          <Input id="vat-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>

      {start !== '' && end !== '' && end < start && (
        <p className="text-xs text-destructive">{t(($) => $.tax.vat.endAfterStart)}</p>
      )}

      <Button
        size="sm"
        className="self-start"
        disabled={!ready || create.isPending}
        onClick={async () => {
          try {
            await create.mutateAsync({ name: name.trim(), start_date: start, end_date: end });
            toast({ title: t(($) => $.tax.toast.vatPeriodCreated) });
            setName('');
            setStart('');
            setEnd('');
          } catch (error) {
            toast({
              title: t(($) => $.tax.vat.createFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {create.isPending ? t(($) => $.treasury.common.saving) : t(($) => $.tax.vat.create)}
      </Button>
    </Panel>
  );
}

function VatPeriodDetail({ periodId }: { periodId: string }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();
  const { toast } = useToast();

  const report = useVatReport(periodId);
  const generate = useGenerateVatReturn();
  const settle = useSettleVatPeriod();

  const [filed, setFiled] = useState<VatReturn | null>(null);

  if (report.isLoading) {
    return <p className="text-sm text-muted-foreground">{t(($) => $.loading)}</p>;
  }
  if (report.isError || !report.data) {
    return <p className="text-sm text-destructive">{t(($) => $.tax.vat.reportFailed)}</p>;
  }

  const data = report.data;
  const settled = data.status === 'settled';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">
          {t(($) => $.tax.vat.reportTitle, { period: data.period })}
        </h3>
        <p className="text-xs text-muted-foreground">{t(($) => $.tax.vat.reportDescription)}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t(($) => $.tax.vat.outputVat)} value={fmt.money(data.output_vat)} />
        <Stat
          label={t(($) => $.tax.vat.inputRecoverable)}
          value={fmt.money(data.input_vat_recoverable)}
        />
        <Stat
          label={t(($) => $.tax.vat.inputNonRecoverable)}
          value={fmt.money(data.input_vat_non_recoverable)}
        />
        <Stat
          label={t(($) => $.tax.vat.netPayable)}
          value={fmt.money(data.net_payable)}
          tone={data.net_payable > 0 ? 'warn' : 'default'}
        />
      </div>

      {can('finance.vat.manage') && (
        <Panel title={t(($) => $.tax.vat.actions)} hint={t(($) => $.tax.vat.actionsDescription)}>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={settled || generate.isPending}
              onClick={async () => {
                try {
                  setFiled(await generate.mutateAsync(periodId));
                  toast({ title: t(($) => $.tax.toast.returnGenerated) });
                } catch (error) {
                  toast({
                    title: t(($) => $.tax.vat.returnFailed),
                    description: backendMessage(error),
                    variant: 'destructive',
                  });
                }
              }}
            >
              {t(($) => $.tax.vat.generateReturn)}
            </Button>

            <Button
              size="sm"
              disabled={settled || settle.isPending}
              onClick={async () => {
                try {
                  await settle.mutateAsync(periodId);
                  toast({ title: t(($) => $.tax.toast.periodSettled) });
                } catch (error) {
                  toast({
                    title: t(($) => $.tax.vat.settleFailed),
                    description: backendMessage(error),
                    variant: 'destructive',
                  });
                }
              }}
            >
              {t(($) => $.tax.vat.settle)}
            </Button>
          </div>

          {settled && (
            <p className="text-xs text-muted-foreground">{t(($) => $.tax.vat.alreadySettled)}</p>
          )}
        </Panel>
      )}

      {filed && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label={t(($) => $.tax.vat.filedStatus)} value={filed.status} />
          <Stat label={t(($) => $.tax.vat.outputVat)} value={fmt.money(filed.output_vat)} />
          <Stat
            label={t(($) => $.tax.vat.inputRecoverable)}
            value={fmt.money(filed.input_vat_recoverable)}
          />
          <Stat label={t(($) => $.tax.vat.netPayable)} value={fmt.money(filed.net_payable)} />
        </div>
      )}
    </div>
  );
}

// ── Tax ──────────────────────────────────────────────────────────────────────

function TaxTab() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();

  const categories = useTaxCategories();
  const codes = useTaxCodes();

  const categoryColumns = useMemo<DataGridColumnDef<TaxCategory>[]>(
    () => [
      {
        key: 'code',
        label: t(($) => $.tax.category.code),
        pin: 'left',
        cell: (c) => <span className="font-medium">{c.code}</span>,
      },
      { key: 'name', label: t(($) => $.tax.category.name), cell: (c) => c.name },
      {
        key: 'is_recoverable',
        label: t(($) => $.tax.recoverable),
        cell: (c) => (c.is_recoverable ? t(($) => $.tax.yes) : t(($) => $.tax.no)),
      },
      {
        key: 'is_active',
        label: t(($) => $.tax.category.status),
        cell: (c) =>
          c.is_active ? t(($) => $.treasury.cash.active) : t(($) => $.treasury.cash.inactive),
      },
    ],
    [t],
  );

  const codeColumns = useMemo<DataGridColumnDef<TaxCode>[]>(
    () => [
      {
        key: 'code',
        label: t(($) => $.tax.code.code),
        pin: 'left',
        cell: (c) => <span className="font-medium">{c.code}</span>,
      },
      { key: 'name', label: t(($) => $.tax.code.name), cell: (c) => c.name },
      {
        key: 'tax_type',
        label: t(($) => $.tax.code.type),
        cell: (c) => c.tax_type ?? t(($) => $.treasury.common.none),
      },
      {
        key: 'rate',
        label: t(($) => $.tax.code.rate),
        align: 'end',
        cell: (c) => <span className="tabular-nums">{c.rate}%</span>,
      },
      {
        key: 'is_recoverable',
        label: t(($) => $.tax.recoverable),
        cell: (c) => (c.is_recoverable ? t(($) => $.tax.yes) : t(($) => $.tax.no)),
      },
      {
        key: 'is_active',
        label: t(($) => $.tax.category.status),
        cell: (c) =>
          c.is_active ? t(($) => $.treasury.cash.active) : t(($) => $.treasury.cash.inactive),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(($) => $.tax.category.title)}
        </h3>
        <UniversalDataGrid
          data={categories.data ?? []}
          columns={categoryColumns}
          rowId={(c) => c.id}
          loading={categories.isLoading}
          error={categories.isError}
          emptyState={
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t(($) => $.tax.category.empty)}
            </p>
          }
        />
        {can('finance.tax.manage') && <CreateTaxCategoryPanel />}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t(($) => $.tax.code.title)}
        </h3>
        <UniversalDataGrid
          data={codes.data ?? []}
          columns={codeColumns}
          rowId={(c) => c.id}
          loading={codes.isLoading}
          error={codes.isError}
          emptyState={
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t(($) => $.tax.code.empty)}
            </p>
          }
        />
        <p className="text-xs text-muted-foreground">{t(($) => $.tax.code.readOnlyNote)}</p>
      </section>
    </div>
  );
}

function CreateTaxCategoryPanel() {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const create = useCreateTaxCategory();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [recoverable, setRecoverable] = useState(true);

  const ready = code.trim() !== '' && name.trim() !== '';

  return (
    <Panel title={t(($) => $.tax.category.newTitle)} hint={t(($) => $.tax.category.newDescription)}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field id="cat-code" label={t(($) => $.tax.category.code)}>
          <Input id="cat-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field id="cat-name" label={t(($) => $.tax.category.name)}>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="cat-name-ar" label={t(($) => $.tax.category.nameAr)}>
          <Input
            id="cat-name-ar"
            dir="rtl"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="cat-recoverable"
          checked={recoverable}
          onCheckedChange={(checked) => setRecoverable(checked === true)}
        />
        <Label htmlFor="cat-recoverable" className="text-sm font-normal">
          {t(($) => $.tax.recoverable)}
        </Label>
      </div>

      <Button
        size="sm"
        className="self-start"
        disabled={!ready || create.isPending}
        onClick={async () => {
          try {
            await create.mutateAsync({
              code: code.trim(),
              name: name.trim(),
              name_ar: nameAr.trim() === '' ? null : nameAr.trim(),
              is_recoverable: recoverable,
            });
            toast({ title: t(($) => $.tax.toast.categoryCreated) });
            setCode('');
            setName('');
            setNameAr('');
          } catch (error) {
            toast({
              title: t(($) => $.tax.category.createFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {create.isPending ? t(($) => $.treasury.common.saving) : t(($) => $.tax.category.create)}
      </Button>
    </Panel>
  );
}

export default TaxVatPage;
