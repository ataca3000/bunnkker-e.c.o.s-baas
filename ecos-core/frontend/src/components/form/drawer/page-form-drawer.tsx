import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { FormDrawerSize } from '../types';

const SIZE_CLASS: Record<FormDrawerSize, string> = {
  // Same single width as PageDrawer: the preset name is a stable vocabulary,
  // not a different geometry. See page-drawer.tsx.
  sm:   'w-full md:w-[80vw] lg:w-[60vw] sm:max-w-none',
  md:   'w-full md:w-[80vw] lg:w-[60vw] sm:max-w-none',
  lg:   'w-full md:w-[80vw] lg:w-[60vw] sm:max-w-none',
  xl:   'w-full md:w-[80vw] lg:w-[60vw] sm:max-w-none',
  full: 'sm:max-w-none sm:w-full',
};

type PageFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Optional status badge rendered next to the title. */
  badge?: ReactNode;
  size?: FormDrawerSize;
  side?: 'left' | 'right';
  /**
   * Tabs slot — render a <DrawerTabs> here.
   * Displayed between the header and the scrollable body.
   */
  tabs?: ReactNode;
  /**
   * Footer slot — render a <DrawerFooter> here.
   * Always pinned to the bottom of the drawer.
   */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Standard ERP form / detail drawer shell.
 *
 * Layer hierarchy:
 *   PageFormDrawer
 *     → header  (title + badge + description + close)
 *     → tabs    (optional, sticky — use DrawerTabs)
 *     → body    (scrollable — place form content here)
 *     → footer  (sticky — use DrawerFooter)
 *
 * Usage:
 *   <PageFormDrawer
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="New Supplier"
 *     description="Fill in supplier details."
 *     size="xl"
 *     footer={
 *       <DrawerFooter
 *         onCancel={() => setOpen(false)}
 *         primary={{ label: 'Save', form: 'supplier-form', type: 'submit', loading: isPending }}
 *       />
 *     }
 *   >
 *     <EntityForm id="supplier-form" form={form} onSubmit={onSubmit}>
 *       <FormSection title="Basic Info">
 *         <FormGrid>
 *           <FormFieldWrapper name="name" label="Name" required>
 *             <Input {...register('name')} />
 *           </FormFieldWrapper>
 *         </FormGrid>
 *       </FormSection>
 *     </EntityForm>
 *   </PageFormDrawer>
 */
export function PageFormDrawer({
  open,
  onOpenChange,
  title,
  description,
  badge,
  size = 'xl',
  side = 'right',
  tabs,
  footer,
  children,
  className,
}: PageFormDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'flex w-full flex-col gap-0 p-0',
          // Hide the default close button injected by SheetContent —
          // we render our own in the header for better placement and styling.
          '[&>button:last-child]:hidden',
          SIZE_CLASS[size],
          className,
        )}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold leading-tight text-foreground truncate">
                {title}
              </h2>
              {badge ? <span className="shrink-0">{badge}</span> : null}
            </div>
            {description ? (
              <p className="text-sm text-muted-foreground leading-snug">{description}</p>
            ) : null}
          </div>

          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Close drawer"
            >
              <X className="size-4" />
            </Button>
          </SheetClose>
        </div>

        {/* ── Tabs (optional) ────────────────────────────────────────────── */}
        {tabs ? <div className="shrink-0">{tabs}</div> : null}

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-5 sm:px-6">{children}</div>
        </div>

        {/* ── Sticky footer ──────────────────────────────────────────────── */}
        {footer ? (
          <div className="shrink-0 border-t bg-background">{footer}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
