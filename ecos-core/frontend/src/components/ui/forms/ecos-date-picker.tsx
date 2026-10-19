import { forwardRef } from 'react';
import { Calendar } from 'lucide-react';

import { EcosInput, type EcosInputProps } from './ecos-input';

export type EcosDatePickerProps = Omit<EcosInputProps, 'type'> & {
  min?: string;
  max?: string;
};

/**
 * Date input with consistent enterprise styling. Uses the native date picker
 * which is accessible and requires no additional dependencies. The calendar
 * icon is decorative only — clicking the field opens the native picker.
 */
export const EcosDatePicker = forwardRef<HTMLInputElement, EcosDatePickerProps>(
  (props, ref) => (
    <EcosInput
      ref={ref}
      type="date"
      leading={<Calendar />}
      {...props}
    />
  ),
);

EcosDatePicker.displayName = 'EcosDatePicker';
