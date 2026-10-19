import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { CampaignCreative } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export function useCampaignCreatives(draftId: string) {
  return useQuery({
    queryKey: [...campaignStudioKeys.draft(draftId), 'creatives'],
    queryFn: async (): Promise<CampaignCreative[]> => {
      const { data } = await axios.get(`${BASE}/drafts/${draftId}/creatives`);
      return data.data;
    },
    enabled: !!draftId,
  });
}

export function useCreateCreative(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CampaignCreative>) => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/creatives`, payload);
      return data.data as CampaignCreative;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...campaignStudioKeys.draft(draftId), 'creatives'] }),
  });
}

export function useUpdateCreative(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<CampaignCreative> }) => {
      const { data } = await axios.patch(`${BASE}/drafts/${draftId}/creatives/${id}`, payload);
      return data.data as CampaignCreative;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...campaignStudioKeys.draft(draftId), 'creatives'] }),
  });
}

export function useDeleteCreative(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (creativeId: string) => {
      await axios.delete(`${BASE}/drafts/${draftId}/creatives/${creativeId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...campaignStudioKeys.draft(draftId), 'creatives'] }),
  });
}
