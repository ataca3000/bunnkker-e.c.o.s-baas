import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { CampaignVersion } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export function useCampaignVersions(draftId: string) {
  return useQuery({
    queryKey: [...campaignStudioKeys.draft(draftId), 'versions'],
    queryFn: async (): Promise<CampaignVersion[]> => {
      const { data } = await axios.get(`${BASE}/drafts/${draftId}/versions`);
      return data.data;
    },
    enabled: !!draftId,
  });
}

export function useCompareVersions(draftId: string, versionA: string | null, versionB: string | null) {
  return useQuery({
    queryKey: [...campaignStudioKeys.draft(draftId), 'versions', 'compare', versionA, versionB],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/drafts/${draftId}/versions/${versionA}/compare/${versionB}`);
      return data.data;
    },
    enabled: !!draftId && !!versionA && !!versionB,
  });
}

export function useRestoreVersion(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/versions/${versionId}/restore`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignStudioKeys.draft(draftId) });
    },
  });
}
