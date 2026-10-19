export type StockSyncStatus = 'pending' | 'success' | 'error';

export type StockSyncLog = {
  id: string;
  channel_id: string;
  product_id: string;
  product_mapping_id: string;
  stock_quantity: number;
  sync_status: StockSyncStatus;
  response_message: string | null;
  synced_at: string | null;
  created_at: string | null;
  channel: { id: string; name: string; platform: string } | null;
  product: { id: string; name: string; sku: string | null } | null;
};

export type StockSyncLogsResult = {
  items: StockSyncLog[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

export type StockSyncLogsQuery = {
  search?: string;
  channel_id?: string;
  status?: StockSyncStatus | 'all';
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
};

export type SyncStockResult = {
  synced: number;
  errors: number;
  total: number;
};
