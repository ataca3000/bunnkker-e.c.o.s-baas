import { TrendingDown, TrendingUp } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/utils';
import { ExecutiveUnavailableCard } from '@/features/executive/components/executive-unavailable-card';
import type { ExecutiveDashboardData } from '../services/executive-dashboard.service';
import type { DashboardProfile } from '../registry/widget-definitions';

// ── Types ──────────────────────────────────────────────────────────────────

type MetricStatus = 'ok' | 'warn' | 'alert';

interface Metric {
  id:      string;
  label:   string;
  value:   string;
  trend?:  number | null;
  status?: MetricStatus;
}

// ── Formatting ─────────────────────────────────────────────────────────────

function pct(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1)}%`;
}

// ── Metric builder ─────────────────────────────────────────────────────────

function buildMetrics(data: ExecutiveDashboardData, profile: DashboardProfile, t: TFunction<'dashboard'>, fmtMoney: (n: number) => string): Metric[] {
  const { sales: s, marketing: mk, shipping: sh, operations: op } = data;
  const issues = s.cancelled_today + sh.failed_today;

  const issueM: Metric = {
    id:     'issues',
    label:  t($ => $.hero.criticalIssues),
    value:  String(issues),
    status: issues > 0 ? 'alert' : 'ok',
  };

  switch (profile) {
    case 'executive': return [
      { id: 'rev',     label: t($ => $.hero.revenueToday),    value: fmtMoney(s.revenue_today),                      trend: s.revenue_trend_pct },
      { id: 'orders',  label: t($ => $.hero.ordersToday),     value: s.orders_today.toLocaleString(),            trend: s.orders_trend_pct },
      { id: 'shipped', label: t($ => $.hero.shippedToday),    value: s.orders_shipped_today.toLocaleString() },
      { id: 'roas',    label: t($ => $.hero.roas),            value: mk.roas != null ? `${mk.roas}×` : '—',     status: mk.roas == null ? undefined : mk.roas >= 3 ? 'ok' : mk.roas >= 1 ? 'warn' : 'alert' },
      { id: 'pending', label: t($ => $.hero.pendingOrders),   value: s.pending_count.toLocaleString(),            status: s.pending_count > 50 ? 'warn' : 'ok' },
      issueM,
    ];
    case 'operations': return [
      { id: 'orders',  label: t($ => $.hero.ordersToday),     value: s.orders_today.toLocaleString(),            trend: s.orders_trend_pct },
      { id: 'shipped', label: t($ => $.hero.shippedToday),    value: s.orders_shipped_today.toLocaleString() },
      { id: 'pending', label: t($ => $.hero.pending),         value: s.pending_count.toLocaleString(),            status: s.pending_count > 50 ? 'warn' : 'ok' },
      { id: 'ofd',     label: t($ => $.hero.outForDelivery),  value: s.out_for_delivery.toLocaleString() },
      { id: 'trips',   label: t($ => $.hero.activeTrips),     value: op.active_trips.toLocaleString() },
      issueM,
    ];
    case 'marketing': return [
      { id: 'roas',    label: t($ => $.hero.roas),            value: mk.roas != null ? `${mk.roas}×` : '—',     status: mk.roas == null ? undefined : mk.roas >= 3 ? 'ok' : mk.roas >= 1 ? 'warn' : 'alert' },
      { id: 'spend',   label: t($ => $.hero.spendToday),      value: fmtMoney(mk.spend_today),                        trend: mk.spend_trend_pct },
      { id: 'campr',   label: t($ => $.hero.campaignRevenue), value: fmtMoney(mk.campaign_revenue) },
      { id: 'newc',    label: t($ => $.hero.newCustomers),    value: (mk.new_customers ?? 0).toLocaleString() },
      { id: 'cvr',     label: t($ => $.hero.conversionRate),  value: pct(mk.conversion_rate) },
      { id: 'rev',     label: t($ => $.hero.revenueToday),    value: fmtMoney(s.revenue_today),                       trend: s.revenue_trend_pct },
    ];
    case 'warehouse': return [
      { id: 'orders',  label: t($ => $.hero.ordersToday),     value: s.orders_today.toLocaleString(),            trend: s.orders_trend_pct },
      { id: 'shipped', label: t($ => $.hero.shippedToday),    value: s.orders_shipped_today.toLocaleString() },
      { id: 'pending', label: t($ => $.hero.pending),         value: s.pending_count.toLocaleString(),            status: s.pending_count > 50 ? 'warn' : 'ok' },
      { id: 'trips',   label: t($ => $.hero.activeTrips),     value: op.active_trips.toLocaleString() },
      { id: 'cod',     label: t($ => $.hero.pendingCOD),      value: fmtMoney(sh.cod_pending),                        status: sh.cod_pending > 10_000 ? 'warn' : 'ok' },
      issueM,
    ];
    case 'finance': return [
      { id: 'rev',     label: t($ => $.hero.revenueToday),      value: fmtMoney(s.revenue_today),                       trend: s.revenue_trend_pct },
      { id: 'month',   label: t($ => $.hero.revenueThisMonth),  value: fmtMoney(s.revenue_this_month) },
      { id: 'gp',      label: t($ => $.hero.grossProfitToday),  value: s.gross_profit_today > 0 ? fmtMoney(s.gross_profit_today) : 'N/A' },
      { id: 'roas',    label: t($ => $.hero.roas),              value: mk.roas != null ? `${mk.roas}×` : '—',     status: mk.roas == null ? undefined : mk.roas >= 3 ? 'ok' : mk.roas >= 1 ? 'warn' : 'alert' },
      { id: 'cod',     label: t($ => $.hero.pendingCOD),        value: fmtMoney(sh.cod_pending),                        status: sh.cod_pending > 10_000 ? 'warn' : 'ok' },
      issueM,
    ];
    case 'manufacturing': return [
      { id: 'orders',  label: t($ => $.hero.ordersToday),     value: s.orders_today.toLocaleString(),            trend: s.orders_trend_pct },
      { id: 'shipped', label: t($ => $.hero.shippedToday),    value: s.orders_shipped_today.toLocaleString() },
      { id: 'waves',   label: t($ => $.hero.activeWaves),     value: op.active_waves.toLocaleString() },
      { id: 'pending', label: t($ => $.hero.pendingOrders),   value: s.pending_count.toLocaleString(),            status: s.pending_count > 50 ? 'warn' : 'ok' },
      { id: 'rev',     label: t($ => $.hero.revenueToday),    value: fmtMoney(s.revenue_today),                       trend: s.revenue_trend_pct },
      issueM,
    ];
    case 'crm': return [
      { id: 'orders',  label: t($ => $.hero.ordersToday),     value: s.orders_today.toLocaleString(),            trend: s.orders_trend_pct },
      { id: 'newc',    label: t($ => $.hero.newCustomers),    value: (mk.new_customers ?? 0).toLocaleString() },
      { id: 'retc',    label: t($ => $.hero.returning),       value: (mk.returning_customers ?? 0).toLocaleString() },
      { id: 'rev',     label: t($ => $.hero.revenueToday),    value: fmtMoney(s.revenue_today),                       trend: s.revenue_trend_pct },
      { id: 'cvr',     label: t($ => $.hero.conversionRate),  value: pct(mk.conversion_rate) },
      issueM,
    ];
    default: return [];
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

const STATUS_DOT: Record<MetricStatus, string> = {
  ok:    'bg-emerald-500',
  warn:  'bg-amber-400',
  alert: 'bg-rose-500 animate-pulse',
};

const STATUS_VALUE: Record<MetricStatus, string> = {
  ok:    '',
  warn:  'text-amber-600 dark:text-amber-400',
  alert: 'text-rose-600 dark:text-rose-400',
};

function TrendTag({ trend }: { trend: number | null | undefined }) {
  const { t } = useTranslation('dashboard');
  if (trend === null || trend === undefined) return null;
  const up  = trend > 0;
  const abs = Math.abs(trend).toFixed(1);
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      'mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums',
      up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500',
    )}>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {abs}{t($ => $.hero.vsYesterday)}
    </span>
  );
}

function MetricCell({ m }: { m: Metric }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-5 lg:px-6">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {m.label}
      </p>
      <div className="flex items-center gap-2">
        <p className={cn(
          'text-2xl font-black tabular-nums tracking-tight lg:text-3xl',
          m.status ? STATUS_VALUE[m.status] : '',
        )}>
          {m.value}
        </p>
        {m.status && (
          <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[m.status])} />
        )}
      </div>
      <TrendTag trend={m.trend} />
    </div>
  );
}

function SkeletonCell() {
  return (
    <div className="animate-pulse px-5 py-5 lg:px-6">
      <div className="mb-2.5 h-2.5 w-20 rounded bg-muted" />
      <div className="mb-2 h-8 w-28 rounded bg-muted" />
      <div className="h-2.5 w-14 rounded bg-muted" />
    </div>
  );
}

// ── Strip ──────────────────────────────────────────────────────────────────

interface Props {
  data:    ExecutiveDashboardData | undefined;
  loading: boolean;
  profile: DashboardProfile;
  /** TASK-GL-HOTFIX-001: without this the strip skeletons forever on failure. */
  error?:   boolean;
  onRetry?: () => void;
}

export function DashboardHeroStrip({ data, loading, profile, error, onRetry }: Props) {
  const { t } = useTranslation('dashboard');
  const { moneyCompact } = useFormatter();
  const metrics = data ? buildMetrics(data, profile, t, moneyCompact) : null;

  // A failed fetch leaves `loading` false and `data` undefined. Falling through
  // to the skeleton branch in that state is what made this strip pulse
  // indefinitely instead of ever telling the user the request had failed.
  if (error && !metrics) {
    return (
      <div className="-mx-4 border-y bg-card/60 px-4 py-4 sm:-mx-6 sm:px-6">
        <ExecutiveUnavailableCard
          message={t($ => $.errors.unavailable)}
          retryLabel={t($ => $.errors.retry)}
          onRetry={onRetry}
        />
      </div>
    );
  }

  const cells = loading || !metrics ? Array.from({ length: 6 }) : metrics;

  return (
    <div className="-mx-4 border-y bg-card/60 sm:-mx-6">
      <div className="grid grid-cols-3 divide-x sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((m, i) =>
          loading || !metrics
            ? <SkeletonCell key={i} />
            : <MetricCell key={(m as Metric).id} m={m as Metric} />
        )}
      </div>
    </div>
  );
}
