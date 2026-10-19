import type { ComponentType, ReactNode } from 'react';
import { ChevronDown, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type IconComponent = ComponentType<{ className?: string }>;

export type SmartToolbarAction = {
  key: string;
  label: string;
  onClick: () => void;
  icon?: IconComponent;
  /** Hidden on mobile (< sm breakpoint). */
  hideOnMobile?: boolean;
};

export type SmartToolbarBulkAction = {
  key: string;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  /** Render a separator BEFORE this item. */
  separator?: boolean;
};

type SmartToolbarProps = {
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: IconComponent;
  };
  secondaryActions?: SmartToolbarAction[];
  bulkActions?: SmartToolbarBulkAction[];
  /** Label for the Bulk Actions trigger button. */
  bulkActionsLabel?: string;
  selectedCount?: number;
  onRefresh?: () => void;
  isFetching?: boolean;
  /** Accessible label for the Refresh icon button (pass translated string from the caller). */
  refreshLabel?: string;
  /** Slot for right-side view controls: Column Manager, Saved Views, etc. */
  viewControls?: ReactNode;
};

/**
 * Universal ERP list toolbar.
 * Renders: primary CTA → secondary actions → bulk actions (selection-gated) | refresh → view controls.
 * Wire up module-specific labels; SmartToolbar handles layout and responsive show/hide.
 */
export function SmartToolbar({
  primaryAction,
  secondaryActions,
  bulkActions,
  bulkActionsLabel,
  selectedCount = 0,
  onRefresh,
  isFetching = false,
  refreshLabel,
  viewControls,
}: SmartToolbarProps) {
  const { t } = useTranslation('common');
  const hasSelection = selectedCount > 0;
  const PrimaryIcon: IconComponent = primaryAction?.icon ?? Plus;

  return (
    <div className="flex items-center gap-2 border-b bg-background px-4 py-2">
      {/* ── Left: primary + secondary + bulk ── */}
      <div className="flex items-center gap-1.5">
        {primaryAction ? (
          <Button size="sm" onClick={primaryAction.onClick} className="gap-1.5">
            <PrimaryIcon className="size-3.5" />
            {primaryAction.label}
          </Button>
        ) : null}

        {secondaryActions?.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.key}
              variant="outline"
              size="sm"
              onClick={action.onClick}
              className={cn('gap-1.5', action.hideOnMobile && 'hidden sm:flex')}
            >
              {Icon ? <Icon className="size-3.5" /> : null}
              {action.label}
            </Button>
          );
        })}

        {hasSelection && bulkActions?.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-1.5">
                {bulkActionsLabel ?? t($ => $.toolbar.bulkActions)}
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground/20 px-1 text-[10px] font-semibold tabular-nums">
                  {selectedCount}
                </span>
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {bulkActions.flatMap((action) => {
                const nodes: ReactNode[] = [];
                if (action.separator) {
                  nodes.push(<DropdownMenuSeparator key={`sep-${action.key}`} />);
                }
                nodes.push(
                  <DropdownMenuItem
                    key={action.key}
                    onClick={action.onClick}
                    variant={action.destructive ? 'destructive' : undefined}
                  >
                    {action.label}
                  </DropdownMenuItem>,
                );
                return nodes;
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="flex-1" />

      {/* ── Right: refresh + view controls ── */}
      <div className="flex items-center gap-1.5">
        {onRefresh ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onRefresh}
            disabled={isFetching}
            aria-label={refreshLabel ?? t($ => $.toolbar.refresh)}
          >
            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} />
          </Button>
        ) : null}
        {viewControls}
      </div>
    </div>
  );
}
