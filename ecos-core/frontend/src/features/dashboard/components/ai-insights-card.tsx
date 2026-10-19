import { Sparkles } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ExecutiveDashboardData } from '@/features/dashboard/services/executive-dashboard.service';
import type enDashboard from '@/i18n/locales/en/dashboard.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type DashboardLabel = ($: typeof enDashboard) => string;

interface Props {
  data?: ExecutiveDashboardData;
}

interface Insight {
  type:    'alert' | 'tip' | 'info';


  message: string;
}

function deriveInsights(data: ExecutiveDashboardData, t: TFunction<'dashboard'>, money: (n: number | null | undefined) => string): Insight[] {
  const insights: Insight[] = [];
  const s = data.sales;
  const sh = data.shipping;
  const mk = data.marketing;

  // Revenue trend alert
  if (s.revenue_trend_pct !== null && s.revenue_trend_pct < -20) {
    insights.push({ type: 'alert', message: t($ => $.aiInsights.revenueDown, { pct: Math.abs(s.revenue_trend_pct).toFixed(1) }) });
  } else if (s.revenue_trend_pct !== null && s.revenue_trend_pct > 20) {
    insights.push({ type: 'info', message: t($ => $.aiInsights.revenueUp, { pct: s.revenue_trend_pct.toFixed(1) }) });
  }

  // High cancellations
  if (s.orders_today > 0 && s.cancelled_today / s.orders_today > 0.1) {
    insights.push({ type: 'alert', message: t($ => $.aiInsights.cancellations, { count: s.cancelled_today, rate: ((s.cancelled_today / s.orders_today) * 100).toFixed(0) }) });
  }

  // Shipping failures
  if (sh.failed_today > 0) {
    const failRate = sh.shipments_today > 0 ? (sh.failed_today / sh.shipments_today) * 100 : 100;
    insights.push({ type: failRate > 15 ? 'alert' : 'tip', message: t($ => $.aiInsights.failedDeliveries, { count: sh.failed_today, rate: failRate.toFixed(0) }) });
  }

  // High ROAS signal
  if (mk.roas !== null && mk.roas > 4) {
    insights.push({ type: 'tip', message: t($ => $.aiInsights.roasHigh, { roas: mk.roas }) });
  } else if (mk.roas !== null && mk.roas < 1 && mk.spend_this_month > 0) {
    insights.push({ type: 'alert', message: t($ => $.aiInsights.roasLow) });
  }

  // COD pending
  if (sh.cod_pending > 10_000) {
    insights.push({ type: 'tip', message: t($ => $.aiInsights.codPending, { amount: money(sh.cod_pending) }) });
  }

  // Pending orders accumulating
  if (s.pending_count > 50) {
    insights.push({ type: 'tip', message: t($ => $.aiInsights.pendingQueue, { count: s.pending_count }) });
  }

  // No data fallback
  if (insights.length === 0) {
    if (s.orders_today === 0) {
      insights.push({ type: 'info', message: t($ => $.aiInsights.noOrdersYet) });
    } else {
      insights.push({ type: 'info', message: t($ => $.aiInsights.ordersOnTrack, { count: s.orders_today, revenue: money(s.revenue_today) }) });
    }
  }

  return insights.slice(0, 4);
}

const BADGE: Record<Insight['type'], { labelKey: DashboardLabel; cls: string }> = {
  alert: { labelKey: ($) => $.aiInsights.badgeAlert, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  tip:   { labelKey: ($) => $.aiInsights.badgeTip, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  info:  { labelKey: ($) => $.aiInsights.badgeInfo, cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
};

export function AiInsightsCard({ data }: Props) {
  const { t } = useTranslation('dashboard');
  const { money } = useFormatter();
  const insights = data ? deriveInsights(data, t, money) : null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-violet-500" />
          {t($ => $.aiInsights.title)}
          <Badge variant="outline" className="ml-auto text-[10px] text-violet-600 dark:text-violet-400 border-violet-500/30">
            {t($ => $.aiInsights.ruleBased)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {!data ? (
          <div className="animate-pulse space-y-2.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-muted/40 p-3">
                <div className="h-4 w-12 shrink-0 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          insights!.map((insight, i) => {
            const b = BADGE[insight.type];
            return (
              <div key={i} className="flex items-start gap-2.5 rounded-lg bg-muted/30 p-2.5 text-xs leading-relaxed">
                <span className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${b.cls}`}>
                  {t(b.labelKey)}
                </span>
                <span className="text-foreground/80">{insight.message}</span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
