import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { PublishingJob } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export function usePublishingJobs(filters: { status?: string; connector_type?: string; per_page?: number } = {}) {
  return useQuery({
    queryKey: [...campaignStudioKeys.all, 'jobs', filters],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/jobs`, { params: filters });
      return data;
    },
  });
}

export function usePublishingQueueStats(companyId?: string) {
  return useQuery({
    queryKey: [...campaignStudioKeys.all, 'jobs', 'stats', companyId],
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/jobs/stats`, { params: companyId ? { company_id: companyId } : {} });
      return data.data;
    },
    refetchInterval: 30_000,
  });
}

export function usePublishCampaign(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scheduledAt?: string) => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/publish`, { scheduled_at: scheduledAt ?? null });
      return data.data as PublishingJob;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.draft(draftId) }),
  });
}

export function usePauseCampaign(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/pause`);
      return data.data as PublishingJob;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.draft(draftId) }),
  });
}

export function useResumeCampaign(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/resume`);
      return data.data as PublishingJob;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.draft(draftId) }),
  });
}

export function useArchiveCampaign(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/archive`);
      return data.data as PublishingJob;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.draft(draftId) }),
  });
}

export function useRetryPublishingJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data } = await axios.post(`${BASE}/jobs/${jobId}/retry`);
      return data.data as PublishingJob;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...campaignStudioKeys.all, 'jobs'] }),
  });
}
