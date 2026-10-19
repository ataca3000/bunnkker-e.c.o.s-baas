import { ShoppingCart, CheckCircle, XCircle, TrendingUp, Calendar, ExternalLink, BadgeCheck, RotateCcw, BarChart2, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CustomerLookupStats } from '@/features/orders/types/order';
import { ROUTES } from '@/router/routes';

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

type Props = {
  stats: CustomerLookupStats;
  customerName: string;
  customerId?: string;
};

export function OrderCustomerIntelligencePanel({ stats, customerName, customerId }: Props) {
  const { t } = useTranslation('orders');

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
      <CardContent className="pt-3 pb-3">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm font-semibold">{customerName}</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              <BadgeCheck className="size-2.5" />
              {t($ => $.customerBadge.existingCustomer)}
            </span>
          </div>
          {customerId && (
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-muted-foreground"
                asChild
              >
                <a href={`${ROUTES.customers ?? '/app/customers'}/${customerId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-2.5 mr-1" />
                  {t($ => $.customerBadge.open)}
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Stats grid — row 1: order counts */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          <IntelStat
            icon={<ShoppingCart className="size-3.5 text-blue-500" />}
            label={t($ => $.customerBadge.totalOrders)}
            value={String(stats.total_orders)}
          />
          <IntelStat
            icon={<CheckCircle className="size-3.5 text-emerald-500" />}
            label={t($ => $.customerBadge.delivered)}
            value={String(stats.delivered)}
          />
          <IntelStat
            icon={<XCircle className="size-3.5 text-red-500" />}
            label={t($ => $.customerBadge.cancelledOrders)}
            value={String(stats.cancelled)}
          />
          <IntelStat
            icon={<RotateCcw className="size-3.5 text-orange-500" />}
            label={t($ => $.customerBadge.returned)}
            value={String(stats.returned ?? 0)}
          />
          <IntelStat
            icon={<BarChart2 className="size-3.5 text-violet-500" />}
            label={t($ => $.customerBadge.successRate)}
            value={`${stats.success_rate}%`}
            highlight={stats.success_rate >= 80 ? 'good' : stats.success_rate < 50 ? 'bad' : 'neutral'}
          />
          <IntelStat
            icon={<TrendingUp className="size-3.5 text-amber-500" />}
            label={t($ => $.customerBadge.lifetimeValue)}
            value={fmt(stats.lifetime_value)}
          />
        </div>

        {/* Row 2: financial + dates */}
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-3">
          <IntelStat
            icon={<DollarSign className="size-3.5 text-teal-500" />}
            label={t($ => $.customerBadge.avgOrder)}
            value={fmt(stats.avg_order_value ?? 0)}
          />
          <IntelStat
            icon={<Calendar className="size-3.5 text-slate-400" />}
            label={t($ => $.customerBadge.customerSince)}
            value={fmtDate(stats.first_order_date)}
          />
          <IntelStat
            icon={<Calendar className="size-3.5 text-slate-500" />}
            label={t($ => $.customerBadge.lastOrder)}
            value={fmtDate(stats.last_order_date)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function IntelStat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: 'good' | 'bad' | 'neutral';
}) {
  const valueClass =
    highlight === 'good'
      ? 'text-emerald-700 dark:text-emerald-400'
      : highlight === 'bad'
        ? 'text-red-700 dark:text-red-400'
        : 'text-foreground';

  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-background/60 px-2.5 py-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <span className={`text-sm font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
