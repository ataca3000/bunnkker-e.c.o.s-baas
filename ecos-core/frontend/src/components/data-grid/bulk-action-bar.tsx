import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

export type BulkActionItem = {
  key: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
};

type BulkActionBarProps = {
  selectedCount: number;
  actions: BulkActionItem[];
  onClear: () => void;
  /** Optional label prefix, e.g. "orders". Defaults to "items". */
  entityLabel?: string;
  /** Optional extra content rendered after the action buttons. */
  children?: ReactNode;
};

/**
 * Floating bulk-action bar — appears above the bottom of the viewport when rows are selected.
 * Alternative to embedding bulk actions in the toolbar; use for high-density action workflows.
 *
 * Usage: render at the page level (outside the grid), conditionally on selectedCount > 0.
 */
export function BulkActionBar({
  selectedCount,
  actions,
  onClear,
  entityLabel,
  children,
}: BulkActionBarProps) {
  const { t } = useTranslation('common');

  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={t($ => $.selection.bulkActionsFor, {
        selected: selectedCount,
        entity: entityLabel ?? t($ => $.selection.items),
      })}
      className="fixed inset-x-4 bottom-6 z-50 flex items-center gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:min-w-96"
    >
      <span className="shrink-0 text-sm font-medium tabular-nums">
        {t($ => $.selection.selected, { count: selectedCount })}
      </span>

      <div className="flex flex-1 flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            size="sm"
            variant={action.destructive ? 'destructive' : 'secondary'}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
        {children}
      </div>

      <Button
        size="icon"
        variant="ghost"
        className="size-7 shrink-0"
        onClick={onClear}
        aria-label={t($ => $.selection.clear)}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
