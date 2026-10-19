import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { CampaignPlacement } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export function useCampaignPlacements(draftId: string) {
  return useQuery({
    queryKey: [...campaignStudioKeys.draft(draftId), 'placements'],
    queryFn: async (): Promise<CampaignPlacement | null> => {
      const { data } = await axios.get(`${BASE}/drafts/${draftId}/placements`);
      return data.data;
    },
    enabled: !!draftId,
  });
}

export function useUpdatePlacements(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CampaignPlacement>) => {
      const { data } = await axios.put(`${BASE}/drafts/${draftId}/placements`, payload);
      return data.data as CampaignPlacement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...campaignStudioKeys.draft(draftId), 'placements'] });
    },
  });
}
