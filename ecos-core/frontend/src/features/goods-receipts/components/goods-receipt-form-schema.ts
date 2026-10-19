import { z } from 'zod';

import type {
  GoodsReceipt,
  GoodsReceiptPayload,
  PaymentMethod,
  PaymentStatus,
} from '@/features/goods-receipts/types/goods-receipt';

export const grLineSchema = z.object({
  purchase_order_line_id: z.string().min(1, 'PO line is required.'),
  product_id: z.string().min(1, 'Product is required.'),
  uom_symbol_snapshot: z.string().nullable().optional(),
  ordered_quantity: z.number().positive(),
  gross_received_quantity: z
    .string()
    .min(1, 'Gross qty is required.')
    .refine((v) => Number(v) > 0, 'Must be greater than 0.'),
  net_received_quantity: z
    .string()
    .min(1, 'Net qty is required.')
    .refine((v) => Number(v) > 0, 'Must be greater than 0.'),
  unit_price: z.number().min(0).optional(),
  weight_photo: z.instanceof(File).nullable().optional(),
  weight_photo_path: z.string().nullable().optional(),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => Number(data.net_received_quantity) <= Number(data.gross_received_quantity),
  {
    message: 'Net qty cannot exceed gross qty.',
    path: ['net_received_quantity'],
  },
);

export const goodsReceiptSchema = z.object({
  purchase_order_id: z.string().min(1, 'Purchase order is required.'),
  warehouse_id: z.string().min(1, 'Warehouse is required.'),
  receipt_date: z.string().min(1, 'Receipt date is required.'),
  notes: z.string().max(2000).optional(),

  // Supplier invoice
  supplier_invoice_number: z.string().max(255).optional(),
  supplier_invoice_date: z.string().optional(),
  invoice_attachment: z.instanceof(File).nullable().optional(),
  invoice_attachment_path: z.string().nullable().optional(),

  // Invoice financials
  invoice_total_amount: z.string().optional(),
  paid_amount: z.string().optional(),
  freight_amount: z.string().optional(),
  tax_amount: z.string().optional(),
  additional_costs: z.string().optional(),

  // Payment tracking
  payment_status: z.string().optional(),
  payment_method: z.string().optional(),
  payment_terms_days: z.string().optional(),
  payment_due_date: z.string().optional(),

  lines: z.array(grLineSchema).min(1, 'At least one line is required.'),
});

export type GrLineFormValues = z.infer<typeof grLineSchema>;
export type GoodsReceiptFormValues = z.infer<typeof goodsReceiptSchema>;

export function toFormValues(receipt?: GoodsReceipt | null): GoodsReceiptFormValues {
  return {
    purchase_order_id: receipt?.purchase_order_id ?? '',
    warehouse_id: receipt?.warehouse_id ?? '',
    receipt_date: receipt?.receipt_date ?? new Date().toISOString().slice(0, 10),
    notes: receipt?.notes ?? '',
    // Supplier invoice
    supplier_invoice_number: receipt?.supplier_invoice_number ?? '',
    supplier_invoice_date: receipt?.supplier_invoice_date ?? '',
    invoice_attachment: null,
    invoice_attachment_path: receipt?.invoice_attachment_path ?? null,
    // Invoice financials
    invoice_total_amount: receipt?.invoice_total_amount ? String(receipt.invoice_total_amount) : '0',
    paid_amount: receipt?.paid_amount ? String(receipt.paid_amount) : '0',
    freight_amount: receipt?.freight_amount ? String(receipt.freight_amount) : '0',
    tax_amount: receipt?.tax_amount ? String(receipt.tax_amount) : '0',
    additional_costs: receipt?.additional_costs ? String(receipt.additional_costs) : '0',
    // Payment tracking
    payment_status: receipt?.payment_status ?? 'unpaid',
    payment_method: receipt?.payment_method ?? '',
    payment_terms_days: receipt?.payment_terms_days != null ? String(receipt.payment_terms_days) : '',
    payment_due_date: receipt?.payment_due_date ?? '',
    lines:
      receipt?.lines.map((l) => ({
        purchase_order_line_id: l.purchase_order_line_id,
        product_id: l.product_id,
        uom_symbol_snapshot: l.uom_symbol_snapshot ?? null,
        ordered_quantity: l.ordered_quantity,
        gross_received_quantity: String(l.gross_received_quantity ?? l.net_received_quantity ?? ''),
        net_received_quantity: String(l.net_received_quantity ?? ''),
        unit_price: l.unit_price,
        weight_photo: null,
        weight_photo_path: l.weight_photo_path ?? null,
        notes: l.notes ?? '',
      })) ?? [],
  };
}

export function toFormData(values: GoodsReceiptFormValues): FormData {
  const fd = new FormData();

  fd.append('purchase_order_id', values.purchase_order_id);
  fd.append('warehouse_id', values.warehouse_id);
  fd.append('receipt_date', values.receipt_date);
  if (values.notes) fd.append('notes', values.notes);

  // Supplier invoice
  if (values.supplier_invoice_number) fd.append('supplier_invoice_number', values.supplier_invoice_number);
  if (values.supplier_invoice_date) fd.append('supplier_invoice_date', values.supplier_invoice_date);
  if (values.invoice_attachment instanceof File) {
    fd.append('invoice_attachment', values.invoice_attachment);
  } else if (values.invoice_attachment_path) {
    fd.append('invoice_attachment_path', values.invoice_attachment_path);
  }

  // Invoice financials
  fd.append('invoice_total_amount', values.invoice_total_amount ?? '0');
  fd.append('paid_amount', values.paid_amount ?? '0');
  fd.append('freight_amount', values.freight_amount ?? '0');
  fd.append('tax_amount', values.tax_amount ?? '0');
  fd.append('additional_costs', values.additional_costs ?? '0');

  // Payment tracking
  if (values.payment_status) fd.append('payment_status', values.payment_status);
  if (values.payment_method) fd.append('payment_method', values.payment_method);
  if (values.payment_terms_days) fd.append('payment_terms_days', values.payment_terms_days);
  if (values.payment_due_date) fd.append('payment_due_date', values.payment_due_date);

  values.lines.forEach((line, i) => {
    fd.append(`lines[${i}][purchase_order_line_id]`, line.purchase_order_line_id);
    fd.append(`lines[${i}][product_id]`, line.product_id);
    fd.append(`lines[${i}][ordered_quantity]`, String(line.ordered_quantity));
    fd.append(`lines[${i}][gross_received_quantity]`, line.gross_received_quantity);
    fd.append(`lines[${i}][net_received_quantity]`, line.net_received_quantity);
    if (line.unit_price != null) fd.append(`lines[${i}][unit_price]`, String(line.unit_price));
    if (line.notes) fd.append(`lines[${i}][notes]`, line.notes);
    if (line.weight_photo instanceof File) {
      fd.append(`lines[${i}][weight_photo]`, line.weight_photo);
    } else if (line.weight_photo_path) {
      fd.append(`lines[${i}][weight_photo_path]`, line.weight_photo_path);
    }
  });

  return fd;
}

// Legacy JSON payload — kept for non-file submissions
export function toPayload(values: GoodsReceiptFormValues): GoodsReceiptPayload {
  return {
    purchase_order_id: values.purchase_order_id,
    warehouse_id: values.warehouse_id,
    receipt_date: values.receipt_date,
    notes: values.notes || null,
    supplier_invoice_number: values.supplier_invoice_number || null,
    supplier_invoice_date: values.supplier_invoice_date || null,
    invoice_attachment_path: values.invoice_attachment_path || null,
    invoice_total_amount: Number(values.invoice_total_amount ?? 0),
    paid_amount: Number(values.paid_amount ?? 0),
    freight_amount: Number(values.freight_amount ?? 0),
    tax_amount: Number(values.tax_amount ?? 0),
    additional_costs: Number(values.additional_costs ?? 0),
    payment_status: (values.payment_status || 'unpaid') as PaymentStatus,
    payment_method: (values.payment_method || null) as PaymentMethod | null,
    payment_terms_days: values.payment_terms_days ? Number(values.payment_terms_days) : null,
    payment_due_date: values.payment_due_date || null,
    lines: values.lines.map((l) => ({
      purchase_order_line_id: l.purchase_order_line_id,
      product_id: l.product_id,
      ordered_quantity: l.ordered_quantity,
      gross_received_quantity: Number(l.gross_received_quantity),
      net_received_quantity: Number(l.net_received_quantity),
      unit_price: l.unit_price ?? 0,
      notes: l.notes || null,
      weight_photo_path: l.weight_photo_path || null,
    })),
  };
}
