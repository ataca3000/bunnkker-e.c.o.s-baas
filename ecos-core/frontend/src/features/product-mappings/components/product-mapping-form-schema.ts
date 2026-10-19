import { z } from 'zod';

import type {
  ProductMapping,
  ProductMappingPayload,
  SyncStatus,
} from '@/features/product-mappings/types/product-mapping';

const SYNC_STATUSES: [SyncStatus, ...SyncStatus[]] = ['pending', 'synced', 'error'];

export const productMappingSchema = z.object({
  product_id: z.string().min(1, 'Product is required.'),
  channel_id: z.string().min(1, 'Channel is required.'),
  external_product_id: z.string().min(1, 'External Product ID is required.').max(255),
  external_sku: z.string().max(255).optional(),
  sync_status: z.enum(SYNC_STATUSES),
});

export type ProductMappingFormValues = z.infer<typeof productMappingSchema>;

export function toFormValues(mapping?: ProductMapping | null): ProductMappingFormValues {
  return {
    product_id: mapping?.product_id ?? '',
    channel_id: mapping?.channel_id ?? '',
    external_product_id: mapping?.external_product_id ?? '',
    external_sku: mapping?.external_sku ?? '',
    sync_status: mapping?.sync_status ?? 'pending',
  };
}

export function toPayload(values: ProductMappingFormValues): ProductMappingPayload {
  return {
    product_id: values.product_id,
    channel_id: values.channel_id,
    external_product_id: values.external_product_id,
    external_sku: values.external_sku || undefined,
    sync_status: values.sync_status,
  };
}
