import { z } from 'zod';

import type { Company, CompanyPayload } from '@/features/companies/types/company';

export const companySchema = z.object({
  code:                    z.string().max(20).optional().or(z.literal('')),
  name:                    z.string().min(1, 'Company name is required.').max(255),
  legal_name:              z.string().max(255).optional(),
  tax_number:              z.string().max(100).optional(),
  commercial_registration: z.string().max(100).optional(),
  email:                   z.union([z.literal(''), z.string().email('Enter a valid email.')]).optional(),
  phone:                   z.string().max(50).optional(),
  mobile:                  z.string().max(50).optional(),
  website:                 z.union([z.literal(''), z.string().url('Enter a valid URL.')]).optional(),
  currency:                z.string().max(8).optional(),
  timezone:                z.string().max(64).optional(),
  description:             z.string().max(5000).optional(),
  country:                 z.string().max(100).optional(),
  city:                    z.string().max(100).optional(),
  address:                 z.string().max(255).optional(),
  postal_code:             z.string().max(32).optional(),
  logo:                    z.string().max(500).optional(),
  is_active:               z.boolean(),
});

export type CompanyFormValues = z.infer<typeof companySchema>;

export function toFormValues(company?: Company | null): CompanyFormValues {
  return {
    code:                    company?.code ?? '',
    name:                    company?.name ?? '',
    legal_name:              company?.legal_name ?? '',
    tax_number:              company?.tax_number ?? '',
    commercial_registration: company?.commercial_registration ?? '',
    email:                   company?.email ?? '',
    phone:                   company?.phone ?? '',
    mobile:                  company?.mobile ?? '',
    website:                 company?.website ?? '',
    currency:                company?.currency ?? '',
    timezone:                company?.timezone ?? 'Africa/Cairo',
    description:             company?.description ?? '',
    country:                 company?.country ?? '',
    city:                    company?.city ?? '',
    address:                 company?.address ?? '',
    postal_code:             company?.postal_code ?? '',
    logo:                    company?.logo ?? '',
    is_active:               company?.is_active ?? true,
  };
}

export function toPayload(values: CompanyFormValues): CompanyPayload {
  return {
    code:                    values.code || undefined,
    name:                    values.name,
    legal_name:              values.legal_name || undefined,
    tax_number:              values.tax_number || undefined,
    commercial_registration: values.commercial_registration || undefined,
    email:                   values.email || undefined,
    phone:                   values.phone || undefined,
    mobile:                  values.mobile || undefined,
    website:                 values.website || undefined,
    currency:                values.currency || undefined,
    timezone:                values.timezone || undefined,
    description:             values.description || undefined,
    country:                 values.country || undefined,
    city:                    values.city || undefined,
    address:                 values.address || undefined,
    postal_code:             values.postal_code || undefined,
    logo:                    values.logo || undefined,
    is_active:               values.is_active,
  };
}
