import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PageToolbarProps = {
  /** Left slot: search input, filter toggles. Gets flex-1 on desktop. */
  left?: ReactNode;
  /** Center slot: custom content, view toggles. */
  center?: ReactNode;
  /** Right slot: actions, bulk actions, export, import. Auto-margins left on desktop. */
  right?: ReactNode;
  className?: string;
};

/**
 * Slot-based toolbar for ERP pages.
 *
 * Responsive:
 *   Mobile  — stacks vertically (left on top, right below)
 *   Tablet+ — side by side in a single flex row
 *
 * Usage:
 *   <PageToolbar
 *     left={<SearchInput ... />}
 *     right={<><ExportButton /><NewButton /></>}
 *   />
 */
export function PageToolbar({ left, center, right, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      {left ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {left}
        </div>
      ) : null}

      {center ? (
        <div className="flex items-center justify-center gap-2">
          {center}
        </div>
      ) : null}

      {right ? (
        <div
          className={cn(
            'flex shrink-0 items-center gap-2',
            (left || center) && 'sm:ms-auto',
          )}
        >
          {right}
        </div>
      ) : null}
    </div>
  );
}
