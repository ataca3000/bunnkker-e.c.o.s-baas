/**
 * Purchase Orders feature types.
 */

export type PurchaseOrderStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export type PurchaseOrderLineProduct = {
  id: string;
  sku: string;
  name: string;
};

export type PurchaseOrderLine = {
  id: string;
  product_id: string;
  product: PurchaseOrderLineProduct | null;
  quantity: number;
  received_qty: number;
  remaining_qty: number;
  unit_price: number;
  line_total: number;
};

export type PurchaseOrderSupplier = {
  id: string;
  code: string;
  name: string;
};

export type PurchaseOrderWarehouse = {
  id: string;
  code: string;
  name: string;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier: PurchaseOrderSupplier | null;
  warehouse_id: string | null;
  warehouse: PurchaseOrderWarehouse | null;
  company_id: string | null;
  supplier_reference: string | null;
  order_date: string;
  expected_date: string | null;
  status: PurchaseOrderStatus;
  status_label: string;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  additional_costs: number;
  grand_total: number;
  total: number;
  received_percentage: number | null;
  created_by: string | null;
  lines: PurchaseOrderLine[];
  created_at: string | null;
  updated_at: string | null;
};

export type PurchaseOrderLinePayload = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

export type PurchaseOrderPayload = {
  supplier_id: string;
  order_date: string;
  expected_date?: string | null;
  notes?: string | null;
  lines: PurchaseOrderLinePayload[];
};

export type PurchaseOrderSortField =
  | 'po_number'
  | 'order_date'
  | 'expected_date'
  | 'status'
  | 'total'
  | 'created_at';

export type SortDirection = 'asc' | 'desc';

export type PurchaseOrdersQuery = {
  search?: string;
  supplier_id?: string;
  status?: PurchaseOrderStatus | 'all';
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  sort_by?: PurchaseOrderSortField;
  sort_dir?: SortDirection;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type PurchaseOrdersResult = {
  items: PurchaseOrder[];
  meta: PaginationMeta;
};
