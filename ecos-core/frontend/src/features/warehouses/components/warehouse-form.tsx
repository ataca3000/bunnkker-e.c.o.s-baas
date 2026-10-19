import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import { CompanySelect } from '@/features/branches/components/company-select';
import type { WarehouseFormValues } from '@/features/warehouses/components/warehouse-form-schema';

export function WarehouseFormFields() {
  const { t } = useTranslation('warehouses');
  const { register, control } = useFormContext<WarehouseFormValues>();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="company_id" label={t($ => $.form.company.label)} required>
          <Controller
            control={control}
            name="company_id"
            render={({ field }) => (
              <CompanySelect
                value={field.value || null}
                onChange={field.onChange}
              />
            )}
          />
        </FormField>
        <FormField name="code" label={t($ => $.form.code.label)}>
          <Input placeholder="Auto-generated" {...register('code')} />
        </FormField>
        <FormField name="name" label={t($ => $.form.name.label)} required>
          <Input placeholder={t($ => $.form.name.placeholder)} {...register('name')} />
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

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="border-input size-4 rounded" {...register('is_active')} />
        {t($ => $.form.active)}
      </label>
    </div>
  );
}
