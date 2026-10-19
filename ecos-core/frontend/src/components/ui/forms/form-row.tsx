import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type FormRowProps = {
  cols?: 1 | 2 | 3 | 4;
  children: ReactNode;
  className?: string;
};

const colsClass: Record<NonNullable<FormRowProps['cols']>, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

/**
 * Responsive grid row for placing form fields side by side.
 * Use `className="sm:col-span-2"` on a child to span the full width.
 */
export function FormRow({ cols = 2, children, className }: FormRowProps) {
  return (
    <div className={cn('grid gap-4', colsClass[cols], className)}>
      {children}
    </div>
  );
}
