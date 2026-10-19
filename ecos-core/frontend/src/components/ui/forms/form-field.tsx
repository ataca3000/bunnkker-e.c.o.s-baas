import { type ReactNode, useId } from 'react';
import { useFormContext } from 'react-hook-form';

import { cn } from '@/lib/utils';

export type FormFieldProps = {
  name: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  description?: string;
  hint?: string;
  /** Manually override the error message (bypasses RHF context) */
  error?: string;
  /** Success message shown instead of error/description */
  success?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Enterprise form field wrapper.
 *
 * Layout: Label row → Control → Feedback row (hint / error / success / description).
 * Reads the error for `name` from the surrounding EntityForm / FormProvider context.
 * All feedback states are mutually exclusive with this priority:
 *   error (explicit prop or RHF) > success > hint > description
 */
export function EcosFormField({
  name,
  label,
  required,
  optional,
  description,
  hint,
  error: errorProp,
  success,
  children,
  className,
}: FormFieldProps) {
  const uid = useId();
  const fieldId = `${name}-${uid}`;

  // Try to read RHF context — FormField also works outside a FormProvider
  let rhfError: string | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { formState: { errors } } = useFormContext();
    const fieldError = (errors as Record<string, { message?: unknown } | undefined>)[name];
    rhfError = typeof fieldError?.message === 'string' ? fieldError.message : undefined;
  } catch {
    // No FormProvider in scope — standalone use
  }

  const errorMsg = errorProp ?? rhfError;

  const feedback = errorMsg
    ? <p role="alert" className="text-xs text-destructive">{errorMsg}</p>
    : success
    ? <p className="text-xs text-emerald-600 dark:text-emerald-400">{success}</p>
    : hint
    ? <p className="text-xs text-muted-foreground">{hint}</p>
    : description
    ? <p className="text-xs text-muted-foreground">{description}</p>
    : null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-1">
        <label htmlFor={fieldId} className="text-sm font-medium leading-none">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
        {optional && !required && (
          <span className="text-xs text-muted-foreground">Optional</span>
        )}
      </div>

      {/* Inject id onto the immediate child if it's a single element */}
      <div id={fieldId} className="contents">
        {children}
      </div>

      {feedback}
    </div>
  );
}

// Keep the original FormField name as an alias for backwards compatibility
export { EcosFormField as FormField };
