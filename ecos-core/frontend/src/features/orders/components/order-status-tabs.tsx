import { useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { OrderStatus } from '@/features/orders/types/order';
import { STATUS_TAB_ORDER } from '@/features/orders/types/order';
import type { OrderStatusKpis } from '@/features/orders/hooks/use-orders';
import { useOrderStatusLabels } from '@/features/orders/hooks/use-order-labels';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

type StatusTab = OrderStatus | 'all';

// ── Status accent colours (background tint for active card) ──────────────────

const STATUS_ACCENT: Partial<Record<string, string>> = {
  all:              'border-primary/60 bg-primary/5',
  scheduled:        'border-indigo-400/60 bg-indigo-50 dark:border-indigo-600/40 dark:bg-indigo-950/20',
  pending:          'border-yellow-400/60 bg-yellow-50 dark:border-yellow-600/40 dark:bg-yellow-950/20',
  awaiting_payment: 'border-amber-400/60 bg-amber-50 dark:border-amber-600/40 dark:bg-amber-950/20',
  processing:       'border-blue-400/60 bg-blue-50 dark:border-blue-600/40 dark:bg-blue-950/20',
  confirmed:        'border-violet-400/60 bg-violet-50 dark:border-violet-600/40 dark:bg-violet-950/20',
  preparing:        'border-teal-400/60 bg-teal-50 dark:border-teal-600/40 dark:bg-teal-950/20',
  out_for_delivery: 'border-cyan-400/60 bg-cyan-50 dark:border-cyan-600/40 dark:bg-cyan-950/20',
  delivered:        'border-green-400/60 bg-green-50 dark:border-green-600/40 dark:bg-green-950/20',
  completed:        'border-emerald-500/60 bg-emerald-50 dark:border-emerald-600/40 dark:bg-emerald-950/20',
  cancelled:        'border-rose-400/60 bg-rose-50 dark:border-rose-600/40 dark:bg-rose-950/20',
  returned:         'border-orange-400/60 bg-orange-50 dark:border-orange-600/40 dark:bg-orange-950/20',
  awaiting_stock:   'border-orange-300/60 bg-orange-50 dark:border-orange-600/40 dark:bg-orange-950/20',
  rescheduled:      'border-sky-400/60 bg-sky-50 dark:border-sky-600/40 dark:bg-sky-950/20',
  review:           'border-red-400/60 bg-red-50 dark:border-red-600/40 dark:bg-red-950/20',
};

const STATUS_DOT: Partial<Record<string, string>> = {
  all:              'bg-primary',
  scheduled:        'bg-indigo-400 dark:bg-indigo-500',
  pending:          'bg-yellow-400 dark:bg-yellow-500',
  awaiting_payment: 'bg-amber-400 dark:bg-amber-500',
  processing:       'bg-blue-400 dark:bg-blue-500',
  confirmed:        'bg-violet-400 dark:bg-violet-500',
  preparing:        'bg-teal-400 dark:bg-teal-500',
  out_for_delivery: 'bg-cyan-400 dark:bg-cyan-500',
  delivered:        'bg-green-400 dark:bg-green-500',
  completed:        'bg-emerald-500 dark:bg-emerald-500',
  cancelled:        'bg-rose-400 dark:bg-rose-500',
  returned:         'bg-orange-400 dark:bg-orange-500',
  awaiting_stock:   'bg-orange-300 dark:bg-orange-500',
  rescheduled:      'bg-sky-400 dark:bg-sky-500',
  review:           'bg-red-400 dark:bg-red-500',
};

const STATUS_COUNT_COLOR: Partial<Record<string, string>> = {
  all:              'text-primary',
  scheduled:        'text-indigo-700 dark:text-indigo-400',
  pending:          'text-yellow-700 dark:text-yellow-400',
  awaiting_payment: 'text-amber-700 dark:text-amber-400',
  processing:       'text-blue-700 dark:text-blue-400',
  confirmed:        'text-violet-700 dark:text-violet-400',
  preparing:        'text-teal-700 dark:text-teal-400',
  out_for_delivery: 'text-cyan-700 dark:text-cyan-400',
  delivered:        'text-green-700 dark:text-green-400',
  completed:        'text-emerald-700 dark:text-emerald-400',
  cancelled:        'text-rose-700 dark:text-rose-400',
  returned:         'text-orange-700 dark:text-orange-400',
  awaiting_stock:   'text-orange-600 dark:text-orange-400',
  rescheduled:      'text-sky-700 dark:text-sky-400',
  review:           'text-red-700 dark:text-red-400',
};

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtAmount(n: number): string {
  return formatMoney(n);
}

// ── Props ─────────────────────────────────────────────────────────────────────

type OrderStatusTabsProps = {
  activeStatus: StatusTab;
  counts: OrderStatusKpis;
  onChange: (status: StatusTab) => void;
};

/**
 * PART 1 — Enterprise KPI Cards with horizontal scrolling.
 * Each card: Status Name / Order Count / Total Order Value / ▲ trend placeholder.
 * Navigation: Left/Right arrows, mouse-wheel, touch swipe.
 * Active tab auto-scrolls into view on status change.
 */
export function OrderStatusTabs({ activeStatus, counts, onChange }: OrderStatusTabsProps) {
  const { t } = useTranslation('orders');
  const { statusTabLabel } = useOrderStatusLabels();
  const scrollRef  = useRef<HTMLDivElement>(null);
  const activeRef  = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view whenever the active status changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeStatus]);

  // Convert vertical wheel to horizontal scroll (Shift+wheel already works natively)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    if (e.shiftKey) return; // let native Shift+wheel handle it
    e.preventDefault();
    scrollRef.current.scrollLeft += e.deltaY + e.deltaX;
  }, []);

  const scrollBy = useCallback((direction: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: direction === 'left' ? -256 : 256, behavior: 'smooth' });
  }, []);

  return (
    <div className="relative flex items-stretch border-b bg-background">
      {/* ← Left arrow */}
      <button
        type="button"
        onClick={() => scrollBy('left')}
        aria-label={t($ => $.statusTabs.scrollLeft)}
        className="shrink-0 flex items-center justify-center px-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors z-10 border-r"
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Scrollable KPI card strip */}
      <div
        ref={scrollRef}
        role="tablist"
        aria-label={t($ => $.statusTabs.label)}
        onWheel={handleWheel}
        className="flex flex-1 gap-2 overflow-x-auto scrollbar-none py-3 px-3"
      >
        {STATUS_TAB_ORDER.map((tab) => {
          const isActive = tab === activeStatus;
          const kpi = counts[tab as StatusTab] ?? { count: 0, totalAmount: 0 };
          const accent = STATUS_ACCENT[tab as StatusTab] ?? 'border-border';
          const countColor = STATUS_COUNT_COLOR[tab as StatusTab] ?? 'text-foreground';

          return (
            <button
              key={tab}
              ref={isActive ? activeRef : undefined}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onChange(tab as StatusTab)}
              className={cn(
                'flex shrink-0 flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-start',
                'min-w-[120px] transition-all outline-none select-none',
                'hover:border-primary/40 hover:bg-accent/60',
                isActive
                  ? cn('shadow-sm', accent)
                  : 'border-border bg-card',
              )}
            >
              {/* Status Icon + Name */}
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'inline-block size-2 shrink-0 rounded-full',
                  STATUS_DOT[tab as StatusTab] ?? 'bg-muted-foreground',
                )} />
                <span className={cn(
                  'text-[11px] font-semibold uppercase tracking-wide leading-none',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {statusTabLabel[tab as StatusTab]}
                </span>
              </div>

              {/* Order Count */}
              <span className={cn(
                'text-xl font-bold tabular-nums leading-none',
                isActive ? countColor : 'text-foreground/80',
              )}>
                {fmtCount(kpi.count)}
              </span>

              {/* Total Value */}
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground leading-none">
                {fmtAmount(kpi.totalAmount)}
              </span>
            </button>
          );
        })}
      </div>

      {/* → Right arrow */}
      <button
        type="button"
        onClick={() => scrollBy('right')}
        aria-label={t($ => $.statusTabs.scrollRight)}
        className="shrink-0 flex items-center justify-center px-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors z-10 border-l"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
