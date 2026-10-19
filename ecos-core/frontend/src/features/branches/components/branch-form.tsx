import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import { CompanySelect } from '@/features/branches/components/company-select';
import type { BranchFormValues } from '@/features/branches/components/branch-form-schema';

type BranchFormFieldsProps = {
  showCompanyField?: boolean;
};

export function BranchFormFields({ showCompanyField = true }: BranchFormFieldsProps) {
  const { t } = useTranslation('branches');
  const { register, control } = useFormContext<BranchFormValues>();

  return (
    <div className="flex flex-col gap-4">
      {showCompanyField && (
        <FormField name="company_id" label={t($ => $.form.company.label)} required>
          <Controller
            control={control}
            name="company_id"
            render={({ field }) => (
              <CompanySelect value={field.value || null} onChange={field.onChange} />
            )}
          />
        </FormField>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="code" label={t($ => $.form.code.label)} required>
          <Input placeholder={t($ => $.form.code.placeholder)} {...register('code')} />
        </FormField>
        <FormField name="name" label={t($ => $.form.name.label)} required>
          <Input placeholder={t($ => $.form.name.placeholder)} {...register('name')} />
        </FormField>
        <FormField name="phone" label={t($ => $.form.phone)}>
          <Input {...register('phone')} />
        </FormField>
        <FormField name="email" label={t($ => $.form.email.label)}>
          <Input type="email" placeholder={t($ => $.form.email.placeholder)} {...register('email')} />
        </FormField>
        <FormField name="city" label={t($ => $.form.city)}>
          <Input {...register('city')} />
        </FormField>
        <FormField name="country" label={t($ => $.form.country)}>
          <Input {...register('country')} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField name="address" label={t($ => $.form.address)}>
            <Input {...register('address')} />
          </FormField>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="border-input size-4 rounded"
            {...register('is_head_office')}
          />
          {t($ => $.form.headOffice)}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="border-input size-4 rounded"
            {...register('is_active')}
          />
          {t($ => $.form.active)}
        </label>
      </div>
    </div>
  );
}
