import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type EcosRadioOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  description?: string;
  disabled?: boolean;
};

export type EcosRadioGroupProps<T extends string = string> = {
  options: EcosRadioOption<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
  name?: string;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
};

const radioSizeClass = {
  sm: 'size-3.5 mt-px',
  md: 'size-4 mt-px',
  lg: 'size-5',
};

export function EcosRadioGroup<T extends string = string>({
  options,
  value,
  onChange,
  name,
  orientation = 'horizontal',
  size = 'md',
  disabled,
  className,
}: EcosRadioGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'flex gap-4',
        orientation === 'vertical' && 'flex-col gap-2',
        className,
      )}
    >
      {options.map((opt) => {
        const isDisabled = disabled || opt.disabled;
        return (
          <label
            key={opt.value}
            className={cn(
              'flex items-start gap-2 cursor-pointer select-none',
              isDisabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              disabled={isDisabled}
              onChange={() => onChange(opt.value)}
              className={cn(
                'shrink-0 cursor-pointer accent-primary',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                'disabled:cursor-not-allowed',
                radioSizeClass[size],
              )}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium leading-none">{opt.label}</span>
              {opt.description && (
                <span className="text-xs text-muted-foreground">{opt.description}</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
