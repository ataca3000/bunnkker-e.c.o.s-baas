import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { CampaignApproval } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export function useCampaignApproval(draftId: string) {
  return useQuery({
    queryKey: [...campaignStudioKeys.draft(draftId), 'approval'],
    queryFn: async (): Promise<CampaignApproval | null> => {
      const { data } = await axios.get(`${BASE}/drafts/${draftId}/approval`);
      return data.data;
    },
    enabled: !!draftId,
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: [...campaignStudioKeys.all, 'approvals', 'pending'],
    queryFn: async (): Promise<CampaignApproval[]> => {
      const { data } = await axios.get(`${BASE}/approvals/pending`);
      return data.data;
    },
  });
}

export function useSubmitForApproval(draftId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workflowId?: string) => {
      const { data } = await axios.post(`${BASE}/drafts/${draftId}/submit-for-approval`, { workflow_id: workflowId ?? null });
      return data.data as CampaignApproval;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignStudioKeys.draft(draftId) });
      qc.invalidateQueries({ queryKey: [...campaignStudioKeys.all, 'approvals'] });
    },
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ approvalId, decision, notes }: { approvalId: string; decision: 'approved' | 'rejected' | 'skipped'; notes?: string }) => {
      const { data } = await axios.post(`${BASE}/approvals/${approvalId}/decide`, { decision, notes });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignStudioKeys.all });
    },
  });
}

export function useCancelApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (approvalId: string) => {
      await axios.delete(`${BASE}/approvals/${approvalId}/cancel`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: campaignStudioKeys.all }),
  });
}
