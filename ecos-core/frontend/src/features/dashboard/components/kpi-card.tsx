import type { LucideIcon } from 'lucide-react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Color = 'indigo' | 'emerald' | 'amber' | 'violet' | 'red' | 'blue' | 'cyan' | 'pink';
type Trend = 'up' | 'down' | 'neutral';
type Size  = 'sm' | 'xs';

const COLOR: Record<Color, { icon: string; bar: string }> = {
  indigo:  { icon: 'text-indigo-500',  bar: 'bg-indigo-500' },
  emerald: { icon: 'text-emerald-500', bar: 'bg-emerald-500' },
  amber:   { icon: 'text-amber-500',   bar: 'bg-amber-500' },
  violet:  { icon: 'text-violet-500',  bar: 'bg-violet-500' },
  red:     { icon: 'text-red-500',     bar: 'bg-red-500' },
  blue:    { icon: 'text-blue-500',    bar: 'bg-blue-500' },
  cyan:    { icon: 'text-cyan-500',    bar: 'bg-cyan-500' },
  pink:    { icon: 'text-pink-500',    bar: 'bg-pink-500' },
};

type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  color?: Color;
  trend?: Trend;
  delta?: string;
  size?: Size;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  color = 'indigo',
  trend = 'neutral',
  delta,
  size = 'sm',
}: KpiCardProps) {
  const { t } = useTranslation('dashboard');
  const c = COLOR[color];
  const xs = size === 'xs';

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendCls =
    trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <div className={cn('absolute top-0 inset-x-0 h-0.5', c.bar)} />
      <CardContent className={cn('flex flex-col gap-2', xs ? 'p-3' : 'p-4')}>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'text-muted-foreground font-medium leading-none',
              xs ? 'text-[11px]' : 'text-xs',
            )}
          >
            {label}
          </span>
          <Icon className={cn('shrink-0', c.icon, xs ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        </div>
        <div className={cn('font-bold tracking-tight', xs ? 'text-xl' : 'text-2xl')}>
          {value}
        </div>
        {!xs && (
          <div className={cn('flex items-center gap-1 text-[11px]', trendCls)}>
            <TrendIcon className="h-3 w-3" />
            <span>{delta ?? t($ => $.kpiCard.noData)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
