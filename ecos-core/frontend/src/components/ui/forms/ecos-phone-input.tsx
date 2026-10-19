import { forwardRef } from 'react';
import { Phone } from 'lucide-react';

import { EcosInput, type EcosInputProps } from './ecos-input';

export type EcosPhoneInputProps = Omit<EcosInputProps, 'type'>;

export const EcosPhoneInput = forwardRef<HTMLInputElement, EcosPhoneInputProps>(
  ({ leading, ...props }, ref) => (
    <EcosInput
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      leading={leading ?? <Phone />}
      {...props}
    />
  ),
);

EcosPhoneInput.displayName = 'EcosPhoneInput';
