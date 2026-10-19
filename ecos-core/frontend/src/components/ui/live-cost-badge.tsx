import { cn } from '@/lib/utils';

type LiveCostBadgeProps = {
  className?: string;
};

/**
 * ADR-RECIPE-001 — Live Cost Indicator
 * Displayed beside any cost value computed from current material prices
 * (as opposed to a historical snapshot).
 */
export function LiveCostBadge({ className }: LiveCostBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5',
        'border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-700',
        'dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
        className,
      )}
      title="Calculated from current material prices"
    >
      <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden />
      Live
    </span>
  );
}
