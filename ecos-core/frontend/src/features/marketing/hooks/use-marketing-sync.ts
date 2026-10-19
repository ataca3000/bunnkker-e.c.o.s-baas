import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { MarketingSyncLog, PaginatedResponse } from '../types/marketing';

const BASE = '/marketing';

export function useSyncLogs(connectionId: string | undefined, perPage = 20) {
  return useQuery({
    queryKey: ['sync-logs', connectionId],
    queryFn: async () => {
      const { data } = await axios.get<PaginatedResponse<MarketingSyncLog>>(
        `${BASE}/connections/${connectionId}/sync-logs`,
        { params: { per_page: perPage } },
      );
      return data;
    },
    enabled: !!connectionId,
  });
}

export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, async: isAsync }: { connectionId: string; async?: boolean }) =>
      axios.post<{ message: string; data?: MarketingSyncLog }>(
        `${BASE}/connections/${connectionId}/sync`,
        null,
        { params: { async: isAsync ? 1 : 0 } },
      ),
    onSuccess: (_d, { connectionId }) => {
      qc.invalidateQueries({ queryKey: ['sync-logs', connectionId] });
      qc.invalidateQueries({ queryKey: ['marketing-assets'] });
      qc.invalidateQueries({ queryKey: ['marketing-dashboard'] });
    },
  });
}

export function useMarketingDashboard(companyId?: string) {
  return useQuery({
    queryKey: ['marketing-dashboard', companyId],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/dashboard`, {
        params: companyId ? { company_id: companyId } : undefined,
      });
      return data as import('../types/marketing').MarketingDashboard;
    },
  });
}
