import { forwardRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type EcosInputSize = 'sm' | 'md' | 'lg';

export type EcosInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: EcosInputSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  loading?: boolean;
};

const sizeClass: Record<EcosInputSize, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
};

const iconSizeClass: Record<EcosInputSize, string> = {
  sm: 'size-3',
  md: 'size-4',
  lg: 'size-4',
};

const paddingWithLeading: Record<EcosInputSize, string> = {
  sm: 'ps-7',
  md: 'ps-9',
  lg: 'ps-10',
};

const paddingWithTrailing: Record<EcosInputSize, string> = {
  sm: 'pe-7',
  md: 'pe-9',
  lg: 'pe-10',
};

export const EcosInput = forwardRef<HTMLInputElement, EcosInputProps>(
  ({ size = 'md', leading, trailing, loading, className, disabled, ...props }, ref) => {
    const hasLeading  = Boolean(leading);
    const hasTrailing = Boolean(trailing) || loading;

    return (
      <div className="relative flex w-full items-center">
        {hasLeading && (
          <span className={cn(
            'pointer-events-none absolute start-3 flex items-center text-muted-foreground',
            iconSizeClass[size],
          )}>
            {leading}
          </span>
        )}

        <input
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full min-w-0 rounded-md border border-input bg-transparent shadow-xs outline-none transition-[color,box-shadow]',
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-input/30',
            sizeClass[size],
            hasLeading  && paddingWithLeading[size],
            hasTrailing && paddingWithTrailing[size],
            className,
          )}
          {...props}
        />

        {(loading || hasTrailing) && (
          <span className="pointer-events-none absolute end-3 flex items-center text-muted-foreground">
            {loading
              ? <Loader2 className={cn('animate-spin', iconSizeClass[size])} />
              : <span className={iconSizeClass[size]}>{trailing}</span>
            }
          </span>
        )}
      </div>
    );
  },
);

EcosInput.displayName = 'EcosInput';
