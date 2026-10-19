import { Controller, useFormContext } from 'react-hook-form';

import { FormField } from '@/components/crud';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { COMPANY_CURRENCIES, COMPANY_TIMEZONES } from '@/features/companies/types/company';
import type { CompanyFormValues } from '@/features/companies/components/company-form-schema';

type CompanyFormFieldsProps = {
  existingLogoUrl?: string | null;
  onImageChange?: (file: File | null) => void;
};

export function CompanyFormFields({ existingLogoUrl, onImageChange }: CompanyFormFieldsProps = {}) {
  const { register, control, watch } = useFormContext<CompanyFormValues>();
  const isActive = watch('is_active');

  return (
    <div className="flex flex-col gap-5">
      {/* Company Logo */}
      <FormField name="logo" label="Company Logo">
        <ImageUploadField existingUrl={existingLogoUrl ?? null} onChange={onImageChange ?? (() => {})} />
      </FormField>

      {/* Name + Code */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="name" label="Company Name" required>
          <Input placeholder="e.g. ECOS Holding" {...register('name')} />
        </FormField>
        <FormField name="code" label="Company Code" description="Leave blank to auto-generate (COM-000001)">
          <Input placeholder="COM-000001" {...register('code')} />
        </FormField>
      </div>

      {/* Currency + Timezone */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="currency" label="Currency">
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <select
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select currency…</option>
                {COMPANY_CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            )}
          />
        </FormField>

        <FormField name="timezone" label="Timezone">
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <select
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value)}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select timezone…</option>
                {COMPANY_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            )}
          />
        </FormField>
      </div>

      {/* Description */}
      <FormField name="description" label="Description">
        <Textarea
          placeholder="Brief description of this company…"
          rows={3}
          {...register('description')}
        />
      </FormField>

      {/* Legal + Registration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="legal_name" label="Legal Name">
          <Input {...register('legal_name')} />
        </FormField>
        <FormField name="tax_number" label="Tax Number">
          <Input {...register('tax_number')} />
        </FormField>
        <FormField name="commercial_registration" label="Commercial Registration">
          <Input {...register('commercial_registration')} />
        </FormField>
        <FormField name="website" label="Website">
          <Input placeholder="https://example.com" {...register('website')} />
        </FormField>
      </div>

      {/* Contact */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="email" label="Email">
          <Input type="email" placeholder="info@example.com" {...register('email')} />
        </FormField>
        <FormField name="phone" label="Phone">
          <Input {...register('phone')} />
        </FormField>
        <FormField name="mobile" label="Mobile">
          <Input {...register('mobile')} />
        </FormField>
        <FormField name="country" label="Country">
          <Input {...register('country')} />
        </FormField>
        <FormField name="city" label="City">
          <Input {...register('city')} />
        </FormField>
        <FormField name="postal_code" label="Postal Code">
          <Input {...register('postal_code')} />
        </FormField>
      </div>

      <FormField name="address" label="Address">
        <Input {...register('address')} />
      </FormField>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              id="company-is-active"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor="company-is-active" className="cursor-pointer">
          {isActive ? 'Active' : 'Inactive'}
        </Label>
      </div>
    </div>
  );
}
