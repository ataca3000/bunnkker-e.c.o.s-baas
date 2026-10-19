import type { ReactNode } from 'react';

import { EntityDrawer } from '@/components/crud/entity-drawer';
import type { PageDrawerSize } from '../types';

const SIZE_CLASS: Record<PageDrawerSize, string> = {
  // One workspace drawer width: 60% of the viewport from `sm` up, full-width
  // below it. The presets are kept as a stable vocabulary so no call site has to
  // change, but they no longer disagree with one another — a drawer's width is a
  // property of the shell, not of whichever page happened to open it.
  //
  // `full` is the one deliberate exception: it exists for surfaces that genuinely
  // need the whole viewport, and collapsing it into 60% would remove a capability
  // rather than standardise one.
  sm:   'w-full md:w-[80vw] lg:w-[60vw] sm:max-w-none',
  md:   'w-full md:w-[80vw] lg:w-[60vw] sm:max-w-none',
  lg:   'w-full md:w-[80vw] lg:w-[60vw] sm:max-w-none',
  xl:   'w-full md:w-[80vw] lg:w-[60vw] sm:max-w-none',
  '2xl': 'w-full md:w-[80vw] lg:w-[60vw] sm:max-w-none',
  full: 'sm:max-w-none sm:w-full',
};

type PageDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Drawer width preset. Default: 'xl' (576 px) for forms, 'lg' for detail views. */
  size?: PageDrawerSize;
  side?: 'left' | 'right';
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Standardized drawer shell for ERP pages.
 * Extends EntityDrawer with explicit size presets so every page uses the
 * same width vocabulary instead of ad-hoc max-w values.
 *
 * Usage:
 *   <PageDrawer open={open} onOpenChange={setOpen} title="New Order" size="xl">
 *     <OrderForm ... />
 *   </PageDrawer>
 */
export function PageDrawer({ size = 'xl', ...props }: PageDrawerProps) {
  return <EntityDrawer {...props} className={SIZE_CLASS[size]} />;
}
