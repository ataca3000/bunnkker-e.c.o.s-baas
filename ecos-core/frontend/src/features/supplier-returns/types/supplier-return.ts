export type SupplierReturnStatus =
  | 'draft'
  | 'waiting_approval'
  | 'approved'
  | 'sent'
  | 'credit_pending'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export type SupplierReturnReason =
  | 'defective'
  | 'wrong_item'
  | 'overdelivery'
  | 'quality_issue'
  | 'price_discrepancy'
  | 'expired'
  | 'damaged'
  | 'other';

export type CreditMethod = 'credit_note' | 'refund' | 'replacement';

export type SupplierReturnLine = {
  id: string;
  product_id: string;
  product: { id: string; name: string; sku: string } | null;
  return_quantity: number;
  unit_cost: number;
  total_cost: number;
  reason: string | null;
  quality_condition: string | null;
  notes: string | null;
  uom_name_snapshot: string | null;
  uom_symbol_snapshot: string | null;
  original_received_qty: number | null;
  original_unit_cost: number | null;
};

export type SupplierReturn = {
  id: string;
  return_number: string;
  status: SupplierReturnStatus;
  status_label: string;
  status_color: string;
  reason: SupplierReturnReason | null;
  quality_condition: string | null;
  return_date: string;
  expected_credit_date: string | null;
  notes: string | null;
  total_return_value: number;
  credit_method: CreditMethod | null;
  credit_amount: number | null;
  debit_note_number: string | null;
  credit_received_date: string | null;
  inventory_restocked: boolean;
  submitted_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  supplier: { id: string; name: string } | null;
  warehouse: { id: string; name: string; code: string } | null;
  lines: SupplierReturnLine[];
  created_at: string | null;
  updated_at: string | null;
};

export type SupplierReturnLinePayload = {
  product_id: string;
  goods_receipt_line_id?: string | null;
  return_quantity: number;
  unit_cost: number;
  reason?: string | null;
  quality_condition?: string | null;
  notes?: string | null;
  uom_name_snapshot?: string | null;
  uom_symbol_snapshot?: string | null;
  original_received_qty?: number | null;
  original_unit_cost?: number | null;
};

export type CreateSupplierReturnPayload = {
  supplier_id: string;
  warehouse_id: string;
  purchase_order_id?: string | null;
  goods_receipt_id?: string | null;
  reason?: SupplierReturnReason | null;
  quality_condition?: string | null;
  return_date: string;
  expected_credit_date?: string | null;
  notes?: string | null;
  credit_method?: CreditMethod | null;
  lines: SupplierReturnLinePayload[];
};

export type SupplierReturnsQuery = {
  search?: string;
  status?: SupplierReturnStatus | 'all';
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

export type SupplierReturnsResult = {
  items: SupplierReturn[];
  meta: PaginationMeta;
};
