import { z } from 'zod';

import type {
  PurchaseOrder,
  PurchaseOrderPayload,
} from '@/features/purchase-orders/types/purchase-order';

export const lineSchema = z.object({
  product_id: z.string().min(1, 'Product is required.'),
  quantity: z
    .string()
    .min(1, 'Quantity is required.')
    .refine((v) => Number(v) > 0, 'Quantity must be greater than 0.'),
  unit_price: z
    .string()
    .min(1, 'Unit price is required.')
    .refine((v) => Number(v) >= 0, 'Unit price must be 0 or greater.'),
});

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, 'Supplier is required.'),
  order_date: z.string().min(1, 'Order date is required.'),
  expected_date: z.string().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(lineSchema).min(1, 'At least one line item is required.'),
});

export type LineFormValues = z.infer<typeof lineSchema>;
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

export function toFormValues(order?: PurchaseOrder | null): PurchaseOrderFormValues {
  return {
    supplier_id: order?.supplier_id ?? '',
    order_date: order?.order_date ?? new Date().toISOString().slice(0, 10),
    expected_date: order?.expected_date ?? '',
    notes: order?.notes ?? '',
    lines:
      order?.lines.map((l) => ({
        product_id: l.product_id,
        quantity: String(l.quantity),
        unit_price: String(l.unit_price),
      })) ?? [{ product_id: '', quantity: '', unit_price: '' }],
  };
}

export function toPayload(values: PurchaseOrderFormValues): PurchaseOrderPayload {
  return {
    supplier_id: values.supplier_id,
    order_date: values.order_date,
    expected_date: values.expected_date || null,
    notes: values.notes || null,
    lines: values.lines.map((l) => ({
      product_id: l.product_id,
      quantity: Number(l.quantity),
      unit_price: Number(l.unit_price),
    })),
  };
}
