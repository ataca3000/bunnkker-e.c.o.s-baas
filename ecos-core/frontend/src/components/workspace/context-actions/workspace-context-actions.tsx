import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { WorkspaceAction } from '../types';

type Props = {
  primaryAction?: WorkspaceAction;
  secondaryActions?: WorkspaceAction[];
  className?: string;
};

export function WorkspaceContextActions({ primaryAction, secondaryActions = [], className }: Props) {
  if (!primaryAction && secondaryActions.length === 0) return null;

  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      {secondaryActions.length > 0 ? (
        <>
          {/* Desktop: all secondary actions visible */}
          <div className="hidden items-center gap-2 md:flex">
            {secondaryActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.key}
                  variant={action.variant ?? 'outline'}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled || action.soon}
                >
                  {Icon ? <Icon className="size-4" aria-hidden /> : null}
                  {action.label}
                  {action.soon ? (
                    <span className="rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[9px] font-medium text-primary/70">
                      Soon
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>

          {/* Mobile: overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-9 md:hidden"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {secondaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <DropdownMenuItem
                    key={action.key}
                    onClick={action.onClick}
                    disabled={action.disabled || action.soon}
                    className={action.variant === 'destructive' ? 'text-destructive' : undefined}
                  >
                    {Icon ? <Icon className="size-4" aria-hidden /> : null}
                    {action.label}
                    {action.soon ? (
                      <span className="ms-auto text-[10px] text-muted-foreground/60">Soon</span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}

      {/* Primary action: always visible */}
      {primaryAction ? (
        (() => {
          const Icon = primaryAction.icon;
          return (
            <Button
              variant={primaryAction.variant ?? 'default'}
              size="sm"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {Icon ? <Icon className="size-4" aria-hidden /> : null}
              {primaryAction.label}
            </Button>
          );
        })()
      ) : null}
    </div>
  );
}
