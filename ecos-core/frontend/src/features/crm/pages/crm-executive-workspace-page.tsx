import { useMemo, useState, type ReactNode } from 'react';
import { Download, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { QuickStatCard } from '@/components/ds';
import { Badge } from '@/components/ui/badge';
import { usePermission } from '@/features/authorization';
import {
  useCrmExecutiveGrowth,
  useCrmExecutiveKpis,
  useCrmExecutiveLifetimeValue,
  useCrmExecutiveRetention,
  useCrmExecutiveSatisfaction,
} from '@/features/crm/hooks/use-crm-executive';
import type {
  CrmExecutiveQuery,
  CrmGrowthPoint,
  CrmPeriodKind,
} from '@/features/crm/types/crm-executive';
import type enCrm from '@/i18n/locales/en/crm.json';

/**
 * CRM Executive Workspace.
 *
 * Reads only /crm/executive. Every route there is a GET report — there are no
 * executive actions — so the workspace offers period views and export rather
 * than operations.
 *
 * SCOPE, STATED HONESTLY. The executive API takes period, year, month, quarter
 * and a custom start/end. It does NOT take a branch, and company comes from the
 * authenticated user rather than a parameter. So this filters by date range
 * only, and says so on screen; a branch selector that silently changed nothing
 * would be worse than its absence.
 *
 * No charts. The platform has no charting library — what looks like one
 * elsewhere is a lucide icon — so the growth series renders through
 * UniversalDataGrid, which is the real tabular primitive here. Introducing a
 * chart dependency is not a UI task's call to make.
 */

type CrmLabel = ($: typeof enCrm) => string;

const PERIODS: { value: CrmPeriodKind; label: CrmLabel }[] = [
  { value: 'monthly', label: ($) => $.executive.period.monthly },
  { value: 'quarterly', label: ($) => $.executive.period.quarterly },
  { value: 'annual', label: ($) => $.executive.period.annual },
  { value: 'custom', label: ($) => $.executive.period.custom },
];

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

export function CrmExecutiveWorkspacePage() {
  const { t, i18n } = useTranslation('crm');
  const { can } = usePermission();

  const now = new Date();
  const [period, setPeriod] = useState<CrmPeriodKind>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const params: CrmExecutiveQuery = useMemo(
    () =>
      period === 'custom'
        ? { period, start: start || undefined, end: end || undefined }
        : { period, year },
    [period, year, start, end],
  );

  const kpis = useCrmExecutiveKpis(params);
  const growth = useCrmExecutiveGrowth(params);
  const satisfaction = useCrmExecutiveSatisfaction(params);
  const retention = useCrmExecutiveRetention();
  const ltv = useCrmExecutiveLifetimeValue();

  const num = (v: number | string | null | undefined) =>
    v === null || v === undefined ? '—' : new Intl.NumberFormat(i18n.language).format(Number(v));
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

  const growthColumns: DataGridColumnDef<CrmGrowthPoint>[] = useMemo(
    () => [
      {
        key: 'label',
        label: t(($) => $.executive.growth.columns.label),
        cell: (row) => row.label,
      },
      {
        key: 'acquired',
        label: t(($) => $.executive.growth.columns.acquired),
        align: 'end',
        cell: (row) => num(row.customers_acquired),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  /** Exports what is on screen. No server export endpoint is wired here. */
  function exportGrowthCsv() {
    const rows = growth.data?.series ?? [];
    const header = ['label', 'customers_acquired'].join(',');
    const body = rows.map((r) => `${r.label},${r.customers_acquired}`).join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm-growth.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const newMetric = kpis.data?.new_customers;

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold md:text-2xl">{t(($) => $.executive.title)}</h1>
        <p className="text-sm text-muted-foreground">{t(($) => $.executive.subtitle)}</p>
        <p className="text-[11px] text-muted-foreground">{t(($) => $.executive.scopeNote)}</p>
      </header>

      <SmartToolbar
        onRefresh={() => {
          void kpis.refetch();
          void growth.refetch();
          void satisfaction.refetch();
        }}
        isFetching={kpis.isFetching || growth.isFetching}
        refreshLabel={t(($) => $.executive.refresh)}
        secondaryActions={
          can('crm.executive.export')
            ? [
                {
                  key: 'export-growth',
                  label: t(($) => $.executive.export),
                  onClick: exportGrowthCsv,
                  icon: Download,
                },
              ]
            : undefined
        }
        viewControls={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as CrmPeriodKind)}
              aria-label={t(($) => $.executive.period.label)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {t(p.label)}
                </option>
              ))}
            </select>

            {period === 'custom' ? (
              <>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  aria-label={t(($) => $.executive.period.start)}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                />
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  aria-label={t(($) => $.executive.period.end)}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                />
              </>
            ) : (
              <input
                type="number"
                value={year}
                min={2000}
                max={2100}
                onChange={(e) => setYear(Number(e.target.value))}
                aria-label={t(($) => $.executive.period.year)}
                className="h-9 w-24 rounded-md border bg-background px-2 text-sm"
              />
            )}
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickStatCard
          icon={Users}
          title={t(($) => $.executive.kpi.total)}
          value={num(kpis.data?.total_customers)}
        />
        <QuickStatCard
          icon={Users}
          title={t(($) => $.executive.kpi.active)}
          value={num(kpis.data?.active_customers)}
        />
        <QuickStatCard
          icon={newMetric && (newMetric.change ?? 0) < 0 ? TrendingDown : TrendingUp}
          title={t(($) => $.executive.kpi.new)}
          value={num(newMetric?.value)}
        />
      </section>

      <Section title={t(($) => $.executive.growth.title)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t(($) => $.executive.growth.opening)}
            value={num(growth.data?.opening_customers)}
          />
          <Stat
            label={t(($) => $.executive.growth.closing)}
            value={num(growth.data?.closing_customers)}
          />
          <Stat label={t(($) => $.executive.growth.acquired)} value={num(growth.data?.acquired)} />
          <Stat
            label={t(($) => $.executive.growth.rate)}
            value={pct(growth.data?.growth_rate_percent)}
          />
        </div>

        <UniversalDataGrid<CrmGrowthPoint>
          data={growth.data?.series ?? []}
          columns={growthColumns}
          rowId={(row) => row.start}
          loading={growth.isLoading}
          emptyState={
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t(($) => $.executive.growth.none)}
            </p>
          }
        />
      </Section>

      <Section
        title={t(($) => $.executive.retention.title)}
        note={t(($) => $.executive.ltv.companyWide)}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t(($) => $.executive.retention.retentionRate)}
            value={pct(retention.data?.retention_rate_percent)}
          />
          <Stat
            label={t(($) => $.executive.retention.churnRate)}
            value={pct(retention.data?.churn_rate_percent)}
          />
          <Stat
            label={t(($) => $.executive.retention.repeat)}
            value={num(retention.data?.repeat_customers)}
          />
          <Stat
            label={t(($) => $.executive.retention.atRisk)}
            value={
              <span className="flex items-center gap-2">
                {num(retention.data?.at_risk_customers)}
                {(retention.data?.at_risk_customers ?? 0) > 0 && (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                    !
                  </Badge>
                )}
              </span>
            }
          />
        </div>
      </Section>

      <Section title={t(($) => $.executive.satisfaction.title)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t(($) => $.executive.satisfaction.csat)}
            value={pct(satisfaction.data?.csat_percent)}
          />
          <Stat
            label={t(($) => $.executive.satisfaction.nps)}
            value={num(satisfaction.data?.nps)}
          />
          <Stat
            label={t(($) => $.executive.satisfaction.rating)}
            value={num(satisfaction.data?.average_rating)}
          />
          <Stat
            label={t(($) => $.executive.satisfaction.responses)}
            value={num(satisfaction.data?.responses)}
          />
        </div>
      </Section>

      <Section
        title={t(($) => $.executive.ltv.title)}
        note={t(($) => $.executive.ltv.companyWide)}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label={t(($) => $.executive.ltv.valued)} value={num(ltv.data?.customers_valued)} />
          <Stat
            label={t(($) => $.executive.ltv.total)}
            value={num(ltv.data?.total_lifetime_value)}
          />
          <Stat
            label={t(($) => $.executive.ltv.average)}
            value={num(ltv.data?.average_lifetime_value)}
          />
        </div>
      </Section>
    </div>
  );
}

export default CrmExecutiveWorkspacePage;
