import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';

const BASE = '/marketing';

export function useSyncCampaigns(connectionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (options?: {
      sync_insights?: boolean;
      sync_creatives?: boolean;
      insight_date_preset?: string;
    }) => {
      const { data } = await axios.post(
        `${BASE}/connections/${connectionId}/campaigns/sync`,
        options ?? {},
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaign-dashboard'] });
    },
  });
}

export function useBackfillCampaignInsights(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { date_start: string; date_stop: string }) => {
      const { data } = await axios.post(
        `${BASE}/campaigns/${campaignId}/backfill`,
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaign-insights', campaignId] });
      qc.invalidateQueries({ queryKey: ['campaign-insight-trend', campaignId] });
    },
  });
}
