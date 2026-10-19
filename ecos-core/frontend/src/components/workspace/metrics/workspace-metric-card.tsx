import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { WorkspaceMetric } from '../types';

type Props = WorkspaceMetric;

function TrendBadge({ trend }: { trend: NonNullable<WorkspaceMetric['trend']> }) {
  const TrendIcon =
    trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] font-semibold',
        trend.direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
        trend.direction === 'down' && 'text-destructive',
        trend.direction === 'neutral' && 'text-muted-foreground',
      )}
    >
      <TrendIcon className="size-3" aria-hidden />
      {Math.abs(trend.value)}%
    </span>
  );
}

export function WorkspaceMetricCard({
  icon: Icon,
  label,
  value,
  trend,
  colorClass = 'bg-primary/10 text-primary',
  onClick,
  active = false,
  isLoading = false,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-14" />
        </div>
      </div>
    );
  }

  const isClickable = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      aria-pressed={isClickable ? active : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-start transition-all',
        isClickable && 'cursor-pointer hover:border-primary/40 hover:shadow-md',
        active && 'border-primary shadow-md ring-2 ring-primary/20',
        !isClickable && 'cursor-default',
      )}
    >
      <span
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', colorClass)}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-xl font-bold tabular-nums">{value}</p>
          {trend ? <TrendBadge trend={trend} /> : null}
        </div>
      </div>
    </button>
  );
}
