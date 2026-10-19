import { useQuery } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type {
  ExecutiveDashboardResponse,
  AnalyticsResponse,
  CampaignAnalyticsRow,
  AdAnalyticsRow,
  CreativeAnalyticsRow,
  TrendsResponse,
  BudgetAnalysisResponse,
  ReportsListResponse,
  IntelligenceFilters,
  TrendsFilters,
} from '../types/intelligence';

const BASE = '/marketing/intelligence';

const STALE = 15 * 60 * 1000; // 15-min cache matches backend TTL

// ── Executive Dashboard ───────────────────────────────────────────────────────

export function useIntelligenceDashboard(filters?: IntelligenceFilters) {
  return useQuery({
    queryKey: ['intelligence-dashboard', filters],
    queryFn: async () => {
      const { data } = await axios.get<ExecutiveDashboardResponse>(
        `${BASE}/dashboard`,
        { params: filters },
      );
      return data;
    },
    staleTime: STALE,
  });
}

// ── Campaign Analytics ────────────────────────────────────────────────────────

export function useIntelligenceCampaigns(filters?: IntelligenceFilters) {
  return useQuery({
    queryKey: ['intelligence-campaigns', filters],
    queryFn: async () => {
      const { data } = await axios.get<AnalyticsResponse<CampaignAnalyticsRow>>(
        `${BASE}/campaigns`,
        { params: filters },
      );
      return data;
    },
    staleTime: STALE,
  });
}

export function useIntelligenceCampaignTrend(
  campaignId: string | undefined,
  filters?: IntelligenceFilters,
) {
  return useQuery({
    queryKey: ['intelligence-campaign-trend', campaignId, filters],
    queryFn: async () => {
      const { data } = await axios.get<{ data: unknown[] }>(
        `${BASE}/campaigns/${campaignId}/trend`,
        { params: filters },
      );
      return data;
    },
    enabled: !!campaignId,
    staleTime: STALE,
  });
}

// ── Ad Analytics ──────────────────────────────────────────────────────────────

export function useIntelligenceAds(filters?: IntelligenceFilters) {
  return useQuery({
    queryKey: ['intelligence-ads', filters],
    queryFn: async () => {
      const { data } = await axios.get<AnalyticsResponse<AdAnalyticsRow>>(
        `${BASE}/ads`,
        { params: filters },
      );
      return data;
    },
    staleTime: STALE,
  });
}

// ── Creative Analytics ────────────────────────────────────────────────────────

export function useIntelligenceCreatives(filters?: IntelligenceFilters) {
  return useQuery({
    queryKey: ['intelligence-creatives', filters],
    queryFn: async () => {
      const { data } = await axios.get<AnalyticsResponse<CreativeAnalyticsRow>>(
        `${BASE}/creatives`,
        { params: filters },
      );
      return data;
    },
    staleTime: STALE,
  });
}

// ── Performance Trends ────────────────────────────────────────────────────────

export function useIntelligenceTrends(filters?: TrendsFilters) {
  return useQuery({
    queryKey: ['intelligence-trends', filters],
    queryFn: async () => {
      const { data } = await axios.get<TrendsResponse>(
        `${BASE}/trends`,
        { params: filters },
      );
      return data;
    },
    staleTime: STALE,
  });
}

// ── Budget Analysis ───────────────────────────────────────────────────────────

export function useIntelligenceBudget(
  filters?: IntelligenceFilters & { include_ad_sets?: boolean },
) {
  return useQuery({
    queryKey: ['intelligence-budget', filters],
    queryFn: async () => {
      const { data } = await axios.get<BudgetAnalysisResponse>(
        `${BASE}/budget`,
        { params: filters },
      );
      return data;
    },
    staleTime: STALE,
  });
}

// ── Reports ───────────────────────────────────────────────────────────────────

export function useIntelligenceReports(params?: { per_page?: number; page?: number }) {
  return useQuery({
    queryKey: ['intelligence-reports', params],
    queryFn: async () => {
      const { data } = await axios.get<ReportsListResponse>(
        `${BASE}/reports`,
        { params },
      );
      return data;
    },
  });
}

// ── Export URL helpers (trigger browser download) ────────────────────────────

export function buildExportUrl(
  type: 'campaigns' | 'ads' | 'creatives',
  filters: IntelligenceFilters,
  format: 'csv' | 'excel' | 'html' = 'csv',
): string {
  const params = new URLSearchParams();
  params.set('format', format);
  if (filters.date_preset)  params.set('date_preset', filters.date_preset);
  if (filters.date_start)   params.set('date_start', filters.date_start);
  if (filters.date_stop)    params.set('date_stop', filters.date_stop);
  if (filters.connection_id) params.set('connection_id', filters.connection_id);
  if (filters.campaign_id)  params.set('campaign_id', filters.campaign_id);
  if (filters.sort_by)      params.set('sort_by', filters.sort_by);
  return `${BASE}/reports/export/${type}?${params.toString()}`;
}
