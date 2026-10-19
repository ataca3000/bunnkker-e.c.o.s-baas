import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type QuickStatCardProps = {
  icon: LucideIcon;
  title: string;
  value: number | string;
  /** Applies an active / selected highlight ring */
  active?: boolean;
  onClick?: () => void;
  colorClassName?: string;
};

/**
 * Clickable KPI card used at the top of list pages (Quick Stats row).
 * Clicking a card applies a filter to the list below it.
 */
export function QuickStatCard({
  icon: Icon,
  title,
  value,
  active = false,
  onClick,
  colorClassName = 'text-primary bg-primary/10',
}: QuickStatCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-start shadow-xs transition-all',
        isClickable && 'cursor-pointer hover:shadow-md hover:border-primary/40',
        active && 'border-primary ring-2 ring-primary/20 shadow-md',
        !isClickable && 'cursor-default',
      )}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', colorClassName)}>
        <Icon className="size-5" aria-hidden />
      </span>

      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      </div>
    </button>
  );
}
