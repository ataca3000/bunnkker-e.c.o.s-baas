'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Clock, Minus } from 'lucide-react';
import { buildTodayVsYesterdaySummary } from '@/lib/executiveAnalytics';
import type { Order } from '@/lib/types';

interface DailyPerformanceCardProps {
  orders: Order[];
  formatCurrency: (val: number) => string;
}

type ComparisonMode = 'sameHourPace' | 'fullDay';

export default function DailyPerformanceCard({
  orders,
  formatCurrency,
}: DailyPerformanceCardProps) {
  const [mode, setMode] = useState<ComparisonMode>('sameHourPace');

  const summary = useMemo(() => buildTodayVsYesterdaySummary(orders, new Date()), [orders]);
  const active = mode === 'sameHourPace' ? summary.sameHourPace : summary.fullDay;

  const salesDeltaPositive = active.sales.delta > 0;
  const salesDeltaNegative = active.sales.delta < 0;
  const GrowthIcon =
    active.sales.growth.direction === 'up'
      ? ArrowUpRight
      : active.sales.growth.direction === 'down'
        ? ArrowDownRight
        : Minus;

  const growthColor =
    active.sales.growth.direction === 'up'
      ? 'text-emerald-400'
      : active.sales.growth.direction === 'down'
        ? 'text-rose-400'
        : 'text-slate-400';

  const maxBucketValue = useMemo(() => {
    const peak = Math.max(
      1,
      ...summary.intradayBuckets.flatMap((b) => [b.todaySales, b.yesterdaySales])
    );
    return peak;
  }, [summary.intradayBuckets]);

  const progressWidth = Math.min(100, Math.max(0, active.benchmarkPercent));

  return (
    <section
      aria-label="Tarjeta de Rendimiento Hoy vs Ayer"
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-5"
    >
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock size={13} className="text-sky-400" aria-hidden="true" />
            <span>
              Tarjeta de Rendimiento · {summary.todayLabel} vs {summary.yesterdayLabel}
            </span>
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-50">
            Ritmo de Ventas de Hoy contra Ayer
          </h2>
        </div>

        <div
          role="group"
          aria-label="Modo de comparación diaria"
          className="inline-flex self-start rounded-lg border border-slate-800 bg-slate-950 p-1 sm:self-auto"
        >
          <button
            type="button"
            onClick={() => setMode('sameHourPace')}
            aria-pressed={mode === 'sameHourPace'}
            className={`min-h-[32px] cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === 'sameHourPace'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Misma hora ({summary.cutoffTimeLabel})
          </button>
          <button
            type="button"
            onClick={() => setMode('fullDay')}
            aria-pressed={mode === 'fullDay'}
            className={`min-h-[32px] cursor-pointer whitespace-nowrap shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === 'fullDay'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Cierre completo ayer
          </button>
        </div>
      </div>

      {/* Main Comparison + 4 Metric Columns separated cleanly by hairlines */}
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-3xl font-bold tracking-tight text-slate-50 tabular-nums">
              {formatCurrency(active.sales.today)}
            </span>
            <span className={`inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums ${growthColor}`}>
              <GrowthIcon size={15} aria-hidden="true" />
              {active.sales.growth.display}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-slate-400">
            Ayer ({mode === 'sameHourPace' ? `hasta las ${summary.cutoffTimeLabel}` : 'cierre total'}):{' '}
            <span className="font-mono font-semibold text-slate-200 tabular-nums">
              {formatCurrency(active.sales.yesterday)}
            </span>{' '}
            · Diferencia:{' '}
            <span
              className={`font-mono font-semibold tabular-nums ${
                salesDeltaPositive
                  ? 'text-emerald-400'
                  : salesDeltaNegative
                    ? 'text-rose-400'
                    : 'text-slate-300'
              }`}
            >
              {salesDeltaPositive ? '+' : ''}
              {formatCurrency(active.sales.delta)}
            </span>
          </p>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Avance respecto a ayer</span>
              <span className="font-mono font-semibold text-slate-200 tabular-nums">
                {active.benchmarkPercent}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  active.benchmarkPercent >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
                style={{ width: `${progressWidth}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-800 border-t border-slate-800 pt-4 lg:col-span-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          <div className="pr-3">
            <p className="text-[11px] font-medium text-slate-400">Órdenes</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-100 tabular-nums">
              {active.orders.today}
            </p>
            <p className="font-mono text-[11px] text-slate-400 tabular-nums">
              Ayer: {active.orders.yesterday}
            </p>
          </div>
          <div className="px-3">
            <p className="text-[11px] font-medium text-slate-400">Ticket Prom.</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-100 tabular-nums">
              {formatCurrency(active.avgTicket.today)}
            </p>
            <p className="font-mono text-[11px] text-slate-400 tabular-nums">
              Ayer: {formatCurrency(active.avgTicket.yesterday)}
            </p>
          </div>
          <div className="pl-3">
            <p className="text-[11px] font-medium text-slate-400">Utilidad Est.</p>
            <p className="mt-1 font-mono text-lg font-bold text-emerald-400 tabular-nums">
              {formatCurrency(active.profit.today)}
            </p>
            <p className="font-mono text-[11px] text-slate-400 tabular-nums">
              Ayer: {formatCurrency(active.profit.yesterday)}
            </p>
          </div>
        </div>

        {/* 6-Block Intraday Cadence Strip */}
        <div className="border-t border-slate-800 pt-4 lg:col-span-3 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Bloques del día (4h)</span>
            <span className="font-mono text-[10px]">
              <span className="text-sky-400">Hoy</span> · <span className="text-slate-500">Ayer</span>
            </span>
          </div>
          <div className="grid grid-cols-6 items-end gap-1.5 h-16">
            {summary.intradayBuckets.map((bucket) => {
              const todayH = Math.max(4, Math.round((bucket.todaySales / maxBucketValue) * 48));
              const yestH = Math.max(4, Math.round((bucket.yesterdaySales / maxBucketValue) * 48));
              return (
                <div
                  key={bucket.label}
                  title={`${bucket.rangeHint}: Hoy ${formatCurrency(bucket.todaySales)} · Ayer ${formatCurrency(bucket.yesterdaySales)}`}
                  className="flex flex-col items-center justify-end gap-1"
                >
                  <div className="flex items-end gap-0.5 h-12">
                    <div
                      className="w-2 rounded-t bg-slate-700"
                      style={{ height: `${bucket.yesterdaySales > 0 ? yestH : 3}px` }}
                    />
                    <div
                      className="w-2 rounded-t bg-sky-400"
                      style={{ height: `${bucket.todaySales > 0 ? todayH : 3}px` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                    {bucket.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
