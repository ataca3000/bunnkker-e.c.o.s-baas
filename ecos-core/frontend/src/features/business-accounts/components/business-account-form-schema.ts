import { z } from 'zod';

import type { BusinessAccount, BusinessAccountPayload } from '@/features/business-accounts/types/business-account';

export const businessAccountCreateSchema = z.object({
  company_id: z.string().min(1, 'Company is required'),
  brand_id: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required').max(255),
  provider: z.enum(['Meta', 'WooCommerce', 'Shopify', 'Amazon', 'TikTok', 'Google', 'Noon', 'Snapchat', 'Custom']),
  code: z.string().max(20).optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
  description: z.string().max(2000).optional().nullable(),
  logo: z.string().max(500).optional().nullable(),
});

export const businessAccountUpdateSchema = z.object({
  brand_id: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required').max(255),
  provider: z.enum(['Meta', 'WooCommerce', 'Shopify', 'Amazon', 'TikTok', 'Google', 'Noon', 'Snapchat', 'Custom']),
  code: z.string().max(20).optional(),
  status: z.enum(['active', 'inactive', 'suspended']),
  description: z.string().max(2000).optional().nullable(),
  logo: z.string().max(500).optional().nullable(),
});

export type BusinessAccountCreateFormValues = z.infer<typeof businessAccountCreateSchema>;
export type BusinessAccountUpdateFormValues = z.infer<typeof businessAccountUpdateSchema>;

export function toCreateFormValues(defaultCompanyId?: string): BusinessAccountCreateFormValues {
  return {
    company_id: defaultCompanyId ?? '',
    brand_id: null,
    name: '',
    provider: 'Custom',
    code: '',
    status: 'active',
    description: null,
    logo: null,
  };
}

export function toUpdateFormValues(account: BusinessAccount): BusinessAccountUpdateFormValues {
  return {
    brand_id: account.brand_id ?? null,
    name: account.name,
    provider: account.provider as BusinessAccountUpdateFormValues['provider'],
    code: account.code,
    status: account.status as BusinessAccountUpdateFormValues['status'],
    description: account.description ?? null,
    logo: account.logo ?? null,
  };
}

export function toCreatePayload(values: BusinessAccountCreateFormValues): BusinessAccountPayload {
  return {
    company_id: values.company_id,
    brand_id: values.brand_id || null,
    name: values.name,
    provider: values.provider,
    code: values.code || undefined,
    status: values.status,
    description: values.description || null,
    logo: values.logo || null,
  };
}

export function toUpdatePayload(values: BusinessAccountUpdateFormValues): Omit<BusinessAccountPayload, 'company_id'> {
  return {
    brand_id: values.brand_id || null,
    name: values.name,
    provider: values.provider,
    code: values.code || undefined,
    status: values.status,
    description: values.description || null,
    logo: values.logo || null,
  };
}
