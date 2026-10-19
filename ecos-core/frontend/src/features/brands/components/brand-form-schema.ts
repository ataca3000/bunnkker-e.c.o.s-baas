import { z } from 'zod';

import type { Brand, BrandPayload } from '@/features/brands/types/brand';

const pricingPolicyFields = {
  default_target_margin: z.coerce.number().min(0).max(99.99).nullable().optional(),
  default_markup:        z.coerce.number().min(0).nullable().optional(),
  default_discount_pct:  z.coerce.number().min(0).max(99.99).nullable().optional(),
};

export const brandCreateSchema = z.object({
  company_id: z.string().min(1, 'Company is required.'),
  name: z.string().min(1, 'Brand name is required.').max(255),
  code: z.string().max(20).optional(),
  slug: z
    .string()
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens.')
    .optional()
    .or(z.literal('')),
  logo: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  is_active: z.boolean(),
  ...pricingPolicyFields,
});

export const brandUpdateSchema = z.object({
  company_id: z.string().min(1).optional(),
  name: z.string().min(1, 'Brand name is required.').max(255),
  code: z.string().max(20).optional(),
  slug: z
    .string()
    .max(255)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens.')
    .optional()
    .or(z.literal('')),
  logo: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  is_active: z.boolean(),
  ...pricingPolicyFields,
});

export type BrandCreateFormValues = z.infer<typeof brandCreateSchema>;
export type BrandUpdateFormValues = z.infer<typeof brandUpdateSchema>;

export function toCreateFormValues(defaultCompanyId?: string): BrandCreateFormValues {
  return {
    company_id: defaultCompanyId ?? '',
    name: '',
    code: '',
    slug: '',
    logo: '',
    description: '',
    is_active: true,
  };
}

export function toUpdateFormValues(brand: Brand): BrandUpdateFormValues {
  return {
    company_id: brand.company_id,
    name: brand.name,
    code: brand.code,
    slug: brand.slug,
    logo: brand.logo ?? '',
    description: brand.description ?? '',
    is_active: brand.is_active,
    default_target_margin: brand.default_target_margin ?? undefined,
    default_markup:        brand.default_markup ?? undefined,
    default_discount_pct:  brand.default_discount_pct ?? undefined,
  };
}

export function toCreatePayload(values: BrandCreateFormValues): BrandPayload {
  return {
    company_id: values.company_id,
    name: values.name,
    code: values.code || undefined,
    slug: values.slug || undefined,
    logo: values.logo || undefined,
    description: values.description || undefined,
    is_active: values.is_active,
    default_target_margin: values.default_target_margin ?? null,
    default_markup:        values.default_markup ?? null,
    default_discount_pct:  values.default_discount_pct ?? null,
  };
}

export function toUpdatePayload(values: BrandUpdateFormValues): Omit<BrandPayload, 'company_id'> {
  return {
    name: values.name,
    code: values.code || undefined,
    slug: values.slug || undefined,
    logo: values.logo || undefined,
    description: values.description || undefined,
    is_active: values.is_active,
    default_target_margin: values.default_target_margin ?? null,
    default_markup:        values.default_markup ?? null,
    default_discount_pct:  values.default_discount_pct ?? null,
  };
}
