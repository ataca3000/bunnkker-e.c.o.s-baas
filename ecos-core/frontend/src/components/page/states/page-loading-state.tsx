import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { PageLoadingVariant } from '../types';

type PageLoadingStateProps = {
  variant?: PageLoadingVariant;
  rows?: number;
  label?: string;
  className?: string;
};

// ── Variants ──────────────────────────────────────────────────────────────────

function SpinnerLoading({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation('common');

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground', className)}>
      <Loader2 className="size-8 animate-spin" />
      <span className="text-sm">{label ?? t($ => $.loading)}</span>
    </div>
  );
}

function TableLoading({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border', className)}>
      {/* Header row */}
      <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ms-auto h-3 w-16" />
        <Skeleton className="h-3 w-14" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0">
          <Skeleton className="size-4 rounded" />
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="ms-auto h-5 w-14 rounded-full" />
          <Skeleton className="size-6 rounded" />
        </div>
      ))}
    </div>
  );
}

function CardsLoading({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-7 w-20 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListLoading({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y overflow-hidden rounded-xl border', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Loading state with multiple visual variants.
 *
 * spinner — centered spinner (default, for unknown layout)
 * table   — table row skeletons (for data grids)
 * cards   — card grid skeletons (for card layouts)
 * list    — list item skeletons (for list views)
 */
export function PageLoadingState({
  variant = 'spinner',
  rows = 8,
  label,
  className,
}: PageLoadingStateProps) {
  switch (variant) {
    case 'table': return <TableLoading rows={rows} className={className} />;
    case 'cards': return <CardsLoading rows={rows} className={className} />;
    case 'list':  return <ListLoading rows={rows} className={className} />;
    default:      return <SpinnerLoading label={label} className={className} />;
  }
}
