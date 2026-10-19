export type MovementType =
  | 'purchase_receipt'
  | 'sales_issue'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'transfer_in'
  | 'transfer_out';

export type StockMovementProduct = {
  id: string;
  sku: string;
  name: string;
};

export type StockMovementWarehouse = {
  id: string;
  code: string;
  name: string;
};

export type StockMovement = {
  id: string;
  warehouse_id: string;
  warehouse: StockMovementWarehouse | null;
  product_id: string;
  product: StockMovementProduct | null;
  movement_type: MovementType;
  movement_type_label: string;
  quantity: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  movement_date: string;
  notes: string | null;
  created_at: string | null;
};

export type StockMovementSortField = 'movement_date' | 'quantity' | 'movement_type' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export type StockMovementsQuery = {
  search?: string;
  product_id?: string;
  warehouse_id?: string;
  movement_type?: MovementType | 'all';
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  sort_by?: StockMovementSortField;
  sort_dir?: SortDirection;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type StockMovementsResult = {
  items: StockMovement[];
  meta: PaginationMeta;
};
