export type SupplierInvoiceStatus =
  | 'draft'
  | 'validated'
  | 'auto_processing'
  | 'posted'
  | 'failed'
  | 'cancelled';

export type SupplierInvoiceLine = {
  id: string;
  product_id: string;
  product: { id: string; name: string; sku: string } | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  line_total: number;
  landed_unit_cost: number | null;
  uom_name_snapshot: string | null;
  uom_symbol_snapshot: string | null;
};

export type SupplierInvoice = {
  id: string;
  invoice_number: string;
  supplier_invoice_ref: string | null;
  status: SupplierInvoiceStatus;
  status_label: string;
  status_color: string;
  invoice_date: string;
  due_date: string | null;
  delivery_date: string | null;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  tax_total: number;
  freight_amount: number;
  additional_costs: number;
  discount_amount: number;
  grand_total: number;
  payment_terms: string | null;
  payment_terms_days: number | null;
  payment_method: string | null;
  notes: string | null;
  posting_log: string[] | null;
  posting_error: string | null;
  posted_at: string | null;
  auto_purchase_id: string | null;
  auto_receipt_id: string | null;
  supplier: { id: string; name: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  lines: SupplierInvoiceLine[];
  created_at: string | null;
  updated_at: string | null;
};

export type SupplierInvoiceLinePayload = {
  product_id: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
  discount_amount?: number;
  uom_id_snapshot?: string | null;
  uom_name_snapshot?: string | null;
  uom_symbol_snapshot?: string | null;
  notes?: string | null;
};

export type CreateSupplierInvoicePayload = {
  supplier_invoice_ref?: string | null;
  supplier_id: string;
  warehouse_id: string;
  invoice_date: string;
  due_date?: string | null;
  delivery_date?: string | null;
  currency?: string;
  exchange_rate?: number;
  freight_amount?: number;
  additional_costs?: number;
  discount_amount?: number;
  payment_terms?: string | null;
  payment_terms_days?: number | null;
  payment_method?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  lines: SupplierInvoiceLinePayload[];
};

export type SupplierInvoicesQuery = {
  search?: string;
  status?: SupplierInvoiceStatus | 'all';
  supplier_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type SupplierInvoicesResult = {
  items: SupplierInvoice[];
  meta: PaginationMeta;
};
