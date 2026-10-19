import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import type { QuickFilterChip } from '../types';

type QuickFilterChipsProps = {
  chips: QuickFilterChip[];
  className?: string;
};

/**
 * Horizontal filter chip strip. Scrolls on mobile, wraps on desktop.
 *
 * Usage:
 *   <QuickFilterChips
 *     chips={[
 *       { key: 'all',     label: 'All',     count: 120, active: true,  onClick: () => setStatus('all') },
 *       { key: 'pending', label: 'Pending', count: 14,  active: false, onClick: () => setStatus('pending') },
 *     ]}
 *   />
 */
export function QuickFilterChips({ chips, className }: QuickFilterChipsProps) {
  const { t } = useTranslation('common');

  return (
    <div
      role="group"
      aria-label={t($ => $.toolbar.quickFilters)}
      className={cn('flex gap-1.5 overflow-x-auto py-2 scrollbar-none', className)}
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClick}
          disabled={chip.disabled}
          aria-pressed={chip.active}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            chip.active
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
            chip.disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          {chip.label}
          {chip.count !== undefined ? (
            <span
              className={cn(
                'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                chip.active
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-background text-foreground/70',
              )}
            >
              {chip.count > 999 ? '999+' : chip.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
