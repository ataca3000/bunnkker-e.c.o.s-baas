export type SyncEntityType = 'product' | 'inventory' | 'order' | 'customer' | 'price';
export type SyncDirection = 'inbound' | 'outbound';
export type SyncStatus = 'pending' | 'processing' | 'success' | 'failed' | 'skipped';

export type SyncLogChannel = {
  id: string;
  name: string;
};

export type SyncLog = {
  id: string;
  channel: SyncLogChannel | null;
  entity_type: SyncEntityType;
  entity_id: string | null;
  direction: SyncDirection;
  action: string | null;
  status: SyncStatus;
  error_message: string | null;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  synced_at: string | null;
  created_at: string | null;
};

export type SyncLogsListParams = {
  channel_id?: string;
  entity_type?: SyncEntityType | 'all';
  direction?: SyncDirection | 'all';
  status?: SyncStatus | 'all';
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
};

export type SyncLogsListData = {
  items: SyncLog[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};
