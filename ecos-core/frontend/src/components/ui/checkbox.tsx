import { forwardRef, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'> & {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onCheckedChange, className, ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLInputElement>(null);
    const ref = (forwardedRef as React.RefObject<HTMLInputElement> | null) ?? innerRef;

    const isIndeterminate = checked === 'indeterminate';
    const isChecked       = !isIndeterminate && checked === true;

    useEffect(() => {
      if (ref && 'current' in ref && ref.current) {
        ref.current.indeterminate = isIndeterminate;
      }
    }, [isIndeterminate, ref]);

    return (
      <input
        type="checkbox"
        ref={ref}
        checked={isChecked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className={cn(
          'size-4 cursor-pointer rounded border-input accent-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          className,
        )}
        {...props}
      />
    );
  },
);

Checkbox.displayName = 'Checkbox';
