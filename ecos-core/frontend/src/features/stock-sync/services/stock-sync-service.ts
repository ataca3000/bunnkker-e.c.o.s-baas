import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  StockSyncLogsQuery,
  StockSyncLogsResult,
  SyncStockResult,
} from '@/features/stock-sync/types/stock-sync';

export const stockSyncService = {
  async listLogs(params: StockSyncLogsQuery): Promise<StockSyncLogsResult> {
    const { data } = await api.get<ApiResponse<StockSyncLogsResult>>('/stock-sync-logs', { params });
    return data.data;
  },

  async syncStock(channelId: string): Promise<SyncStockResult> {
    const { data } = await api.post<ApiResponse<SyncStockResult>>(`/channels/${channelId}/sync-stock`);
    return data.data;
  },
};
