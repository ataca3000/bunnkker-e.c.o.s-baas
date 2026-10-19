import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type WorkspacePageProps = {
  /** Slot-based toolbar rendered above content. Sticky by default. */
  toolbar?: ReactNode;
  /** Quick filter chips or status tabs rendered below toolbar. */
  quickFilters?: ReactNode;
  /** Main content area (data grid, cards, etc.). */
  children: ReactNode;
  /** Pagination controls rendered at the bottom. */
  pagination?: ReactNode;
  /** Whether toolbar sticks to top on scroll. Default: true. */
  stickyToolbar?: boolean;
  className?: string;
};

/**
 * Layout shell for every ERP workspace page.
 *
 * Sits below WorkspaceHeader in the hierarchy:
 *   AppShell → WorkspaceHeader → WorkspacePage → Page Content
 *
 * Provides consistent slot layout: toolbar / quickFilters / content / pagination.
 * No business logic — pure composition.
 */
export function WorkspacePage({
  toolbar,
  quickFilters,
  children,
  pagination,
  stickyToolbar = true,
  className,
}: WorkspacePageProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {/* ── Toolbar ── */}
      {toolbar ? (
        <div
          className={cn(
            'border-b bg-background py-2.5',
            stickyToolbar && 'sticky top-0 z-10',
          )}
        >
          {toolbar}
        </div>
      ) : null}

      {/* ── Quick filters / status tabs ── */}
      {quickFilters ? (
        <div className="border-b bg-background">
          {quickFilters}
        </div>
      ) : null}

      {/* ── Main content ── */}
      <div className="min-h-[30vh] flex-1 py-4">
        {children}
      </div>

      {/* ── Pagination ── */}
      {pagination ? (
        <div className="border-t bg-background pt-4">
          {pagination}
        </div>
      ) : null}
    </div>
  );
}
