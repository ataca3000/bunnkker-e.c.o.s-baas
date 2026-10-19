import { z } from 'zod';

import type { Fulfillment, FulfillmentPayload } from '@/features/fulfillments/types/fulfillment';

export const fulfillmentLineSchema = z.object({
  product_id: z.string().min(1, 'Product is required.'),
  quantity: z
    .string()
    .min(1, 'Quantity is required.')
    .refine((v) => Number(v) > 0, 'Quantity must be greater than 0.'),
});

export const fulfillmentSchema = z.object({
  order_id: z.string().min(1, 'Order is required.'),
  warehouse_id: z.string().min(1, 'Warehouse is required.'),
  fulfillment_date: z.string().min(1, 'Fulfillment date is required.'),
  notes: z.string().max(2000).optional(),
  lines: z.array(fulfillmentLineSchema).min(1, 'At least one line item is required.'),
});

export type FulfillmentLineFormValues = z.infer<typeof fulfillmentLineSchema>;
export type FulfillmentFormValues = z.infer<typeof fulfillmentSchema>;

export function toFormValues(fulfillment?: Fulfillment | null): FulfillmentFormValues {
  return {
    order_id: fulfillment?.order_id ?? '',
    warehouse_id: fulfillment?.warehouse_id ?? '',
    fulfillment_date: fulfillment?.fulfillment_date ?? new Date().toISOString().slice(0, 10),
    notes: fulfillment?.notes ?? '',
    lines:
      fulfillment?.lines.map((l) => ({
        product_id: l.product_id,
        quantity: String(l.quantity),
      })) ?? [{ product_id: '', quantity: '' }],
  };
}

export function toPayload(values: FulfillmentFormValues): FulfillmentPayload {
  return {
    order_id: values.order_id,
    warehouse_id: values.warehouse_id,
    fulfillment_date: values.fulfillment_date,
    notes: values.notes || null,
    lines: values.lines.map((l) => ({
      product_id: l.product_id,
      quantity: Number(l.quantity),
    })),
  };
}
