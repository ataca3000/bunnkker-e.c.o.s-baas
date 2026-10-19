import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type FormDividerProps = {
  label?: ReactNode;
  className?: string;
};

/**
 * Horizontal separator for visually grouping fields inside a FormSection.
 * Pass a `label` to show a centred text annotation on the line.
 */
export function FormDivider({ label, className }: FormDividerProps) {
  if (!label) {
    return <hr className={cn('border-border', className)} />;
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex-1 border-t border-border" />
      <span className="text-xs text-muted-foreground font-medium shrink-0">{label}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}
