import { forwardRef } from 'react';

import { EcosInput, type EcosInputProps } from './ecos-input';

export type EcosNumberInputProps = Omit<EcosInputProps, 'type'> & {
  min?: number;
  max?: number;
  step?: number;
};

/**
 * Number input that disables scroll-wheel changes while focused to prevent
 * accidental value edits when users scroll a long form.
 */
export const EcosNumberInput = forwardRef<HTMLInputElement, EcosNumberInputProps>(
  ({ onWheel, ...props }, ref) => (
    <EcosInput
      ref={ref}
      type="number"
      // Blur on wheel so the browser cannot scroll-change the value
      onWheel={(e) => {
        (e.currentTarget as HTMLInputElement).blur();
        onWheel?.(e);
      }}
      {...props}
    />
  ),
);

EcosNumberInput.displayName = 'EcosNumberInput';
