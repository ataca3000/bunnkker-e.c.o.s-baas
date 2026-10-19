import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Combobox } from '@/components/crud/combobox';
import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import { useBrandOptions } from '@/features/brands/hooks/use-brand-options';
import { useOrganizationContext } from '@/features/organization/context/organization-context';
import type { CustomerFormValues } from '@/features/customers/components/customer-form-schema';

type Props = { isEdit?: boolean };

export function CustomerFormFields({ isEdit = false }: Props) {
  const { t } = useTranslation('customers');
  const { register, setValue, control } = useFormContext<CustomerFormValues>();
  const { activeCompanyId } = useOrganizationContext();

  const brandId = useWatch({ control, name: 'brand_id' });
  const { data: brandOptions = [], isLoading: brandsLoading } = useBrandOptions(activeCompanyId ?? null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField name="brand_id" label={t($ => $.form.brand.label, { defaultValue: 'Brand' })} required>
            <Combobox
              options={brandOptions}
              value={brandId || null}
              onChange={(val) => setValue('brand_id', val ?? '', { shouldValidate: true })}
              placeholder={t($ => $.form.brand.placeholder, { defaultValue: 'Select brand…' })}
              loading={brandsLoading}
              disabled={isEdit}
            />
          </FormField>
        </div>
        <FormField name="code" label={t($ => $.form.code.label)} required>
          <Input placeholder={t($ => $.form.code.placeholder)} {...register('code')} />
        </FormField>
        <FormField name="name" label={t($ => $.form.name.label)} required>
          <Input placeholder={t($ => $.form.name.placeholder)} {...register('name')} />
        </FormField>
        <FormField name="contact_person" label={t($ => $.form.contactPerson)}>
          <Input {...register('contact_person')} />
        </FormField>
        <FormField name="email" label={t($ => $.form.email.label)}>
          <Input type="email" placeholder={t($ => $.form.email.placeholder)} {...register('email')} />
        </FormField>
        <FormField name="phone" label={t($ => $.form.phone)}>
          <Input {...register('phone')} />
        </FormField>
        <FormField name="mobile" label={t($ => $.form.mobile)}>
          <Input {...register('mobile')} />
        </FormField>
        <FormField name="country" label={t($ => $.form.country)}>
          <Input {...register('country')} />
        </FormField>
        <FormField name="city" label={t($ => $.form.city)}>
          <Input {...register('city')} />
        </FormField>
        <div className="sm:col-span-2">
          <FormField name="address" label={t($ => $.form.address)}>
            <Input {...register('address')} />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField name="notes" label={t($ => $.form.notes.label)}>
            <Input placeholder={t($ => $.form.notes.placeholder)} {...register('notes')} />
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
