import { useEffect } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { FormField } from '@/components/crud';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CompanySelect } from '@/features/branches/components/company-select';
import type { BrandCreateFormValues, BrandUpdateFormValues } from './brand-form-schema';

type BrandFormFieldsProps = {
  mode: 'create' | 'edit';
  existingLogoUrl?: string | null;
  onImageChange?: (file: File | null) => void;
};

// Arabic Unicode block (U+0600–U+06FF) → Latin equivalents for slug generation
const ARABIC_MAP: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ء': '',
  'ؤ': 'w', 'ئ': 'y',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h',
  'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't',
  'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h',
  'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'a',
  // Tashkeel (diacritics) — strip entirely
  'ً': '', 'ٌ': '', 'ٍ': '', 'َ': '', 'ُ': '',
  'ِ': '', 'ّ': '', 'ْ': '', 'ٰ': '', 'ـ': '',
};

function toSlug(value: string): string {
  let text = value.toLowerCase().trim();
  // Transliterate Arabic characters before the ASCII-only filter
  text = text.replace(/[؀-ۿ]/g, (ch) => ARABIC_MAP[ch] ?? '');
  // Strip Latin diacritics (é → e, ü → u, etc.)
  text = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return text
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function BrandFormFields({ mode, existingLogoUrl, onImageChange }: BrandFormFieldsProps) {
  const { register, control, setValue, getValues } = useFormContext<BrandCreateFormValues & BrandUpdateFormValues>();

  const nameValue = useWatch({ control, name: 'name' });
  const codeValue = useWatch({ control, name: 'code' });

  // Auto-populate slug from name while slug hasn't been manually customised.
  // Falls back to the brand code when the name has no ASCII-translatable characters.
  useEffect(() => {
    if (!nameValue) return;
    const current = getValues('slug') ?? '';
    // If user manually edited the slug (differs from the auto-slug we'd derive), preserve it
    if (current && current !== toSlug(getValues('name') ?? '')) return;

    const fromName = toSlug(nameValue);
    if (fromName) {
      setValue('slug', fromName, { shouldValidate: false });
    } else if (codeValue) {
      const fromCode = toSlug(codeValue);
      if (fromCode) setValue('slug', fromCode, { shouldValidate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, codeValue]);

  return (
    <div className="flex flex-col gap-4">
      {mode === 'create' ? (
        <FormField name="company_id" label="Company" required>
          <Controller
            control={control}
            name="company_id"
            render={({ field }) => (
              <CompanySelect value={field.value || null} onChange={field.onChange} />
            )}
          />
        </FormField>
      ) : (
        <FormField
          name="company_id"
          label="Company"
          description="Changing the company initiates an ownership transfer."
        >
          <Controller
            control={control}
            name="company_id"
            render={({ field }) => (
              <CompanySelect value={field.value || null} onChange={field.onChange} />
            )}
          />
        </FormField>
      )}

      <FormField name="name" label="Brand Name" required>
        <Input placeholder="e.g. Acme Food Brands" {...register('name')} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="code" label="Code" description="Leave blank to auto-generate (BRD-000001)">
          <Input placeholder="BRD-000001" {...register('code')} />
        </FormField>
        <FormField name="slug" label="Slug" description="Auto-derived from name — edit to customise">
          <Input placeholder="acme-food-brands" {...register('slug')} />
        </FormField>
      </div>

      <FormField name="logo" label="Brand Logo">
        <ImageUploadField existingUrl={existingLogoUrl ?? null} onChange={onImageChange ?? (() => {})} />
      </FormField>

      <FormField name="description" label="Description">
        <Textarea
          placeholder="Brief description of this brand…"
          rows={3}
          {...register('description')}
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="border-input size-4 rounded" {...register('is_active')} />
        Active
      </label>

      <div className="border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Pricing Defaults</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            name="default_target_margin"
            label="Minimum Margin %"
            description="Managed in Configuration OS — changes here update the policy immediately"
          >
            <Input
              type="number" min="0" max="99.99" step="0.01"
              placeholder="e.g. 30"
              {...register('default_target_margin')}
            />
          </FormField>
          <FormField
            name="default_markup"
            label="Markup %"
            description="Derived automatically — set margin instead"
          >
            <Input
              type="number" min="0" step="0.01"
              placeholder="e.g. 42.86"
              {...register('default_markup')}
            />
          </FormField>
          <FormField
            name="default_discount_pct"
            label="Default Discount %"
            description="Sale price = regular × (1 − discount)"
          >
            <Input
              type="number" min="0" max="99.99" step="0.01"
              placeholder="e.g. 10"
              {...register('default_discount_pct')}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
