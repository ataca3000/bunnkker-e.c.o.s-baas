export type FulfillmentStatus = 'pending' | 'fulfilled' | 'cancelled';

export type FulfillmentOrder = {
  id: string;
  order_number: string;
  customer: { id: string; name: string } | null;
  channel: { id: string; name: string } | null;
};

export type FulfillmentWarehouse = { id: string; code: string; name: string };

export type FulfillmentProduct = { id: string; sku: string; name: string };

export type FulfillmentLine = {
  id: string;
  product_id: string;
  product: FulfillmentProduct | null;
  quantity: number;
};

export type Fulfillment = {
  id: string;
  fulfillment_number: string;
  order_id: string;
  order: FulfillmentOrder | null;
  warehouse_id: string;
  warehouse: FulfillmentWarehouse | null;
  fulfillment_date: string;
  status: FulfillmentStatus;
  status_label: string;
  notes: string | null;
  lines: FulfillmentLine[];
  created_at: string | null;
  updated_at: string | null;
};

export type FulfillmentLinePayload = {
  product_id: string;
  quantity: number;
};

export type FulfillmentPayload = {
  order_id: string;
  warehouse_id: string;
  fulfillment_date: string;
  notes?: string | null;
  lines: FulfillmentLinePayload[];
};

export type FulfillmentSortField =
  | 'fulfillment_number'
  | 'fulfillment_date'
  | 'status'
  | 'created_at';

export type FulfillmentsQuery = {
  search?: string;
  status?: FulfillmentStatus | 'all';
  order_id?: string;
  warehouse_id?: string;
  page?: number;
  per_page?: number;
  sort_by?: FulfillmentSortField;
  sort_dir?: 'asc' | 'desc';
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type FulfillmentsResult = {
  items: Fulfillment[];
  meta: PaginationMeta;
};
