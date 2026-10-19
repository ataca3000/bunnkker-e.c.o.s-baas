import { api } from '@/lib/axios';
import type { SyncLogsListData, SyncLogsListParams } from '@/features/sync-logs/types/sync-log';

export const syncLogsService = {
  async list(params: SyncLogsListParams): Promise<SyncLogsListData> {
    const response = await api.get<{ data: SyncLogsListData }>('/sync-logs', { params });
    return response.data.data;
  },

  async retry(id: string): Promise<void> {
    await api.post(`/sync-logs/${id}/retry`);
  },
};
