import { cn } from '@/lib/utils';
import type { InboxKPIs } from '../../types/engineering';

interface Props {
  kpis: InboxKPIs | null;
  loading: boolean;
}

interface KPICard {
  label: string;
  value: number | null;
  icon: string;
  borderColor: string;
  textColor: string;
  badgeColor: string;
  pulse?: boolean;
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-muted', className)} />
  );
}

export function InboxKPIRow({ kpis, loading }: Props) {
  const cards: KPICard[] = [
    {
      label: 'Open Tasks',
      value: kpis?.open_tasks ?? null,
      icon: '📋',
      borderColor: 'border-l-blue-500',
      textColor: 'text-blue-700 dark:text-blue-400',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
    {
      label: 'Running',
      value: kpis?.running_tasks ?? null,
      icon: '⚡',
      borderColor: 'border-l-amber-500',
      textColor: 'text-amber-700 dark:text-amber-400',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      pulse: true,
    },
    {
      label: 'Completed (30d)',
      value: kpis?.completed_tasks ?? null,
      icon: '✅',
      borderColor: 'border-l-green-500',
      textColor: 'text-green-700 dark:text-green-400',
      badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    },
    {
      label: 'Failed (30d)',
      value: kpis?.failed_tasks ?? null,
      icon: '❌',
      borderColor: 'border-l-red-500',
      textColor: 'text-red-700 dark:text-red-400',
      badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    },
    {
      label: 'Overdue',
      value: kpis?.overdue_tasks ?? null,
      icon: '🔴',
      borderColor: 'border-l-orange-500',
      textColor: 'text-orange-700 dark:text-orange-400',
      badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            'flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-sm',
            'border-l-4',
            card.borderColor,
          )}
        >
          {loading ? (
            <>
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-8 w-12" />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                <span className="text-base leading-none">{card.icon}</span>
              </div>
              <div className="flex items-end gap-2">
                <span className={cn('text-3xl font-bold tabular-nums leading-none', card.textColor)}>
                  {card.value ?? '—'}
                </span>
                {card.pulse && (card.value ?? 0) > 0 && (
                  <span className="mb-1 flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                  </span>
                )}
              </div>
              <span className={cn('self-start rounded-full px-2 py-0.5 text-xs font-medium', card.badgeColor)}>
                {card.label}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
