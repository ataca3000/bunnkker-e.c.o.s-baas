export type GoodsReceiptStatus = 'draft' | 'posted';

export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'cheque'
  | 'wallet'
  | 'credit'
  | 'other';

export type GoodsReceiptLineProduct = {
  id: string;
  sku: string;
  name: string;
};

export type GoodsReceiptLine = {
  id: string;
  purchase_order_line_id: string;
  product_id: string;
  product: GoodsReceiptLineProduct | null;
  uom_id_snapshot: string | null;
  uom_name_snapshot: string | null;
  uom_symbol_snapshot: string | null;
  ordered_quantity: number;
  gross_received_quantity: number;
  net_received_quantity: number;
  variance_quantity: number;
  remaining_quantity: number;
  unit_price: number;
  landed_unit_cost: number | null;
  weight_photo_path: string | null;
  weight_photo_url: string | null;
  notes: string | null;
};

export type GoodsReceiptPOSupplier = {
  id: string;
  name: string;
};

export type GoodsReceiptPO = {
  id: string;
  po_number: string;
  supplier: GoodsReceiptPOSupplier | null;
};

export type GoodsReceiptWarehouse = {
  id: string;
  code: string;
  name: string;
};

export type GoodsReceipt = {
  id: string;
  receipt_number: string;
  purchase_order_id: string;
  purchase_order: GoodsReceiptPO | null;
  warehouse_id: string;
  warehouse: GoodsReceiptWarehouse | null;
  receipt_date: string;
  status: GoodsReceiptStatus;
  notes: string | null;
  // Supplier invoice
  supplier_invoice_number: string | null;
  supplier_invoice_date: string | null;
  invoice_attachment_path: string | null;
  invoice_attachment_url: string | null;
  // Invoice financials
  invoice_total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  freight_amount: number;
  tax_amount: number;
  additional_costs: number;
  total_landed_costs: number;
  // Payment tracking
  payment_status: PaymentStatus;
  payment_status_label: string;
  payment_method: PaymentMethod | null;
  payment_method_label: string | null;
  payment_terms_days: number | null;
  payment_due_date: string | null;
  // Posting
  posted_by: string | null;
  posted_at: string | null;
  lines: GoodsReceiptLine[];
  created_at: string | null;
  updated_at: string | null;
};

export type GoodsReceiptLinePayload = {
  purchase_order_line_id: string;
  product_id: string;
  ordered_quantity: number;
  gross_received_quantity: number;
  net_received_quantity: number;
  unit_price?: number;
  notes?: string | null;
  weight_photo_path?: string | null;
};

export type GoodsReceiptPayload = {
  purchase_order_id: string;
  warehouse_id: string;
  receipt_date: string;
  notes?: string | null;
  // Supplier invoice
  supplier_invoice_number?: string | null;
  supplier_invoice_date?: string | null;
  invoice_attachment_path?: string | null;
  // Invoice financials
  invoice_total_amount?: number;
  paid_amount?: number;
  freight_amount?: number;
  tax_amount?: number;
  additional_costs?: number;
  // Payment tracking
  payment_status?: PaymentStatus;
  payment_method?: PaymentMethod | null;
  payment_terms_days?: number | null;
  payment_due_date?: string | null;
  lines: GoodsReceiptLinePayload[];
};

export type GoodsReceiptSortField = 'receipt_number' | 'receipt_date' | 'status' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export type GoodsReceiptsQuery = {
  search?: string;
  purchase_order_id?: string;
  warehouse_id?: string;
  supplier_id?: string;
  status?: GoodsReceiptStatus | 'all';
  payment_status?: PaymentStatus | 'all';
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  sort_by?: GoodsReceiptSortField;
  sort_dir?: SortDirection;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type GoodsReceiptsResult = {
  items: GoodsReceipt[];
  meta: PaginationMeta;
};
