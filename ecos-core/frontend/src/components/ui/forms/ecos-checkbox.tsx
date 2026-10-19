import { forwardRef, useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type EcosCheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'> & {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClass = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
};

export const EcosCheckbox = forwardRef<HTMLInputElement, EcosCheckboxProps>(
  ({ checked, onCheckedChange, label, description, size = 'md', className, disabled, ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLInputElement>(null);
    const ref = (forwardedRef as React.RefObject<HTMLInputElement> | null) ?? innerRef;

    const isIndeterminate = checked === 'indeterminate';
    const isChecked = !isIndeterminate && checked === true;

    useEffect(() => {
      if (ref && 'current' in ref && ref.current) {
        ref.current.indeterminate = isIndeterminate;
      }
    }, [isIndeterminate, ref]);

    const control = (
      <input
        type="checkbox"
        ref={ref}
        checked={isChecked}
        disabled={disabled}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={cn(
          'shrink-0 cursor-pointer rounded border-input accent-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          sizeClass[size as keyof typeof sizeClass],
          className,
        )}
        {...props}
      />
    );

    if (!label) return control;

    return (
      <label className={cn('flex items-start gap-2 cursor-pointer', disabled && 'cursor-not-allowed opacity-50')}>
        <span className="pt-px">{control}</span>
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium leading-none">{label}</span>
          {description && <span className="text-xs text-muted-foreground">{description}</span>}
        </span>
      </label>
    );
  },
);

EcosCheckbox.displayName = 'EcosCheckbox';
