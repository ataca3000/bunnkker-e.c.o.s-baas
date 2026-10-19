import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { CampaignDraft, CampaignTemplate } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export const templateKeys = {
  all:  [...campaignStudioKeys.all, 'templates'] as const,
  list: (filters: object) => [...templateKeys.all, 'list', filters] as const,
};

export function useCampaignTemplates(filters: { category?: string; company_id?: string; search?: string } = {}) {
  return useQuery({
    queryKey: templateKeys.list(filters),
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/templates`, { params: filters });
      return data;
    },
  });
}

export function useCreateCampaignTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CampaignTemplate>) => {
      const { data } = await axios.post(`${BASE}/templates`, payload);
      return data.data as CampaignTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all }),
  });
}

export function useCreateDraftFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, name, companyId, brandId }: { templateId: string; name: string; companyId?: string; brandId?: string }) => {
      const { data } = await axios.post(`${BASE}/templates/${templateId}/create-campaign`, {
        name,
        company_id: companyId,
        brand_id: brandId,
      });
      return data.data as CampaignDraft;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.all }),
  });
}
