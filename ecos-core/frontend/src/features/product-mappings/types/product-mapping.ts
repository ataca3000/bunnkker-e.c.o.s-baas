export type SyncStatus = 'pending' | 'synced' | 'error';

export type ProductRef = { id: string; sku: string; name: string };
export type ChannelRef = { id: string; name: string; platform: string; platform_label: string };

export type ProductMapping = {
  id: string;
  product_id: string;
  product: ProductRef | null;
  channel_id: string;
  channel: ChannelRef | null;
  external_product_id: string;
  external_sku: string | null;
  sync_status: SyncStatus;
  sync_status_label: string;
  last_sync_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProductMappingPayload = {
  product_id: string;
  channel_id: string;
  external_product_id: string;
  external_sku?: string;
  sync_status: SyncStatus;
};

export type ProductMappingSortField =
  | 'external_product_id'
  | 'external_sku'
  | 'sync_status'
  | 'last_sync_at'
  | 'created_at';

export type SortDirection = 'asc' | 'desc';

export type ProductMappingsQuery = {
  search?: string;
  product_id?: string;
  channel_id?: string;
  sync_status?: SyncStatus | '';
  page?: number;
  per_page?: number;
  sort_by?: ProductMappingSortField;
  sort_dir?: SortDirection;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type ProductMappingsResult = {
  items: ProductMapping[];
  meta: PaginationMeta;
};
