import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

export type EcosTextareaSize = 'sm' | 'md' | 'lg';

export type EcosTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: EcosTextareaSize;
};

const sizeClass: Record<EcosTextareaSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
};

export const EcosTextarea = forwardRef<HTMLTextAreaElement, EcosTextareaProps>(
  ({ size = 'md', className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-w-0 rounded-md border border-input bg-transparent shadow-xs outline-none transition-[color,box-shadow]',
        'placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'dark:bg-input/30',
        sizeClass[size],
        className,
      )}
      {...props}
    />
  ),
);

EcosTextarea.displayName = 'EcosTextarea';
