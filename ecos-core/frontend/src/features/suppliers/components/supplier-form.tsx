import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import type { SupplierFormValues } from '@/features/suppliers/components/supplier-form-schema';

export function SupplierFormFields() {
  const { t } = useTranslation('suppliers');
  const { register } = useFormContext<SupplierFormValues>();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      {/* Location (Part 1) */}
      <div className="border-border/60 border-t pt-4">
        <h4 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">
          {t($ => $.form.sectionLocation)}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="country" label={t($ => $.form.country)}>
            <Input {...register('country')} />
          </FormField>
          <FormField name="state" label={t($ => $.form.state)}>
            <Input {...register('state')} />
          </FormField>
          <FormField name="city" label={t($ => $.form.city)}>
            <Input {...register('city')} />
          </FormField>
          <FormField name="district" label={t($ => $.form.district)}>
            <Input {...register('district')} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField name="address" label={t($ => $.form.address)}>
              <Input {...register('address')} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField name="google_maps_url" label={t($ => $.form.googleMapsUrl)}>
              <Input type="url" placeholder="https://maps.google.com/…" {...register('google_maps_url')} />
            </FormField>
          </div>
        </div>
      </div>

      {/* Opening balance (Part 2) */}
      <div className="border-border/60 border-t pt-4">
        <h4 className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wide">
          {t($ => $.form.sectionFinancial)}
        </h4>
        <p className="text-muted-foreground mb-3 text-xs">{t($ => $.form.sectionFinancialHint)}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="opening_balance_amount" label={t($ => $.form.openingBalanceAmount)}>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('opening_balance_amount')}
            />
          </FormField>
          <FormField name="opening_balance_type" label={t($ => $.form.openingBalanceType)}>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              {...register('opening_balance_type')}
            >
              <option value="credit">{t($ => $.form.openingBalanceCredit)}</option>
              <option value="debit">{t($ => $.form.openingBalanceDebit)}</option>
            </select>
          </FormField>
        </div>
      </div>

      <div className="border-border/60 border-t pt-4">
        <FormField name="notes" label={t($ => $.form.notes.label)}>
          <Input placeholder={t($ => $.form.notes.placeholder)} {...register('notes')} />
        </FormField>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" className="border-input size-4 rounded" {...register('is_active')} />
          {t($ => $.form.active)}
        </label>
      </div>
    </div>
  );
}
