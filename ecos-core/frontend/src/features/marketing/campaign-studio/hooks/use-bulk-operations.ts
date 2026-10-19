import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { BulkOperationType, CampaignBulkJob } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export function useBulkJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: [...campaignStudioKeys.all, 'bulk', jobId],
    queryFn: async (): Promise<CampaignBulkJob> => {
      const { data } = await axios.get(`${BASE}/bulk/${jobId}`);
      return data.data;
    },
    enabled: !!jobId,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === 'pending' || status === 'processing' ? 3_000 : false;
    },
  });
}

export function useBulkOperation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      operation,
      draftIds,
      payload = {},
      companyId,
    }: {
      operation: BulkOperationType;
      draftIds: string[];
      payload?: Record<string, unknown>;
      companyId?: string;
    }): Promise<CampaignBulkJob> => {
      const { data } = await axios.post(`${BASE}/bulk`, {
        operation,
        draft_ids: draftIds,
        payload,
        company_id: companyId,
      });
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.all }),
  });
}
