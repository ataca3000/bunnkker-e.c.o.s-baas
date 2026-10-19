import { z } from 'zod';

import type { Branch, BranchPayload } from '@/features/branches/types/branch';

export const branchSchema = z.object({
  company_id: z.string().min(1, 'Company is required.'),
  code: z.string().min(1, 'Code is required.').max(50),
  name: z.string().min(1, 'Branch name is required.').max(255),
  phone: z.string().max(50).optional(),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]).optional(),
  manager_name: z.string().max(255).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  is_head_office: z.boolean(),
  is_active: z.boolean(),
});

export type BranchFormValues = z.infer<typeof branchSchema>;

/** Build form values from an existing branch (or empty defaults for create). */
export function toFormValues(branch?: Branch | null, defaultCompanyId?: string): BranchFormValues {
  return {
    company_id: branch?.company_id ?? defaultCompanyId ?? '',
    code: branch?.code ?? '',
    name: branch?.name ?? '',
    phone: branch?.phone ?? '',
    email: branch?.email ?? '',
    manager_name: branch?.manager_name ?? '',
    address: branch?.address ?? '',
    city: branch?.city ?? '',
    country: branch?.country ?? '',
    is_head_office: branch?.is_head_office ?? false,
    is_active: branch?.is_active ?? true,
  };
}

export function toPayload(values: BranchFormValues): BranchPayload {
  return { ...values };
}
