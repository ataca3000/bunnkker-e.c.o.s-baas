import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type FormActionsProps = {
  children: ReactNode;
  align?: 'left' | 'center' | 'right' | 'spread';
  className?: string;
};

const alignClass: Record<NonNullable<FormActionsProps['align']>, string> = {
  left:   'justify-start',
  center: 'justify-center',
  right:  'justify-end',
  spread: 'justify-between',
};

/**
 * Sticky footer action bar for forms inside Drawers and Dialogs.
 * Renders buttons in a consistent row with configurable alignment.
 */
export function FormActions({ children, align = 'right', className }: FormActionsProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', alignClass[align], className)}>
      {children}
    </div>
  );
}
