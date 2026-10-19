import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type {
  Campaign,
  CampaignAdSet,
  CampaignAd,
  CampaignInsight,
  CampaignListResponse,
  CampaignInsightListResponse,
  CampaignCreativeListResponse,
  CampaignDashboardResponse,
  CampaignBusinessContext,
} from '../types/campaign';

const BASE = '/marketing';

// ─── Campaigns ────────────────────────────────────────────────────────────────

export function useCampaigns(params?: {
  search?: string;
  status?: string;
  objective?: string;
  connector_type?: string;
  connection_id?: string;
  company_id?: string;
  per_page?: number;
  page?: number;
  unassigned?: boolean;
}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const { data } = await axios.get<CampaignListResponse>(
        `${BASE}/campaigns`,
        { params },
      );
      return data;
    },
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: async () => {
      const { data } = await axios.get<{ data: Campaign }>(`${BASE}/campaigns/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useUpdateCampaignBusinessContext(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CampaignBusinessContext>) => {
      const { data } = await axios.patch(
        `${BASE}/campaigns/${campaignId}/business-context`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns', campaignId] });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

// ─── Ad Sets ─────────────────────────────────────────────────────────────────

export function useCampaignAdSets(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-ad-sets', campaignId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: CampaignAdSet[]; meta: unknown }>(
        `${BASE}/campaigns/${campaignId}/ad-sets`,
        { params: { per_page: 50 } },
      );
      return data;
    },
    enabled: !!campaignId,
  });
}

// ─── Ads ──────────────────────────────────────────────────────────────────────

export function useCampaignAds(campaignId: string | undefined, adSetId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-ads', campaignId, adSetId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: CampaignAd[] }>(
        `${BASE}/campaigns/${campaignId}/ad-sets/${adSetId}/ads`,
        { params: { per_page: 50 } },
      );
      return data;
    },
    enabled: !!campaignId && !!adSetId,
  });
}

// ─── Creatives ────────────────────────────────────────────────────────────────

export function useCampaignCreatives(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-creatives', campaignId],
    queryFn: async () => {
      const { data } = await axios.get<CampaignCreativeListResponse>(
        `${BASE}/campaigns/${campaignId}/creatives`,
        { params: { per_page: 50 } },
      );
      return data;
    },
    enabled: !!campaignId,
  });
}

// ─── Insights ────────────────────────────────────────────────────────────────

export function useCampaignInsights(
  campaignId: string | undefined,
  params?: { level?: string; date_start?: string; date_stop?: string; per_page?: number },
) {
  return useQuery({
    queryKey: ['campaign-insights', campaignId, params],
    queryFn: async () => {
      const { data } = await axios.get<CampaignInsightListResponse>(
        `${BASE}/campaigns/${campaignId}/insights`,
        { params: { per_page: 30, ...params } },
      );
      return data;
    },
    enabled: !!campaignId,
  });
}

export function useCampaignInsightTrend(campaignId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['campaign-insight-trend', campaignId, days],
    queryFn: async () => {
      const { data } = await axios.get<{ data: CampaignInsight[] }>(
        `${BASE}/campaigns/${campaignId}/insights/trend`,
        { params: { days } },
      );
      return data.data;
    },
    enabled: !!campaignId,
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useCampaignDashboard(params?: { days?: number; company_id?: string }) {
  return useQuery({
    queryKey: ['campaign-dashboard', params],
    queryFn: async () => {
      const { data } = await axios.get<CampaignDashboardResponse>(
        `${BASE}/campaigns/dashboard`,
        { params },
      );
      return data;
    },
    staleTime: 60_000,
  });
}
