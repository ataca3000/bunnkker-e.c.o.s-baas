import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import type { UnitFormValues } from '@/features/units/components/unit-form-schema';

export function UnitFormFields() {
  const { t } = useTranslation('units');
  const { register } = useFormContext<UnitFormValues>();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="code" label={t($ => $.form.code.label)} required>
          <Input placeholder={t($ => $.form.code.placeholder)} {...register('code')} />
        </FormField>
        <FormField name="name" label={t($ => $.form.name.label)} required>
          <Input placeholder={t($ => $.form.name.placeholder)} {...register('name')} />
        </FormField>
        <FormField name="symbol" label={t($ => $.form.symbol.label)}>
          <Input placeholder={t($ => $.form.symbol.placeholder)} {...register('symbol')} />
        </FormField>
      </div>

      <FormField name="description" label={t($ => $.form.description.label)}>
        <Input placeholder={t($ => $.form.description.placeholder)} {...register('description')} />
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="border-input size-4 rounded" {...register('is_active')} />
        {t($ => $.form.active)}
      </label>
    </div>
  );
}
