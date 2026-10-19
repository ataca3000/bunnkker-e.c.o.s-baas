import { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { Combobox, FormField } from '@/components/crud';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CompanySelect } from '@/features/branches/components/company-select';
import { useBrandOptions } from '@/features/brands/hooks/use-brand-options';
import { BUSINESS_ACCOUNT_PROVIDERS, BUSINESS_ACCOUNT_STATUSES } from '../types/business-account';
import type { BusinessAccountCreateFormValues, BusinessAccountUpdateFormValues } from './business-account-form-schema';

type BusinessAccountFormFieldsProps = {
  mode: 'create' | 'edit';
  /** In edit mode, pass the account's company_id so brand list stays scoped. */
  companyId?: string | null;
  existingLogoUrl?: string | null;
  onImageChange?: (file: File | null) => void;
};

export function BusinessAccountFormFields({ mode, companyId: editCompanyId, existingLogoUrl, onImageChange }: BusinessAccountFormFieldsProps) {
  const { register, control, watch, setValue } = useFormContext<
    BusinessAccountCreateFormValues & BusinessAccountUpdateFormValues
  >();

  // In create mode the company lives in the form; in edit mode it's fixed via prop.
  const formCompanyId = watch('company_id') as string | undefined;
  const effectiveCompanyId = mode === 'edit' ? (editCompanyId ?? null) : (formCompanyId || null);

  // Clear brand whenever the user picks a different company (create mode only).
  useEffect(() => {
    if (mode === 'create') {
      setValue('brand_id', null);
    }
  }, [formCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: filteredBrands = [], isLoading: brandsLoading } = useBrandOptions(effectiveCompanyId);

  const brandOptions = [
    { value: '', label: 'None' },
    ...filteredBrands,
  ];

  return (
    <div className="flex flex-col gap-4">
      {mode === 'create' && (
        <FormField name="company_id" label="Company" required>
          <Controller
            control={control}
            name="company_id"
            render={({ field }) => (
              <CompanySelect value={field.value || null} onChange={field.onChange} />
            )}
          />
        </FormField>
      )}

      <FormField name="brand_id" label="Brand">
        <Controller
          control={control}
          name="brand_id"
          render={({ field }) => (
            <Combobox
              options={brandOptions}
              value={field.value ?? ''}
              onChange={(val) => field.onChange(val || null)}
              loading={brandsLoading}
              disabled={!effectiveCompanyId}
              placeholder={!effectiveCompanyId ? 'Select a company first' : 'Select brand…'}
              searchPlaceholder="Search brands..."
              emptyText="No brands found"
            />
          )}
        />
      </FormField>

      <FormField name="name" label="Name" required>
        <Input placeholder="e.g. My Facebook Store" {...register('name')} />
      </FormField>

      <FormField name="provider" label="Provider" required>
        <Controller
          control={control}
          name="provider"
          render={({ field }) => (
            <select
              value={field.value}
              onChange={field.onChange}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              {BUSINESS_ACCOUNT_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        />
      </FormField>

      <FormField name="status" label="Status">
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <select
              value={field.value}
              onChange={field.onChange}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              {BUSINESS_ACCOUNT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          )}
        />
      </FormField>

      <FormField name="code" label="Code" description="Auto-generated if blank">
        <Input placeholder="BA-000001" {...register('code')} />
      </FormField>

      <FormField name="logo" label="Logo">
        <ImageUploadField existingUrl={existingLogoUrl ?? null} onChange={onImageChange ?? (() => {})} />
      </FormField>

      <FormField name="description" label="Description">
        <Textarea
          placeholder="Brief description of this business account…"
          rows={3}
          {...register('description')}
        />
      </FormField>
    </div>
  );
}
