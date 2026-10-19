import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { ValidationSummary } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export function useValidationResults(draftId: string) {
  return useQuery({
    queryKey: [...campaignStudioKeys.draft(draftId), 'validation'],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/drafts/${draftId}/validation-results`);
      return data;
    },
    enabled: !!draftId,
  });
}

export function useValidateCampaign(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ValidationSummary> => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/validate`);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...campaignStudioKeys.draft(draftId), 'validation'] });
    },
  });
}
