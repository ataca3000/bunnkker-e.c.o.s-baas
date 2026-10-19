import type { ReactNode } from 'react';
import {
  FormProvider,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';

// Re-export the enterprise FormField from the forms system
export { EcosFormField as FormField, type FormFieldProps } from '@/components/ui/forms/form-field';

type EntityFormProps<TValues extends FieldValues> = {
  form: UseFormReturn<TValues>;
  onSubmit: (values: TValues) => void;
  id?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Reusable wrapper around React Hook Form. Provides form context so
 * EcosFormField components can read validation state automatically.
 */
export function EntityForm<TValues extends FieldValues>({
  form,
  onSubmit,
  id,
  children,
  className,
}: EntityFormProps<TValues>) {
  return (
    <FormProvider {...form}>
      <form id={id} onSubmit={form.handleSubmit(onSubmit)} className={className} noValidate>
        {children}
      </form>
    </FormProvider>
  );
}
