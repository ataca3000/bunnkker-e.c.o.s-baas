import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { CampaignAudience } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export function useCampaignAudience(draftId: string) {
  return useQuery({
    queryKey: [...campaignStudioKeys.draft(draftId), 'audience'],
    queryFn: async (): Promise<CampaignAudience | null> => {
      const { data } = await axios.get(`${BASE}/drafts/${draftId}/audience`);
      return data.data;
    },
    enabled: !!draftId,
  });
}

export function useUpdateCampaignAudience(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CampaignAudience>) => {
      const { data } = await axios.put(`${BASE}/drafts/${draftId}/audience`, payload);
      return data.data as CampaignAudience;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...campaignStudioKeys.draft(draftId), 'audience'] });
      qc.invalidateQueries({ queryKey: campaignStudioKeys.draft(draftId) });
    },
  });
}
