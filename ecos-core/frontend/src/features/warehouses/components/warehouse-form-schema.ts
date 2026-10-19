import { z } from 'zod';

import type { Warehouse, WarehousePayload } from '@/features/warehouses/types/warehouse';

export const warehouseSchema = z.object({
  company_id: z.string().min(1, 'Company is required.'),
  code: z.string().max(20).optional(),
  name: z.string().min(1, 'Name is required.').max(255),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  is_active: z.boolean(),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;

export function toFormValues(warehouse?: Warehouse | null): WarehouseFormValues {
  return {
    company_id: warehouse?.company_id ?? '',
    code: warehouse?.code ?? '',
    name: warehouse?.name ?? '',
    address: warehouse?.address ?? '',
    city: warehouse?.city ?? '',
    country: warehouse?.country ?? '',
    is_active: warehouse?.is_active ?? true,
  };
}

export function toPayload(values: WarehouseFormValues): WarehousePayload {
  return {
    company_id: values.company_id,
    code: values.code || undefined,
    name: values.name,
    address: values.address || undefined,
    city: values.city || undefined,
    country: values.country || undefined,
    is_active: values.is_active,
  };
}
