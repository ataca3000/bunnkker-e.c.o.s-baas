import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { AutomationGovernancePolicy, PaginatedResponse } from '../types/automation';
import { automationKeys } from './use-automation-workflows';

const governanceKeys = {
  all:  () => [...automationKeys.all, 'governance'] as const,
  list: (filters?: Record<string, unknown>) => [...governanceKeys.all(), filters] as const,
  one:  (id: string) => [...governanceKeys.all(), id] as const,
};

export function useGovernancePolicies(filters?: { company_id?: string }) {
  return useQuery({
    queryKey: governanceKeys.list(filters),
    queryFn:  async () => {
      const { data } = await axios.get<PaginatedResponse<AutomationGovernancePolicy>>(
        '/marketing/automation/governance',
        { params: filters },
      );
      return data;
    },
  });
}

export function useCreateGovernancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AutomationGovernancePolicy> & { name: string }) => {
      const { data } = await axios.post<{ data: AutomationGovernancePolicy }>(
        '/marketing/automation/governance',
        payload,
      );
      return data.data ?? data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: governanceKeys.all() }),
  });
}

export function useUpdateGovernancePolicy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AutomationGovernancePolicy>) => {
      const { data } = await axios.put<{ data: AutomationGovernancePolicy }>(
        `/marketing/automation/governance/${id}`,
        payload,
      );
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: governanceKeys.one(id) });
      qc.invalidateQueries({ queryKey: governanceKeys.all() });
    },
  });
}

export function useDeleteGovernancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/marketing/automation/governance/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: governanceKeys.all() }),
  });
}
