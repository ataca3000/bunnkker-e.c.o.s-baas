import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type {
  MarketingInitiative,
  InitiativeTemplate,
  InitiativeKpis,
  InitiativeDashboard,
  InitiativeListResponse,
} from '../types/initiative';

const BASE = '/marketing';

// ─── Initiatives ──────────────────────────────────────────────────────────────

export function useInitiatives(params?: {
  search?: string;
  status?: string;
  company_id?: string;
  business_goal?: string;
  season?: string;
  owner_id?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['initiatives', params],
    queryFn: async () => {
      const { data } = await axios.get<InitiativeListResponse>(`${BASE}/initiatives`, { params });
      return data;
    },
  });
}

export function useInitiative(id: string | undefined) {
  return useQuery({
    queryKey: ['initiatives', id],
    queryFn: async () => {
      const { data } = await axios.get<{ data: MarketingInitiative }>(`${BASE}/initiatives/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<MarketingInitiative>) => {
      const { data } = await axios.post<{ data: MarketingInitiative }>(`${BASE}/initiatives`, payload);
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['initiatives'] }),
  });
}

export function useUpdateInitiative(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<MarketingInitiative>) => {
      const { data } = await axios.put<{ data: MarketingInitiative }>(`${BASE}/initiatives/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initiatives', id] });
      qc.invalidateQueries({ queryKey: ['initiatives'] });
    },
  });
}

export function useArchiveInitiative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.post(`${BASE}/initiatives/${id}/archive`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['initiatives'] }),
  });
}

// ─── Initiative KPIs ──────────────────────────────────────────────────────────

export function useInitiativeKpis(
  id: string | undefined,
  datePreset = 'last_30d',
) {
  return useQuery({
    queryKey: ['initiative-kpis', id, datePreset],
    queryFn: async () => {
      const { data } = await axios.get<InitiativeKpis>(
        `${BASE}/initiatives/${id}/kpis`,
        { params: { date_preset: datePreset } },
      );
      return data;
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ─── Initiative Dashboard ─────────────────────────────────────────────────────

export function useInitiativeDashboard(params?: { date_preset?: string; company_id?: string }) {
  return useQuery({
    queryKey: ['initiative-dashboard', params],
    queryFn: async () => {
      const { data } = await axios.get<InitiativeDashboard>(
        `${BASE}/initiative-dashboard`,
        { params },
      );
      return data;
    },
    staleTime: 60_000,
  });
}

// ─── Campaign Assignment ──────────────────────────────────────────────────────

export function useAssignCampaigns(initiativeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignIds: string[]) => {
      const { data } = await axios.post(
        `${BASE}/initiatives/${initiativeId}/campaigns`,
        { campaign_ids: campaignIds },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initiative-campaigns', initiativeId] });
      qc.invalidateQueries({ queryKey: ['initiative-kpis', initiativeId] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useRemoveCampaign(initiativeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      await axios.delete(`${BASE}/initiatives/${initiativeId}/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initiative-campaigns', initiativeId] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useInitiativeCampaigns(initiativeId: string | undefined) {
  return useQuery({
    queryKey: ['initiative-campaigns', initiativeId],
    queryFn: async () => {
      const { data } = await axios.get(
        `${BASE}/initiatives/${initiativeId}/campaigns`,
        { params: { per_page: 50 } },
      );
      return data;
    },
    enabled: !!initiativeId,
  });
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function useInitiativeTemplates(params?: { category?: string; system_only?: boolean }) {
  return useQuery({
    queryKey: ['initiative-templates', params],
    queryFn: async () => {
      const { data } = await axios.get<{ data: InitiativeTemplate[] }>(
        `${BASE}/initiative-templates`,
        { params },
      );
      return data.data;
    },
    staleTime: 300_000, // templates rarely change
  });
}

export function useCreateFromTemplate(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (overrides: Record<string, unknown>) => {
      const { data } = await axios.post<{ data: MarketingInitiative }>(
        `${BASE}/initiative-templates/${templateId}/create-initiative`,
        overrides,
      );
      return data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['initiatives'] }),
  });
}
