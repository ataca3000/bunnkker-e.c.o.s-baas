import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type {
  CampaignDraft,
  DraftFilters,
  PaginatedResponse,
  StudioDashboard,
  StudioKpis,
} from '../types/campaign-studio';

const BASE = '/marketing/studio';

export const campaignStudioKeys = {
  all:       ['campaign-studio'] as const,
  drafts:    (filters?: DraftFilters) => [...campaignStudioKeys.all, 'drafts', filters] as const,
  draft:     (id: string) => [...campaignStudioKeys.all, 'draft', id] as const,
  kpis:      (companyId?: string) => [...campaignStudioKeys.all, 'kpis', companyId] as const,
  dashboard: (companyId?: string) => [...campaignStudioKeys.all, 'dashboard', companyId] as const,
};

export function useCampaignDrafts(filters: DraftFilters = {}) {
  return useQuery({
    queryKey: campaignStudioKeys.drafts(filters),
    queryFn: async (): Promise<PaginatedResponse<CampaignDraft>> => {
      const { data } = await axios.get(`${BASE}/drafts`, { params: filters });
      return data;
    },
  });
}

export function useCampaignDraft(id: string) {
  return useQuery({
    queryKey: campaignStudioKeys.draft(id),
    queryFn: async (): Promise<CampaignDraft> => {
      const { data } = await axios.get(`${BASE}/drafts/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useStudioKpis(companyId?: string) {
  return useQuery({
    queryKey: campaignStudioKeys.kpis(companyId),
    queryFn: async (): Promise<StudioKpis> => {
      const { data } = await axios.get(`${BASE}/kpis`, { params: companyId ? { company_id: companyId } : {} });
      return data.data;
    },
  });
}

export function useStudioDashboard(companyId?: string) {
  return useQuery({
    queryKey: campaignStudioKeys.dashboard(companyId),
    queryFn: async (): Promise<StudioDashboard> => {
      const { data } = await axios.get(`${BASE}/dashboard`, { params: companyId ? { company_id: companyId } : {} });
      return data.data;
    },
  });
}

export function useCreateCampaignDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CampaignDraft>) => {
      const { data } = await axios.post(`${BASE}/drafts`, payload);
      return data.data as CampaignDraft;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.all }),
  });
}

export function useUpdateCampaignDraft(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CampaignDraft>) => {
      const { data } = await axios.patch(`${BASE}/drafts/${id}`, payload);
      return data.data as CampaignDraft;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignStudioKeys.draft(id) });
      qc.invalidateQueries({ queryKey: campaignStudioKeys.all });
    },
  });
}

export function useDeleteCampaignDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${BASE}/drafts/${id}`);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.all }),
  });
}

export function useDuplicateCampaignDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axios.post(`${BASE}/drafts/${id}/duplicate`);
      return data.data as CampaignDraft;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.all }),
  });
}
