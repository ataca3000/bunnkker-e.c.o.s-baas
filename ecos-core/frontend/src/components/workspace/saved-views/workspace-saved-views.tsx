import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SavedViewsConfig } from '../types';

type Props = SavedViewsConfig & {
  className?: string;
};

export function WorkspaceSavedViews({ views, activeId, onViewChange, className }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Saved views"
      className={cn('flex items-center gap-0.5 overflow-x-auto', className)}
    >
      {views.map((view) => {
        const isActive = view.id === activeId;
        return (
          <button
            key={view.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onViewChange(view.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5',
              'text-sm font-medium outline-none transition-colors',
              'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
              isActive
                ? 'text-foreground after:bg-primary'
                : 'text-muted-foreground hover:text-foreground after:bg-transparent',
            )}
          >
            {view.label}
            {view.isDefault ? (
              <span className="hidden text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50 sm:inline">
                Default
              </span>
            ) : null}
            {view.count !== undefined ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                {view.count}
              </span>
            ) : null}
          </button>
        );
      })}

      {/* Extension point — save current view */}
      <button
        type="button"
        disabled
        aria-label="Save view — coming soon"
        className="flex shrink-0 cursor-not-allowed items-center gap-1 px-2.5 py-2.5 text-xs text-muted-foreground/40"
      >
        <Plus className="size-3" aria-hidden />
        <span className="hidden sm:inline">Save view</span>
      </button>
    </div>
  );
}
