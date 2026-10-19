import { cn } from '@/lib/utils';
import type { CapacityStatus } from '../types/distribution-board';

interface CapacityIndicatorProps {
  current: number;
  capacity: number;
  status: CapacityStatus;
  className?: string;
}

const BAR_COLORS: Record<CapacityStatus, string> = {
  ok:       'bg-emerald-500',
  warning:  'bg-amber-500',
  critical: 'bg-red-500',
};

const TEXT_COLORS: Record<CapacityStatus, string> = {
  ok:       'text-emerald-700 dark:text-emerald-400',
  warning:  'text-amber-700 dark:text-amber-400',
  critical: 'text-red-700 dark:text-red-400',
};

export function CapacityIndicator({ current, capacity, status, className }: CapacityIndicatorProps) {
  const pct = capacity > 0 ? Math.min((current / capacity) * 100, 100) : 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300', BAR_COLORS[status])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-xs font-mono tabular-nums font-medium', TEXT_COLORS[status])}>
        {current}/{capacity}
      </span>
    </div>
  );
}
