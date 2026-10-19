import { forwardRef } from 'react';

import { EcosInput, type EcosInputProps } from './ecos-input';

export type EcosPercentageInputProps = Omit<EcosInputProps, 'type' | 'trailing'>;

/**
 * Number input with a % suffix. Prevents scroll-wheel changes.
 * Accepts 0–100 by default; override with min/max.
 */
export const EcosPercentageInput = forwardRef<HTMLInputElement, EcosPercentageInputProps>(
  ({ min = 0, max = 100, onWheel, ...props }, ref) => (
    <EcosInput
      ref={ref}
      type="number"
      min={min}
      max={max}
      trailing={<span className="text-xs font-medium text-muted-foreground">%</span>}
      onWheel={(e) => {
        (e.currentTarget as HTMLInputElement).blur();
        onWheel?.(e);
      }}
      {...props}
    />
  ),
);

EcosPercentageInput.displayName = 'EcosPercentageInput';
