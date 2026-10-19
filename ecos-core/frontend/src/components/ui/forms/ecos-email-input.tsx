import { forwardRef } from 'react';
import { Mail } from 'lucide-react';

import { EcosInput, type EcosInputProps } from './ecos-input';

export type EcosEmailInputProps = Omit<EcosInputProps, 'type'>;

export const EcosEmailInput = forwardRef<HTMLInputElement, EcosEmailInputProps>(
  ({ leading, ...props }, ref) => (
    <EcosInput
      ref={ref}
      type="email"
      inputMode="email"
      autoComplete="email"
      leading={leading ?? <Mail />}
      {...props}
    />
  ),
);

EcosEmailInput.displayName = 'EcosEmailInput';
