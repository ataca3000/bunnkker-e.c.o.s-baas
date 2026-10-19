import { Sparkles, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/utils';
import { ExecutiveUnavailableCard } from '@/features/executive/components/executive-unavailable-card';
import type { ExecutiveDashboardData } from '../services/executive-dashboard.service';

type DashboardT = TFunction<'dashboard'>;

// ── Types ──────────────────────────────────────────────────────────────────

type InsightLevel = 'alert' | 'positive' | 'info' | 'tip';

interface Insight {
  level:   InsightLevel;
  message: string;
}

// ── Insight derivation ─────────────────────────────────────────────────────

function deriveInsights(data: ExecutiveDashboardData, t: DashboardT, money: (n: number | null | undefined) => string): Insight[] {
  const out: Insight[] = [];
  const { sales: s, shipping: sh, marketing: mk } = data;

  if (s.revenue_trend_pct !== null && s.revenue_trend_pct > 20)
    out.push({ level: 'positive', message: t($ => $.brief.revenueUp, { pct: s.revenue_trend_pct.toFixed(1) }) });
  else if (s.revenue_trend_pct !== null && s.revenue_trend_pct < -20)
    out.push({ level: 'alert',    message: t($ => $.brief.revenueDown, { pct: Math.abs(s.revenue_trend_pct).toFixed(1) }) });

  if (s.cancelled_today > 0 && s.orders_today > 0) {
    const rate = ((s.cancelled_today / s.orders_today) * 100).toFixed(0);
    out.push({ level: s.cancelled_today / s.orders_today > 0.1 ? 'alert' : 'info',
      message: t($ => $.brief.cancelledOrders, { count: s.cancelled_today, rate }) });
  }

  if (mk.roas !== null && mk.roas > 4)
    out.push({ level: 'positive', message: t($ => $.brief.roasHigh, { roas: mk.roas }) });
  else if (mk.roas !== null && mk.roas < 1 && mk.spend_this_month > 0)
    out.push({ level: 'alert',    message: t($ => $.brief.roasLow) });

  if (sh.failed_today > 0) {
    const rate = sh.shipments_today > 0 ? ((sh.failed_today / sh.shipments_today) * 100).toFixed(0) : '100';
    out.push({ level: sh.failed_today >= 3 ? 'alert' : 'tip',
      message: sh.failed_today === 1
        ? t($ => $.brief.failedDelivery, { count: sh.failed_today, rate })
        : t($ => $.brief.failedDeliveries, { count: sh.failed_today, rate }) });
  }

  if (sh.cod_pending > 10_000)
    out.push({ level: 'tip', message: t($ => $.brief.codPending, { amount: money(sh.cod_pending) }) });

  if (s.pending_count > 50)
    out.push({ level: 'tip', message: t($ => $.brief.pendingQueue, { count: s.pending_count }) });

  if (out.length === 0) {
    out.push(s.orders_today === 0
      ? { level: 'info', message: t($ => $.brief.noOrdersYet) }
      : { level: 'info', message: t($ => $.brief.allOnTrack, { count: s.orders_today, revenue: money(s.revenue_today) }) });
  }

  return out.slice(0, 5);
}

// ── Visual config ──────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<InsightLevel, {
  icon:   React.ComponentType<{ className?: string }>;
  dot:    string;
  text:   string;
}> = {
  alert:    { icon: TrendingDown, dot: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-400' },
  positive: { icon: TrendingUp,   dot: 'bg-emerald-500', text: 'text-foreground/90' },
  tip:      { icon: Minus,        dot: 'bg-amber-400',   text: 'text-foreground/80' },
  info:     { icon: Minus,        dot: 'bg-indigo-400',  text: 'text-foreground/70' },
};

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  data?:    ExecutiveDashboardData;
  loading?: boolean;
  error?:   boolean;
  onRetry?: () => void;
}

export function DashboardAiBrief({ data, loading, error, onRetry }: Props) {
  const { t } = useTranslation('dashboard');
  const { money } = useFormatter();
  const insights = data ? deriveInsights(data, t, money) : null;
  const alertCount = insights?.filter(i => i.level === 'alert').length ?? 0;

  return (
    <div className="flex gap-4">
      {/* Left accent bar */}
      <div className="w-0.5 shrink-0 self-stretch rounded-full bg-violet-500/40" />

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-400">
            {t($ => $.brief.header)}
          </span>
          {alertCount > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
              {alertCount} {alertCount === 1 ? t($ => $.brief.alert) : t($ => $.brief.alerts)}
            </span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground/50">{t($ => $.brief.caption)}</span>
        </div>

        {/* Insights */}
        {error && !insights ? (
          // TASK-GL-HOTFIX-001: a failed fetch used to land in the skeleton
          // branch below and animate forever.
          <ExecutiveUnavailableCard
            message={t($ => $.errors.unavailable)}
            retryLabel={t($ => $.errors.retry)}
            onRetry={onRetry}
          />
        ) : loading || !insights ? (
          <div className="animate-pulse space-y-2.5">
            {[160, 200, 140, 180].map((w, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted" />
                <div className="h-3.5 rounded bg-muted" style={{ width: w }} />
              </div>
            ))}
          </div>
        ) : (
          <ol className="space-y-2">
            {insights.map((ins, i) => {
              const cfg  = LEVEL_CONFIG[ins.level];
              const Icon = cfg.icon;
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', cfg.dot)} />
                  <span className={cn('text-sm leading-relaxed', cfg.text)}>
                    {ins.message}
                  </span>
                  {ins.level === 'alert' && (
                    <Icon className="mt-1 h-3.5 w-3.5 shrink-0 text-rose-400" />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
