export type ConnectionStatus = 'disconnected' | 'connected' | 'error';

export type ChannelPlatform =
  | 'woocommerce'
  | 'shopify'
  | 'amazon'
  | 'noon'
  | 'salla'
  | 'zid';

export type Channel = {
  id: string;
  brand_id: string;
  brand: {
    id: string;
    code: string;
    name: string;
    company: { id: string; name: string } | null;
  } | null;
  business_account_id: string | null;
  business_account: { id: string; code: string; name: string; provider: string } | null;
  code: string | null;
  channel_type: string | null;
  channel_role: string | null;
  name: string;
  platform: ChannelPlatform;
  platform_label: string;
  store_url: string;
  is_active: boolean;
  sync_products: boolean;
  sync_prices: boolean;
  sync_stock: boolean;
  sync_customers: boolean;
  connection_status: ConnectionStatus;
  connection_status_label: string;
  last_sync_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ChannelPayload = {
  brand_id: string;
  name: string;
  platform: ChannelPlatform;
  store_url: string;
  is_active: boolean;
  sync_products: boolean;
  sync_prices: boolean;
  sync_stock: boolean;
  sync_customers: boolean;
  consumer_key?: string;
  consumer_secret?: string;
};

export type ChannelStatusFilter = 'all' | 'active' | 'inactive';
export type ChannelSortField = 'name' | 'platform' | 'is_active' | 'last_sync_at' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export type ChannelsQuery = {
  search?: string;
  status?: ChannelStatusFilter;
  platform?: string;
  company_id?: string;
  brand_id?: string;
  business_account_id?: string;
  page?: number;
  per_page?: number;
  sort_by?: ChannelSortField;
  sort_dir?: SortDirection;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type ChannelsResult = {
  items: Channel[];
  meta: PaginationMeta;
};

export type ImportResult = {
  imported: number;
  created_products: number;
  created_mappings: number;
  failed: number;
  categories_created: number;
  categories_updated: number;
  errors: string[];
};

export type OrderImportResult = {
  imported_orders: number;
  created_customers: number;
  created_orders: number;
  created_lines: number;
  skipped_orders: number;
  failed_lines: number;
  errors: string[];
};
