import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type FormGridCols = 1 | 2 | 4;

type FormGridProps = {
  /**
   * Number of columns on tablet/desktop.
   * Mobile is always 1 column.
   * Default: 2
   */
  cols?: FormGridCols;
  children: ReactNode;
  className?: string;
};

const COLS_CLASS: Record<FormGridCols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

/**
 * Responsive form field grid.
 *
 * Desktop / Tablet → 2 columns (default)
 * Mobile           → 1 column (always)
 *
 * For full-width fields, add `className="sm:col-span-2"` (or `col-span-full`)
 * to the child FormFieldWrapper. Quarter-width: `lg:col-span-1` inside a 4-col grid.
 *
 * Usage:
 *   <FormGrid cols={2}>
 *     <FormFieldWrapper name="code" label="Code" required>
 *       <Input ... />
 *     </FormFieldWrapper>
 *     <FormFieldWrapper name="name" label="Name" required>
 *       <Input ... />
 *     </FormFieldWrapper>
 *     <FormFieldWrapper name="address" label="Address" className="sm:col-span-2">
 *       <Input ... />
 *     </FormFieldWrapper>
 *   </FormGrid>
 */
export function FormGrid({ cols = 2, children, className }: FormGridProps) {
  return (
    <div className={cn('grid gap-4', COLS_CLASS[cols], className)}>
      {children}
    </div>
  );
}
