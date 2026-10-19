import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { GovernancePolicy } from '../types/campaign-studio';
import { campaignStudioKeys } from './use-campaign-studio';

const BASE = '/marketing/studio';

export const governanceKeys = {
  all:  [...campaignStudioKeys.all, 'governance'] as const,
  list: (filters: object) => [...governanceKeys.all, 'list', filters] as const,
};

export function useGovernancePolicies(filters: { company_id?: string } = {}) {
  return useQuery({
    queryKey: governanceKeys.list(filters),
    queryFn: async () => {
      const { data } = await axios.get(`${BASE}/governance`, { params: filters });
      return data;
    },
  });
}

export function useCreateGovernancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<GovernancePolicy>) => {
      const { data } = await axios.post(`${BASE}/governance`, payload);
      return data.data as GovernancePolicy;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: governanceKeys.all }),
  });
}

export function useUpdateGovernancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<GovernancePolicy> }) => {
      const { data } = await axios.put(`${BASE}/governance/${id}`, payload);
      return data.data as GovernancePolicy;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: governanceKeys.all }),
  });
}

export function useDeleteGovernancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`${BASE}/governance/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: governanceKeys.all }),
  });
}
