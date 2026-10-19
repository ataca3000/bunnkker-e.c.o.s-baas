import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api as axios } from '@/lib/axios';
import type { WorkflowExecution } from '../types/automation';
import { automationKeys } from './use-automation-workflows';

export function useTriggerWorkflow(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { entity_type: string; entity_id: string; payload?: Record<string, unknown> }) => {
      const { data } = await axios.post<{ data: WorkflowExecution }>(
        `/marketing/automation/workflows/${workflowId}/trigger`,
        payload,
      );
      return data.data ?? data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: automationKeys.workflow(workflowId) });
    },
  });
}
