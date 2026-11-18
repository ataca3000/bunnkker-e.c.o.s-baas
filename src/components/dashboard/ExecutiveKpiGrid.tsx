'use client';

import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Minus,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import type { ExecutiveKpiItem } from '@/lib/executiveAnalytics';

interface ExecutiveKpiGridProps {
  kpis: ExecutiveKpiItem[];
  selectedMetric?: ExecutiveKpiItem['id'];
  onSelectMetric?: (id: ExecutiveKpiItem['id']) => void;
  loading?: boolean;
}

const KPI_ICONS: Record<ExecutiveKpiItem['id'], React.ReactNode> = {
  revenue: <DollarSign size={16} aria-hidden="true" />,
  orders: <ReceiptText size={16} aria-hidden="true" />,
  avgTicket: <ShoppingBag size={16} aria-hidden="true" />,
  profit: <TrendingUp size={16} aria-hidden="true" />,
};

export default function ExecutiveKpiGrid({
  kpis,
  selectedMetric,
  onSelectMetric,
  loading = false,
}: ExecutiveKpiGridProps) {
  if (loading) {
    return (
      <section aria-label="Indicadores clave de ventas" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="h-[138px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70 p-5"
          />
        ))}
      </section>
    );
  }

  return (
    <section
      aria-label="Indicadores clave de ventas con crecimiento porcentual"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {kpis.map((kpi, idx) => {
        const isSelected = selectedMetric === kpi.id;
        const isUp = kpi.growth.direction === 'up';
        const isDown = kpi.growth.direction === 'down';

        const trendColorClass = isUp
          ? 'text-emerald-400'
          : isDown
            ? 'text-rose-400'
            : 'text-slate-400';

        const trendPrefixText = isUp
          ? kpi.growth.hasBaseline
            ? 'Creció'
            : 'Sin base previa'
          : isDown
            ? 'Cayó'
            : 'Sin cambio';

        const TrendIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;

        return (
          <motion.article
            key={kpi.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: idx * 0.03 }}
            className={`rounded-xl border transition-colors ${
              isSelected
                ? 'border-sky-400/70 bg-slate-900/95'
                : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectMetric?.(kpi.id)}
              aria-pressed={isSelected}
              className="flex h-full w-full cursor-pointer flex-col justify-between p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-xl"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
                <span className={isSelected ? 'text-sky-400' : 'text-slate-500'}>
                  {KPI_ICONS[kpi.id]}
                </span>
              </div>

              <div className="my-3">
                <p className="font-mono text-2xl font-bold tracking-tight text-slate-50 tabular-nums sm:text-[26px]">
                  {kpi.formattedValue}
                </p>
              </div>

              <div className="flex w-full items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs">
                <span className={`inline-flex items-center gap-1 font-mono font-semibold tabular-nums ${trendColorClass}`}>
                  <TrendIcon size={14} aria-hidden="true" />
                  <span>{kpi.growth.display}</span>
                  <span className="font-sans font-normal text-slate-400">
                    · {trendPrefixText === 'Sin base previa' ? kpi.comparisonLabel : `${kpi.comparisonLabel}`}
                  </span>
                </span>
                <span className="truncate font-mono text-[11px] text-slate-500 tabular-nums">
                  {kpi.detailText}
                </span>
              </div>
            </button>
          </motion.article>
        );
      })}
    </section>
  );
}
