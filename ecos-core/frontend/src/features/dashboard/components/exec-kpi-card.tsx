import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

export type KpiColor =
  | 'indigo' | 'emerald' | 'amber' | 'violet'
  | 'cyan'   | 'rose'    | 'blue'  | 'orange';

interface Props {
  label:       string;
  value:       string | number;
  subValue?:   string;          // e.g. "vs yesterday EGP 0"
  icon:        LucideIcon;
  color?:      KpiColor;
  trendPct?:   number | null;   // positive = up, negative = down, null = no data
  trendLabel?: string;          // e.g. "vs yesterday" — falls back to translated string
  loading?:    boolean;
  compact?:    boolean;         // smaller variant for dense rows
  hero?:       boolean;         // larger hero variant for executive section
}

// ── Color maps ─────────────────────────────────────────────────────────────

const COLOR: Record<KpiColor, { bar: string; icon: string; badge: string }> = {
  indigo:  { bar: 'bg-indigo-500',  icon: 'text-indigo-500',  badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  emerald: { bar: 'bg-emerald-500', icon: 'text-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  amber:   { bar: 'bg-amber-500',   icon: 'text-amber-500',   badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  violet:  { bar: 'bg-violet-500',  icon: 'text-violet-500',  badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  cyan:    { bar: 'bg-cyan-500',    icon: 'text-cyan-500',    badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  rose:    { bar: 'bg-rose-500',    icon: 'text-rose-500',    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  blue:    { bar: 'bg-blue-500',    icon: 'text-blue-500',    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  orange:  { bar: 'bg-orange-500',  icon: 'text-orange-500',  badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
};

// ── Trend badge ────────────────────────────────────────────────────────────

function TrendBadge({ pct, label }: { pct: number | null | undefined; label?: string }) {
  if (pct === null || pct === undefined) return null;

  const up      = pct > 0;
  const neutral = pct === 0;
  const abs     = Math.abs(pct);

  const Icon = neutral ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <div className={cn(
      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
      neutral ? 'bg-muted text-muted-foreground' :
      up      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    )}>
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      <span>{abs.toFixed(1)}%</span>
      {label && <span className="opacity-60">{label}</span>}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ compact, hero }: { compact?: boolean; hero?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border bg-card animate-pulse',
      hero ? 'p-5' : compact ? 'p-3' : 'p-4',
    )}>
      <div className="mb-3 flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-muted" />
        <div className={cn('rounded-lg bg-muted', hero ? 'h-10 w-10' : 'h-7 w-7')} />
      </div>
      <div className={cn('mb-1 rounded bg-muted', hero ? 'h-9 w-32' : compact ? 'h-5 w-16' : 'h-6 w-24')} />
      <div className="h-3 w-16 rounded bg-muted" />
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────

export function ExecKpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  color = 'indigo',
  trendPct,
  trendLabel,
  loading,
  compact,
  hero,
}: Props) {
  const { t } = useTranslation('dashboard');

  if (loading) return <Skeleton compact={compact} hero={hero} />;

  const displayTrendLabel = trendLabel ?? t($ => $.execKpi.vsYesterday);
  const c = COLOR[color];

  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md',
      hero ? 'p-5' : compact ? 'p-3' : 'p-4',
    )}>
      {/* Color accent bar */}
      <div className={cn('absolute inset-x-0 top-0', hero ? 'h-1' : 'h-0.5', c.bar)} />

      {/* Header row */}
      <div className={cn('flex items-start justify-between gap-2', hero ? 'mb-3' : 'mb-2')}>
        <p className={cn(
          'font-medium leading-tight text-muted-foreground',
          hero ? 'text-xs' : compact ? 'text-[11px]' : 'text-xs',
        )}>
          {label}
        </p>
        <div className={cn(
          'flex shrink-0 items-center justify-center rounded-lg',
          c.badge,
          hero ? 'h-10 w-10' : compact ? 'h-6 w-6' : 'h-8 w-8',
        )}>
          <Icon className={cn(c.icon, hero ? 'h-5 w-5' : compact ? 'h-3 w-3' : 'h-4 w-4')} />
        </div>
      </div>

      {/* Value */}
      <p className={cn(
        'font-bold tracking-tight',
        hero ? 'text-3xl' : compact ? 'text-lg' : 'text-2xl',
      )}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>

      {/* Footer: sub-value + trend */}
      <div className={cn('flex flex-wrap items-center gap-1.5', hero ? 'mt-2' : 'mt-1.5')}>
        {subValue && (
          <span className={cn('text-muted-foreground', hero ? 'text-xs' : 'text-[10px]')}>{subValue}</span>
        )}
        <TrendBadge pct={trendPct} label={displayTrendLabel} />
      </div>
    </div>
  );
}
