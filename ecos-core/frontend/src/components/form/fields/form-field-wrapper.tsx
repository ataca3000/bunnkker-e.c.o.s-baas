import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { cn } from '@/lib/utils';

/**
 * Reads the RHF validation error for `name` from the nearest FormProvider.
 * Returns undefined when called outside a FormProvider (dev throws; prod returns null).
 * The hook is always called unconditionally — the try/catch only handles the
 * dev-mode throw from useFormContext when no provider is present.
 */
function useSafeFormError(name?: string): string | undefined {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { formState: { errors } } = useFormContext();
    if (!name) return undefined;
    const field = (errors as Record<string, { message?: unknown } | undefined>)[name];
    return typeof field?.message === 'string' ? field.message : undefined;
  } catch {
    return undefined;
  }
}

type FormFieldWrapperProps = {
  /**
   * React Hook Form field name.
   * When provided, validation errors are read automatically from the form context.
   */
  name?: string;
  label: string;
  required?: boolean;
  /** Hint displayed below the field when there is no validation error. */
  description?: string;
  /**
   * Explicit error string — overrides the RHF context error.
   * Useful for server errors or non-RHF forms.
   */
  error?: string;
  /** Current character count — renders a counter when maxLength is also set. */
  currentLength?: number;
  maxLength?: number;
  children: ReactNode;
  className?: string;
};

/**
 * Enhanced form field wrapper with label, required indicator,
 * help text, validation error, and optional character counter.
 *
 * Works inside AND outside React Hook Form — when used inside a FormProvider,
 * errors are read automatically via the `name` prop. Pass `error` explicitly
 * to override or use outside a form context.
 *
 * Usage inside RHF:
 *   <FormFieldWrapper name="email" label="Email" required description="Business email only">
 *     <Input type="email" {...register('email')} />
 *   </FormFieldWrapper>
 *
 * Usage standalone (view/read-only):
 *   <FormFieldWrapper label="Assigned to">
 *     <span className="text-sm">Jane Smith</span>
 *   </FormFieldWrapper>
 */
export function FormFieldWrapper({
  name,
  label,
  required,
  description,
  error: errorProp,
  currentLength,
  maxLength,
  children,
  className,
}: FormFieldWrapperProps) {
  const contextError = useSafeFormError(name);
  const error = errorProp ?? contextError;
  const showCounter = maxLength !== undefined && currentLength !== undefined;
  const isOverLimit = showCounter && currentLength > maxLength;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={name}
          className="text-sm font-medium leading-none text-foreground"
        >
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden>
              {' *'}
            </span>
          ) : null}
        </label>

        {/* Character counter */}
        {showCounter ? (
          <span
            className={cn(
              'text-[11px] tabular-nums',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground',
            )}
            aria-live="polite"
          >
            {currentLength}/{maxLength}
          </span>
        ) : null}
      </div>

      {/* Field control */}
      {children}

      {/* Help text OR validation error (mutually exclusive) */}
      {error ? (
        <p
          className="flex items-center gap-1 text-xs text-destructive"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="size-3 shrink-0" aria-hidden />
          {error}
        </p>
      ) : description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
