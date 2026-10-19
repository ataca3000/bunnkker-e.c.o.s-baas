import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FilterPanelProps = {
  open: boolean;
  children: ReactNode;
  title?: string;
  onClear?: () => void;
  className?: string;
};

/**
 * Collapsible container for advanced filters. Render any filter controls as
 * children; the panel only handles layout and show/hide.
 */
export function FilterPanel({
  open,
  children,
  title,
  onClear,
  className,
}: FilterPanelProps) {
  const { t } = useTranslation('common');

  if (!open) {
    return null;
  }

  return (
    <div className={cn('bg-muted/30 flex flex-col gap-3 rounded-lg border p-4', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title ?? t($ => $.toolbar.filters)}</span>
        {onClear ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            {t($ => $.actions.clear)}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}
