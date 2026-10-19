import { CheckCircle, Clock, RefreshCw, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';

export type SyncStatus = 'synced' | 'pending' | 'failed' | 'not_synced';

const CONFIG: Record<
  SyncStatus,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  synced: {
    label: 'Synced',
    icon: CheckCircle,
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800',
  },
  failed: {
    label: 'Failed',
    icon: RefreshCw,
    className: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800',
  },
  not_synced: {
    label: 'Not Synced',
    icon: WifiOff,
    className: 'text-muted-foreground bg-muted border-border',
  },
};

type SyncBadgeProps = {
  status: SyncStatus | null | undefined;
  className?: string;
};

export function SyncBadge({ status, className }: SyncBadgeProps) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;

  const cfg = CONFIG[status];
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        cfg.className,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" />
      {cfg.label}
    </span>
  );
}
