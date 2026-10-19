import { useMemo, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  Banknote,
  Building2,
  Coins,
  HeartPulse,
  Landmark,
  Lightbulb,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkspacePage } from '@/components/page';
import { WorkspaceHeader, type WorkspaceMetric } from '@/components/workspace';
import { useAuthorization } from '@/features/authorization';
import { useFormatter } from '@/hooks/use-formatter';
import { cn } from '@/lib/utils';

import {
  useCfoWorkspace,
  useExecutiveSummary,
  useExecutiveWorkspace,
  useRecentJournals,
} from '../hooks/use-finance-dashboard';

const HEALTH_TONE: Record<string, string> = {
  strong: 'text-emerald-600',
  healthy: 'text-emerald-600',
  watch: 'text-amber-600',
  at_risk: 'text-red-600',
};

/**
 * EPIC-FINANCE-UI-001 · Phase 1 — Executive Finance Workspace.
 * Read-only executive dashboard composed entirely from the certified Finance intelligence
 * endpoints (executive-workspace, reports/generate, cfo-workspace, journals). No backend
 * changes; IAM-gated; EN/AR; responsive.
 */
export function FinanceExecutivePage() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = useAuthorization();

  const exec = useExecutiveWorkspace();
  const summary = useExecutiveSummary();
  const cfo = useCfoWorkspace();
  const journals = useRecentJournals();

  const data = exec.data;
  const bs = summary.data?.balance_sheet;

  const metrics = useMemo<WorkspaceMetric[]>(
    () => [
      { id: 'revenue', icon: TrendingUp, label: t(($) => $.kpi.revenue), value: fmt.money(data?.revenue), isLoading: exec.isLoading },
      { id: 'profit', icon: Coins, label: t(($) => $.kpi.profit), value: fmt.money(data?.profit), isLoading: exec.isLoading, colorClass: (data?.profit ?? 0) < 0 ? 'text-red-600' : undefined },
      { id: 'cash', icon: Wallet, label: t(($) => $.kpi.cash), value: fmt.money(data?.cash_position), isLoading: exec.isLoading },
      { id: 'working-capital', icon: Scale, label: t(($) => $.kpi.workingCapital), value: fmt.money(data?.working_capital), isLoading: exec.isLoading },
    ],
    [data, exec.isLoading, fmt, t],
  );

  if (!can('finance.analytics.view')) {
    return (
      <div className="p-8">
        <NoAccess message={t(($) => $.noAccess)} />
      </div>
    );
  }

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.breadcrumb.finance) }, { label: t(($) => $.exec.title) }]}
        title={t(($) => $.exec.title)}
        description={t(($) => $.exec.subtitle)}
        badge={data ? <PeriodBadge from={data.period.from} to={data.period.to} fmt={fmt} /> : undefined}
        metrics={metrics}
      />

      <WorkspacePage>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Financial Health */}
          <Section icon={HeartPulse} title={t(($) => $.health.title)} className="lg:col-span-1">
            {data ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className={cn('text-4xl font-semibold tabular-nums', HEALTH_TONE[data.financial_health.rating] ?? 'text-foreground')}>
                    {fmt.number(data.financial_health.score, 0)}
                  </span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                  <span className={cn('ms-auto text-sm font-medium capitalize', HEALTH_TONE[data.financial_health.rating])}>
                    {t(($) => $.health.rating[data.financial_health.rating as 'strong' | 'healthy' | 'watch' | 'at_risk'], { defaultValue: data.financial_health.rating.replace('_', ' ') })}
                  </span>
                </div>
                <ul className="space-y-2">
                  {data.financial_health.components.map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{t(($) => $.health.component[c.key as 'net_margin' | 'current_ratio' | 'equity_ratio' | 'cash_position'], { defaultValue: c.key.replace(/_/g, ' ') })}</span>
                      <span className="tabular-nums font-medium">{fmt.number(c.score, 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Loading loading={exec.isLoading} error={exec.isError} />
            )}
          </Section>

          {/* Balance position: Assets / Liabilities / Equity */}
          <Section icon={Landmark} title={t(($) => $.position.title)} className="lg:col-span-2">
            {bs ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile icon={Building2} label={t(($) => $.position.assets)} value={fmt.money(bs.total_assets)} tone="text-emerald-600" />
                <StatTile icon={Scale} label={t(($) => $.position.liabilities)} value={fmt.money(bs.total_liabilities)} tone="text-amber-600" />
                <StatTile icon={Banknote} label={t(($) => $.position.equity)} value={fmt.money(bs.equity)} tone="text-sky-600" />
              </div>
            ) : (
              <Loading loading={summary.isLoading} error={summary.isError} />
            )}
          </Section>

          {/* Revenue / Expenses / Profit */}
          <Section icon={TrendingUp} title={t(($) => $.performance.title)} className="lg:col-span-2">
            {data ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile icon={TrendingUp} label={t(($) => $.kpi.revenue)} value={fmt.money(data.revenue)} />
                <StatTile icon={Coins} label={t(($) => $.performance.expenses)} value={fmt.money(data.expenses)} />
                <StatTile icon={Coins} label={t(($) => $.kpi.profit)} value={fmt.money(data.profit)} tone={(data.profit ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'} />
              </div>
            ) : (
              <Loading loading={exec.isLoading} error={exec.isError} />
            )}
          </Section>

          {/* Financial KPIs */}
          <Section icon={Scale} title={t(($) => $.kpis.title)} className="lg:col-span-1">
            {data ? (
              <ul className="space-y-2 text-sm">
                <KpiRow label={t(($) => $.kpis.grossMargin)} value={fmt.percent(data.financial_kpis.gross_margin_pct, false)} />
                <KpiRow label={t(($) => $.kpis.operatingMargin)} value={fmt.percent(data.financial_kpis.operating_margin_pct, false)} />
                <KpiRow label={t(($) => $.kpis.netMargin)} value={fmt.percent(data.financial_kpis.net_margin_pct, false)} />
                <KpiRow label={t(($) => $.kpis.currentRatio)} value={data.financial_kpis.current_ratio == null ? '—' : fmt.number(data.financial_kpis.current_ratio, 2)} />
                <KpiRow label={t(($) => $.kpis.receivables)} value={fmt.money(data.financial_kpis.receivables)} />
                <KpiRow label={t(($) => $.kpis.payables)} value={fmt.money(data.financial_kpis.payables)} />
              </ul>
            ) : (
              <Loading loading={exec.isLoading} error={exec.isError} />
            )}
          </Section>

          {/* Financial Alerts */}
          <Section icon={AlertTriangle} title={t(($) => $.alerts.title)} className="lg:col-span-1">
            {data && data.alerts.length > 0 ? (
              <ul className="space-y-2">
                {data.alerts.map((a) => (
                  <li key={a.key} className="flex items-start gap-2 text-sm">
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', a.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500')} />
                    <span>{a.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty loading={exec.isLoading} label={t(($) => $.alerts.empty)} />
            )}
          </Section>

          {/* Executive Insights */}
          <Section icon={Lightbulb} title={t(($) => $.insights.title)} className="lg:col-span-2">
            {cfo.data && cfo.data.executive_recommendations.length > 0 ? (
              <ul className="space-y-3">
                {cfo.data.executive_recommendations.map((r, i) => (
                  <li key={`${r.category}-${i}`} className="flex items-start gap-3 text-sm">
                    <PriorityDot priority={r.priority} />
                    <div>
                      <div className="font-medium capitalize">{r.category.replace(/_/g, ' ')}</div>
                      <div className="text-muted-foreground">{r.recommendation}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty loading={cfo.isLoading} label={t(($) => $.insights.empty)} />
            )}
          </Section>

          {/* Recent Activity */}
          <Section icon={Activity} title={t(($) => $.activity.title)} className="lg:col-span-3">
            {journals.data && journals.data.length > 0 ? (
              <div className="divide-y divide-border">
                {journals.data.slice(0, 8).map((j) => (
                  <div key={j.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{j.number || j.reference || t(($) => $.activity.journal)}</div>
                      <div className="truncate text-muted-foreground">{j.description || '—'}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums">{fmt.money(j.total_debit ?? j.amount)}</span>
                      <span className="text-xs capitalize text-muted-foreground">{j.status || '—'}</span>
                      <span className="text-xs text-muted-foreground">{fmt.date(j.posted_at || j.journal_date || j.date || null)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty loading={journals.isLoading} label={t(($) => $.activity.empty)} />
            )}
          </Section>
        </div>
      </WorkspacePage>
    </>
  );
}

// ── Local presentational pieces ───────────────────────────────────────────────

function Section({ icon: Icon, title, className, children }: { icon: ComponentType<{ className?: string }>; title: string; className?: string; children: ReactNode }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </div>
      <div className={cn('mt-1 text-lg font-semibold tabular-nums', tone)}>{value}</div>
    </div>
  );
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </li>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const tone = priority === 'high' ? 'bg-red-500' : priority === 'medium' ? 'bg-amber-500' : 'bg-sky-500';
  return <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', tone)} aria-hidden />;
}

function PeriodBadge({ from, to, fmt }: { from: string; to: string; fmt: ReturnType<typeof useFormatter> }) {
  return (
    <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
      {fmt.date(from)} — {fmt.date(to)}
    </span>
  );
}

function Loading({ loading, error }: { loading: boolean; error: boolean }) {
  const { t } = useTranslation('finance');
  if (error) {
    return <p className="text-sm text-red-600">{t(($) => $.error)}</p>;
  }
  return <p className="text-sm text-muted-foreground">{loading ? t(($) => $.loading) : t(($) => $.empty)}</p>;
}

function Empty({ loading, label }: { loading: boolean; label: string }) {
  return <p className="text-sm text-muted-foreground">{loading ? '…' : label}</p>;
}

function NoAccess({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

export default FinanceExecutivePage;
