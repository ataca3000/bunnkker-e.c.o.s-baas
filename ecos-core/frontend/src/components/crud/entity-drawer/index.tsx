import type { ReactNode } from 'react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type EntityDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right';
  className?: string;
};

/**
 * Reusable slide-over panel (built on Sheet) for create/edit forms and detail
 * views. Header + scrollable body + sticky footer.
 */
export function EntityDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  className,
}: EntityDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn('flex w-full flex-col gap-0 p-0 md:w-[80vw] lg:w-[60vw] sm:max-w-none', className)}
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer ? (
          <div className="bg-background flex items-center justify-end gap-2 border-t p-4">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
