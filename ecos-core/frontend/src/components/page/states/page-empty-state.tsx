import type { ComponentType } from 'react';
import { Inbox } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PageEmptyStateProps = {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ComponentType<{ className?: string }>;
  };
  className?: string;
};

/**
 * Full-page empty state — centered, designed to fill WorkspacePage's content area.
 *
 * Usage:
 *   <PageEmptyState
 *     icon={ShoppingBag}
 *     title="No orders yet"
 *     description="Orders will appear here once customers start purchasing."
 *     action={{ label: 'Create first order', icon: Plus, onClick: openDrawer }}
 *   />
 */
export function PageEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: PageEmptyStateProps) {
  const ActionIcon = action?.icon;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-20 text-center',
        className,
      )}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-8" aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-xs text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Button size="sm" onClick={action.onClick} className="mt-1">
          {ActionIcon ? <ActionIcon className="size-4" aria-hidden /> : null}
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
