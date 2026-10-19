import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Scale } from 'lucide-react';

import { UniversalDataGrid, type DataGridColumnDef } from '@/components/data-grid';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspacePage } from '@/components/page';
import { WorkspaceHeader } from '@/components/workspace';
import { usePermission } from '@/features/authorization';
import { useFormatter } from '@/hooks/use-formatter';
import { cn } from '@/lib/utils';

import { useExecutiveSummary } from '../hooks/use-finance-dashboard';
import { useTrialBalance } from '../hooks/use-finance-gl';
import type { TrialBalanceLine } from '../types/finance-gl';

/**
 * EPIC-FINANCE-UI-001 · Phase 3 — Financial Statements.
 * Trial Balance (`GET /finance/trial-balance`) + Balance Sheet & Income Statement
 * (`POST /finance/intelligence/reports/generate` type=executive_summary). All values are
 * displayed exactly as the backend returns them — never recalculated in the browser. No
 * backend changes; IAM-gated; EN/AR; responsive.
 */
export function FinancialStatementsPage() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.gl.statements.title) }]}
        title={t(($) => $.gl.statements.title)}
        description={t(($) => $.gl.statements.subtitle)}
      />
      <WorkspacePage>
        <Tabs defaultValue="trial-balance">
          <TabsList>
            <TabsTrigger value="trial-balance">{t(($) => $.gl.statements.tab.trialBalance)}</TabsTrigger>
            <TabsTrigger value="balance-sheet">{t(($) => $.gl.statements.tab.balanceSheet)}</TabsTrigger>
            <TabsTrigger value="income-statement">{t(($) => $.gl.statements.tab.incomeStatement)}</TabsTrigger>
          </TabsList>

          <TabsContent value="trial-balance" className="mt-4">
            {can('finance.trialbalance.view') ? <TrialBalanceTab /> : <NoAccess />}
          </TabsContent>
          <TabsContent value="balance-sheet" className="mt-4">
            {can('finance.reports.view') ? <BalanceSheetTab /> : <NoAccess />}
          </TabsContent>
          <TabsContent value="income-statement" className="mt-4">
            {can('finance.reports.view') ? <IncomeStatementTab /> : <NoAccess />}
          </TabsContent>
        </Tabs>
      </WorkspacePage>
    </>
  );
}

// ── Trial Balance ─────────────────────────────────────────────────────────────

function TrialBalanceTab() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const tb = useTrialBalance();

  const columns = useMemo<DataGridColumnDef<TrialBalanceLine>[]>(() => [
    { key: 'account_code', label: t(($) => $.gl.coa.field.code), pin: 'left', sortable: true, cell: (l) => <span className="font-medium tabular-nums">{l.account_code}</span> },
    { key: 'account_name', label: t(($) => $.gl.coa.field.name), cell: (l) => l.account_name },
    { key: 'account_type', label: t(($) => $.gl.coa.field.type), cell: (l) => t(($) => $.gl.coa.type[l.account_type]) },
    { key: 'debit', label: t(($) => $.gl.coa.balance.debit), align: 'end', cell: (l) => <span className="tabular-nums">{l.debit ? fmt.money(l.debit) : '—'}</span> },
    { key: 'credit', label: t(($) => $.gl.coa.balance.credit), align: 'end', cell: (l) => <span className="tabular-nums">{l.credit ? fmt.money(l.credit) : '—'}</span> },
    { key: 'balance', label: t(($) => $.gl.statements.tb.balance), align: 'end', cell: (l) => <span className="tabular-nums font-medium">{fmt.money(l.balance)}</span> },
  ], [t, fmt]);

  return (
    <div className="space-y-3">
      <UniversalDataGrid
        data={tb.data?.lines ?? []}
        columns={columns}
        rowId={(l) => l.account_id}
        loading={tb.isLoading}
        error={tb.isError}
        emptyState={<p className="py-10 text-center text-sm text-muted-foreground">{t(($) => $.empty)}</p>}
      />
      {tb.data && (
        <div className="flex flex-wrap items-center justify-end gap-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <span><span className="text-muted-foreground">{t(($) => $.gl.journal.totalDebit)}: </span><span className="tabular-nums font-semibold">{fmt.money(tb.data.total_debit)}</span></span>
          <span><span className="text-muted-foreground">{t(($) => $.gl.journal.totalCredit)}: </span><span className="tabular-nums font-semibold">{fmt.money(tb.data.total_credit)}</span></span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', tb.data.is_balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
            {t(tb.data.is_balanced ? ($) => $.gl.statements.tb.balanced : ($) => $.gl.statements.tb.unbalanced)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

function BalanceSheetTab() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const summary = useExecutiveSummary();
  const bs = summary.data?.balance_sheet;

  if (summary.isLoading) return <Muted>{t(($) => $.loading)}</Muted>;
  if (summary.isError || !bs) return <Muted>{summary.isError ? t(($) => $.error) : t(($) => $.empty)}</Muted>;

  return (
    <StatementCard>
      <StatementSection title={t(($) => $.gl.statements.bs.assets)}>
        <Line label={t(($) => $.gl.statements.bs.currentAssets)} value={fmt.money(bs.current_assets)} />
        <Line label={t(($) => $.gl.statements.bs.nonCurrentAssets)} value={fmt.money(bs.non_current_assets)} />
        <Line label={t(($) => $.gl.statements.bs.totalAssets)} value={fmt.money(bs.total_assets)} total />
      </StatementSection>
      <StatementSection title={t(($) => $.gl.statements.bs.liabilities)}>
        <Line label={t(($) => $.gl.statements.bs.currentLiabilities)} value={fmt.money(bs.current_liabilities)} />
        <Line label={t(($) => $.gl.statements.bs.nonCurrentLiabilities)} value={fmt.money(bs.non_current_liabilities)} />
        <Line label={t(($) => $.gl.statements.bs.totalLiabilities)} value={fmt.money(bs.total_liabilities)} total />
      </StatementSection>
      <StatementSection title={t(($) => $.gl.statements.bs.equitySection)}>
        <Line label={t(($) => $.gl.statements.bs.equity)} value={fmt.money(bs.equity)} total />
      </StatementSection>
      <StatementSection title={t(($) => $.gl.statements.bs.indicators)}>
        <Line label={t(($) => $.gl.statements.bs.workingCapital)} value={fmt.money(bs.working_capital)} />
        <Line label={t(($) => $.gl.statements.bs.currentRatio)} value={bs.current_ratio == null ? '—' : fmt.number(bs.current_ratio, 2)} />
      </StatementSection>
    </StatementCard>
  );
}

// ── Income Statement ──────────────────────────────────────────────────────────

function IncomeStatementTab() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const summary = useExecutiveSummary();
  const pl = summary.data?.profit_and_loss;

  if (summary.isLoading) return <Muted>{t(($) => $.loading)}</Muted>;
  if (summary.isError || !pl) return <Muted>{summary.isError ? t(($) => $.error) : t(($) => $.empty)}</Muted>;

  return (
    <StatementCard>
      <StatementSection title={t(($) => $.gl.statements.is.revenueSection)}>
        <Line label={t(($) => $.gl.statements.is.revenue)} value={fmt.money(pl.revenue)} />
        <Line label={t(($) => $.gl.statements.is.otherRevenue)} value={fmt.money(pl.other_revenue)} />
        <Line label={t(($) => $.gl.statements.is.totalRevenue)} value={fmt.money(pl.total_revenue)} total />
      </StatementSection>
      <StatementSection title={t(($) => $.gl.statements.is.profitSection)}>
        <Line label={t(($) => $.gl.statements.is.costOfSales)} value={fmt.money(pl.cost_of_sales)} />
        <Line label={t(($) => $.gl.statements.is.grossProfit)} value={fmt.money(pl.gross_profit)} total />
        <Line label={t(($) => $.gl.statements.is.operatingExpense)} value={fmt.money(pl.operating_expense)} />
        <Line label={t(($) => $.gl.statements.is.operatingProfit)} value={fmt.money(pl.operating_profit)} total />
        <Line label={t(($) => $.gl.statements.is.otherExpense)} value={fmt.money(pl.other_expense)} />
        <Line label={t(($) => $.gl.statements.is.netProfit)} value={fmt.money(pl.net_profit)} total emphasize />
      </StatementSection>
      <StatementSection title={t(($) => $.gl.statements.is.margins)}>
        <Line label={t(($) => $.gl.statements.is.grossMargin)} value={fmt.percent(pl.gross_margin_pct, false)} />
        <Line label={t(($) => $.gl.statements.is.operatingMargin)} value={fmt.percent(pl.operating_margin_pct, false)} />
        <Line label={t(($) => $.gl.statements.is.netMargin)} value={fmt.percent(pl.net_margin_pct, false)} />
      </StatementSection>
    </StatementCard>
  );
}

// ── Shared presentational pieces ──────────────────────────────────────────────

function StatementCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="max-w-3xl">
      <CardContent className="space-y-6 py-6">{children}</CardContent>
    </Card>
  );
}

function StatementSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="divide-y divide-border">{children}</dl>
    </div>
  );
}

function Line({ label, value, total, emphasize }: { label: string; value: string; total?: boolean; emphasize?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-1.5 text-sm', total && 'font-semibold', emphasize && 'text-base')}>
      <dt className={cn(total ? 'text-foreground' : 'text-muted-foreground')}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="p-6 text-sm text-muted-foreground">{children}</p>;
}

function NoAccess() {
  const { t } = useTranslation('finance');
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <Scale className="size-5" aria-hidden />
        {t(($) => $.gl.statements.noAccess)}
      </CardContent>
    </Card>
  );
}

export default FinancialStatementsPage;
