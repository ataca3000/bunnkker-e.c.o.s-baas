import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { VersionCompare, WorkflowVersion } from '../types/automation';
import { automationKeys } from './use-automation-workflows';

const versionKeys = {
  list:    (workflowId: string) => [...automationKeys.workflow(workflowId), 'versions'] as const,
  compare: (workflowId: string, a: string, b: string) =>
    [...automationKeys.workflow(workflowId), 'versions', 'compare', a, b] as const,
};

export function useWorkflowVersions(workflowId: string) {
  return useQuery({
    queryKey: versionKeys.list(workflowId),
    queryFn:  async () => {
      const { data } = await axios.get<{ data: WorkflowVersion[] }>(
        `/marketing/automation/workflows/${workflowId}/versions`,
      );
      return data.data ?? data;
    },
    enabled: !!workflowId,
  });
}

export function useCompareVersions(workflowId: string, versionA: string, versionB: string) {
  return useQuery({
    queryKey: versionKeys.compare(workflowId, versionA, versionB),
    queryFn:  async () => {
      const { data } = await axios.get<VersionCompare>(
        `/marketing/automation/workflows/${workflowId}/versions/compare/${versionA}/${versionB}`,
      );
      return data;
    },
    enabled: !!workflowId && !!versionA && !!versionB,
  });
}

export function useRestoreVersion(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { data } = await axios.post(
        `/marketing/automation/workflows/${workflowId}/versions/${versionId}/restore`,
      );
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.workflow(workflowId) });
      qc.invalidateQueries({ queryKey: versionKeys.list(workflowId) });
    },
  });
}
